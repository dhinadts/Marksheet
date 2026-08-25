ALTER TABLE question_paper_versions DISABLE TRIGGER question_paper_versions_immutable;
UPDATE question_paper_versions version
SET image_template = jsonb_set(
  version.image_template,
  '{cells}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN cell->>'questionCode' ~ '^Q([1-9]|10)$'
          THEN jsonb_set(jsonb_set(cell, '{box,x}', '0.214'), '{box,width}', '0.066')
        ELSE cell
      END
      ORDER BY ordinal
    )
    FROM jsonb_array_elements(version.image_template->'cells') WITH ORDINALITY AS source(cell, ordinal)
  )
)
WHERE id = '00000000-0000-4000-8000-00000000000e'::uuid;
ALTER TABLE question_paper_versions ENABLE TRIGGER question_paper_versions_immutable;
