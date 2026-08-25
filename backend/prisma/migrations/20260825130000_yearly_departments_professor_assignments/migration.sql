CREATE TABLE "department_academic_years" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "department_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "department_academic_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "department_academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "department_academic_years_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "department_academic_years_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "department_academic_years_tenant_id_department_id_academic_year_id_key" ON "department_academic_years"("tenant_id", "department_id", "academic_year_id");
CREATE INDEX "department_academic_years_tenant_id_academic_year_id_status_idx" ON "department_academic_years"("tenant_id", "academic_year_id", "status");

CREATE TABLE "professor_subject_assignments" (
  "id" UUID NOT NULL, "tenant_id" UUID NOT NULL, "professor_id" UUID NOT NULL,
  "subject_offering_id" UUID NOT NULL, "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "professor_subject_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professor_subject_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "professor_subject_assignments_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "professor_subject_assignments_subject_offering_id_fkey" FOREIGN KEY ("subject_offering_id") REFERENCES "subject_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "professor_subject_assignments_tenant_id_professor_id_subject_offering_id_key" ON "professor_subject_assignments"("tenant_id", "professor_id", "subject_offering_id");
CREATE INDEX "professor_subject_assignments_tenant_id_professor_id_status_idx" ON "professor_subject_assignments"("tenant_id", "professor_id", "status");
