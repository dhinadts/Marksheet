-- The demo institution uses the printed 16-question valuation sheet. Only
-- numeric mark/total cells are included: signatures, words and identifiers
-- are deliberately outside every box.
ALTER TABLE question_paper_versions DISABLE TRIGGER question_paper_versions_immutable;
UPDATE question_paper_versions
SET image_template = '{
  "expectedAspectRatio": 0.769,
  "aspectRatioTolerance": 0.25,
  "cells": [
    {"questionCode":"Q1","box":{"x":0.202,"y":0.579,"width":0.078,"height":0.025}},
    {"questionCode":"Q2","box":{"x":0.202,"y":0.601,"width":0.078,"height":0.025}},
    {"questionCode":"Q3","box":{"x":0.202,"y":0.623,"width":0.078,"height":0.025}},
    {"questionCode":"Q4","box":{"x":0.202,"y":0.645,"width":0.078,"height":0.025}},
    {"questionCode":"Q5","box":{"x":0.202,"y":0.667,"width":0.078,"height":0.025}},
    {"questionCode":"Q6","box":{"x":0.202,"y":0.689,"width":0.078,"height":0.025}},
    {"questionCode":"Q7","box":{"x":0.202,"y":0.711,"width":0.078,"height":0.025}},
    {"questionCode":"Q8","box":{"x":0.202,"y":0.733,"width":0.078,"height":0.025}},
    {"questionCode":"Q9","box":{"x":0.202,"y":0.755,"width":0.078,"height":0.025}},
    {"questionCode":"Q10","box":{"x":0.202,"y":0.777,"width":0.078,"height":0.025}},
    {"questionCode":"Q11","box":{"x":0.655,"y":0.578,"width":0.063,"height":0.047}},
    {"questionCode":"Q12","box":{"x":0.655,"y":0.620,"width":0.063,"height":0.047}},
    {"questionCode":"Q13","box":{"x":0.655,"y":0.662,"width":0.063,"height":0.047}},
    {"questionCode":"Q14","box":{"x":0.655,"y":0.704,"width":0.063,"height":0.047}},
    {"questionCode":"Q15","box":{"x":0.655,"y":0.746,"width":0.063,"height":0.047}},
    {"questionCode":"Q16","box":{"x":0.655,"y":0.788,"width":0.063,"height":0.047}}
  ]
}'::jsonb
WHERE id = '00000000-0000-4000-8000-00000000000e'::uuid
  AND image_template IS NULL;
ALTER TABLE question_paper_versions ENABLE TRIGGER question_paper_versions_immutable;

-- This physical sheet records one total for each of Q11-Q16. Those question
-- totals are therefore the scorable records; the a/b rows remain metadata.
ALTER TABLE marking_scheme_items DISABLE TRIGGER USER;
UPDATE marking_scheme_items
SET is_scorable = CASE WHEN question_part_id IS NULL THEN true ELSE false END
WHERE marking_scheme_version_id = '00000000-0000-4000-8000-000000000010'::uuid
  AND question_id IN (
    SELECT id FROM questions
    WHERE question_paper_version_id = '00000000-0000-4000-8000-00000000000e'::uuid
      AND code IN ('Q11','Q12','Q13','Q14','Q15','Q16')
  );
ALTER TABLE marking_scheme_items ENABLE TRIGGER USER;
