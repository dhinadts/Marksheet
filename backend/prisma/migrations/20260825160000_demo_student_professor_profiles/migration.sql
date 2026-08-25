ALTER TABLE "students"
  ADD COLUMN "first_name" VARCHAR(100),
  ADD COLUMN "last_name" VARCHAR(100),
  ADD COLUMN "date_of_birth" DATE;

UPDATE "students"
SET
  "first_name" = split_part("full_name", ' ', 1),
  "last_name" = CASE
    WHEN position(' ' in "full_name") > 0
      THEN substring("full_name" from position(' ' in "full_name") + 1)
    ELSE '-'
  END;

ALTER TABLE "students"
  ALTER COLUMN "first_name" SET NOT NULL,
  ALTER COLUMN "last_name" SET NOT NULL;

CREATE TABLE "professor_profiles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "employee_number" VARCHAR(80) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "date_of_birth" DATE,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "professor_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professor_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "professor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "professor_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "professor_profiles_user_id_key" ON "professor_profiles"("user_id");
CREATE UNIQUE INDEX "professor_profiles_tenant_id_employee_number_key" ON "professor_profiles"("tenant_id", "employee_number");
CREATE INDEX "professor_profiles_tenant_id_department_id_status_idx" ON "professor_profiles"("tenant_id", "department_id", "status");

ALTER TABLE "mark_sheets" ADD COLUMN "question_set_number" VARCHAR(80);
UPDATE "mark_sheets" AS ms
SET "question_set_number" = qp."code"
FROM "question_paper_versions" AS qpv
JOIN "question_papers" AS qp ON qp."id" = qpv."question_paper_id"
WHERE ms."question_paper_version_id" = qpv."id";
ALTER TABLE "mark_sheets" ALTER COLUMN "question_set_number" SET NOT NULL;
