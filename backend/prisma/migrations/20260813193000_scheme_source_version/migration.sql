ALTER TABLE "marking_scheme_versions"
  ADD COLUMN "question_paper_version_id" UUID;

ALTER TABLE "marking_scheme_versions"
  DISABLE TRIGGER "marking_scheme_versions_immutable";

UPDATE "marking_scheme_versions" msv
SET "question_paper_version_id" = qpv."id"
FROM "question_paper_versions" qpv
WHERE qpv."marking_scheme_version_id" = msv."id";

ALTER TABLE "marking_scheme_versions"
  ENABLE TRIGGER "marking_scheme_versions_immutable";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "marking_scheme_versions" WHERE "question_paper_version_id" IS NULL) THEN
    RAISE EXCEPTION 'Every marking scheme version must reference a question paper version';
  END IF;
END $$;

ALTER TABLE "marking_scheme_versions"
  ALTER COLUMN "question_paper_version_id" SET NOT NULL,
  ADD CONSTRAINT "marking_scheme_versions_question_paper_version_id_fkey"
    FOREIGN KEY ("question_paper_version_id") REFERENCES "question_paper_versions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "marking_scheme_versions_tenant_id_question_paper_version_id_idx"
  ON "marking_scheme_versions"("tenant_id", "question_paper_version_id");

DROP TRIGGER IF EXISTS "mark_sheets_validate_versions" ON "mark_sheets";

CREATE OR REPLACE FUNCTION "validate_scheme_item_references"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  part_question_id uuid;
  parent_version_id uuid;
  parent_question_id uuid;
  source_paper_version_id uuid;
  question_paper_version_id_value uuid;
BEGIN
  SELECT "question_paper_version_id" INTO source_paper_version_id
  FROM "marking_scheme_versions"
  WHERE "id" = NEW."marking_scheme_version_id" AND "tenant_id" = NEW."tenant_id";
  SELECT questions."question_paper_version_id" INTO question_paper_version_id_value
  FROM "questions"
  WHERE "id" = NEW."question_id" AND "tenant_id" = NEW."tenant_id";
  IF source_paper_version_id IS DISTINCT FROM question_paper_version_id_value THEN
    RAISE EXCEPTION 'scheme item question does not belong to its source paper version'
      USING ERRCODE = '23514';
  END IF;
  IF NEW."question_part_id" IS NOT NULL THEN
    SELECT "question_id" INTO part_question_id FROM "question_parts"
    WHERE "id" = NEW."question_part_id" AND "tenant_id" = NEW."tenant_id";
    IF part_question_id IS DISTINCT FROM NEW."question_id" THEN
      RAISE EXCEPTION 'scheme item question part does not belong to its question'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."parent_item_id" IS NOT NULL THEN
    SELECT "marking_scheme_version_id", "question_id"
      INTO parent_version_id, parent_question_id
      FROM "marking_scheme_items" WHERE "id" = NEW."parent_item_id";
    IF parent_version_id IS DISTINCT FROM NEW."marking_scheme_version_id"
       OR parent_question_id IS DISTINCT FROM NEW."question_id" THEN
      RAISE EXCEPTION 'scheme item parent must belong to the same version and question'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "validate_mark_sheet_scheme_pair"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  scheme_paper_version uuid;
  scheme_status "VersionStatus";
BEGIN
  SELECT "question_paper_version_id", "status"
    INTO scheme_paper_version, scheme_status
  FROM "marking_scheme_versions"
  WHERE "id" = NEW."marking_scheme_version_id" AND "tenant_id" = NEW."tenant_id";

  IF scheme_paper_version IS DISTINCT FROM NEW."question_paper_version_id" THEN
    RAISE EXCEPTION 'marking scheme version does not belong to the selected question paper version'
      USING ERRCODE = '23514';
  END IF;
  IF scheme_status IS DISTINCT FROM 'PUBLISHED' THEN
    RAISE EXCEPTION 'mark sheets require a published marking scheme version'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "mark_sheets_validate_scheme_pair"
  BEFORE INSERT OR UPDATE OF "question_paper_version_id", "marking_scheme_version_id"
  ON "mark_sheets"
  FOR EACH ROW EXECUTE FUNCTION "validate_mark_sheet_scheme_pair"();
