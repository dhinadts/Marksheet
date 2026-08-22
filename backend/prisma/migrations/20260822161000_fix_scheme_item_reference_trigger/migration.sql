CREATE OR REPLACE FUNCTION "validate_scheme_item_references"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  part_question_id uuid;
  parent_version_id uuid;
  parent_question_id uuid;
  source_paper_version_id uuid;
  question_paper_version_id_value uuid;
BEGIN
  SELECT marking_scheme_versions."question_paper_version_id"
    INTO source_paper_version_id
  FROM "marking_scheme_versions"
  WHERE marking_scheme_versions."id" = NEW."marking_scheme_version_id"
    AND marking_scheme_versions."tenant_id" = NEW."tenant_id";

  SELECT questions."question_paper_version_id"
    INTO question_paper_version_id_value
  FROM "questions" AS questions
  WHERE questions."id" = NEW."question_id"
    AND questions."tenant_id" = NEW."tenant_id";

  IF source_paper_version_id IS DISTINCT FROM question_paper_version_id_value THEN
    RAISE EXCEPTION 'scheme item question does not belong to its source paper version'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."question_part_id" IS NOT NULL THEN
    SELECT question_parts."question_id"
      INTO part_question_id
    FROM "question_parts" AS question_parts
    WHERE question_parts."id" = NEW."question_part_id"
      AND question_parts."tenant_id" = NEW."tenant_id";
    IF part_question_id IS DISTINCT FROM NEW."question_id" THEN
      RAISE EXCEPTION 'scheme item question part does not belong to its question'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."parent_item_id" IS NOT NULL THEN
    SELECT marking_scheme_items."marking_scheme_version_id",
           marking_scheme_items."question_id"
      INTO parent_version_id, parent_question_id
    FROM "marking_scheme_items" AS marking_scheme_items
    WHERE marking_scheme_items."id" = NEW."parent_item_id";
    IF parent_version_id IS DISTINCT FROM NEW."marking_scheme_version_id"
       OR parent_question_id IS DISTINCT FROM NEW."question_id" THEN
      RAISE EXCEPTION 'scheme item parent must belong to the same version and question'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
