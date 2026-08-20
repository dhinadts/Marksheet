ALTER TABLE "question_paper_versions"
  ADD COLUMN "image_template" JSONB;

COMMENT ON COLUMN "question_paper_versions"."image_template" IS
  'Versioned normalized mark-cell geometry authored with the question-paper version';
