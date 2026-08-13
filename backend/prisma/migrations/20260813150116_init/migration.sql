-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarkSheetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'REVIEW_REQUIRED', 'VERIFIED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'AUTO_ACCEPT', 'REVIEW_RECOMMENDED', 'REVIEW_REQUIRED', 'MANUAL_ENTRY_REQUIRED', 'INVALID_EXTRACTION');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'CORRECTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarkValueSource" AS ENUM ('AI', 'REVIEWER', 'DATA_ENTRY', 'CALCULATION', 'IMPORT');

-- CreateEnum
CREATE TYPE "VerificationSessionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('COMPLETE', 'INCOMPLETE', 'TOTAL_MISMATCH', 'INVALID', 'READY_FOR_EXPORT');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('QUALITY_CHECK', 'PREPROCESS', 'TEMPLATE_DETECTION', 'CELL_DETECTION', 'MARK_EXTRACTION', 'VALIDATION', 'FULL_PROCESSING', 'EXPORT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('ORIGINAL_MARK_SHEET', 'PROCESSED_MARK_SHEET', 'QUESTION_CROP', 'EXPORT', 'MODEL_ARTIFACT');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255),
    "display_name" VARCHAR(150) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colleges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "university_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "college_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "study_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "study_year_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "register_number" VARCHAR(80) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_offerings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_papers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_paper_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "question_paper_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "published_by_id" UUID,
    "marking_scheme_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_paper_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "question_paper_version_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "group_code" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_parts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "question_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marking_schemes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "question_paper_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marking_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marking_scheme_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "marking_scheme_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "maximum_mark" DECIMAL(7,2) NOT NULL,
    "confidence_thresholds" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "published_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marking_scheme_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marking_scheme_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "marking_scheme_version_id" UUID NOT NULL,
    "question_id" UUID,
    "question_part_id" UUID,
    "parent_item_id" UUID,
    "group_code" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "maximum_mark" DECIMAL(7,2) NOT NULL,
    "is_scorable" BOOLEAN NOT NULL DEFAULT true,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marking_scheme_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_sheets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "subject_offering_id" UUID NOT NULL,
    "question_paper_version_id" UUID NOT NULL,
    "marking_scheme_version_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "MarkSheetStatus" NOT NULL DEFAULT 'UPLOADED',
    "handwritten_total" DECIMAL(7,2),
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mark_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "bucket" VARCHAR(120) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_sheet_images" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mark_sheet_id" UUID NOT NULL,
    "file_object_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "is_original" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mark_sheet_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" VARCHAR(80) NOT NULL,
    "checksum_sha256" CHAR(64),
    "artifact_file_id" UUID,
    "configuration" JSONB NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_marks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mark_sheet_id" UUID NOT NULL,
    "marking_scheme_item_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "question_part_id" UUID,
    "source_image_id" UUID,
    "ai_model_version_id" UUID,
    "raw_text" VARCHAR(100),
    "extracted_value" DECIMAL(7,2),
    "confidence" DECIMAL(5,4),
    "bounding_box" JSONB,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "extracted_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark_values" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "extracted_mark_id" UUID NOT NULL,
    "value" DECIMAL(7,2) NOT NULL,
    "source" "MarkValueSource" NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mark_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mark_sheet_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "completed_by_id" UUID,
    "status" "VerificationSessionStatus" NOT NULL DEFAULT 'OPEN',
    "lock_version" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "verification_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "verification_session_id" UUID NOT NULL,
    "extracted_mark_id" UUID NOT NULL,
    "selected_mark_value_id" UUID,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "verification_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calculation_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mark_sheet_id" UUID NOT NULL,
    "calculation_version" INTEGER NOT NULL,
    "group_totals" JSONB NOT NULL,
    "grand_total" DECIMAL(7,2) NOT NULL,
    "maximum_mark" DECIMAL(7,2) NOT NULL,
    "percentage" DECIMAL(7,4) NOT NULL,
    "handwritten_total" DECIMAL(7,2),
    "status" "CalculationStatus" NOT NULL,
    "input_digest" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mark_sheet_id" UUID,
    "ai_model_version_id" UUID,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "external_job_id" VARCHAR(150),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(120) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "reason" TEXT,
    "correlation_id" UUID,
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "file_object_id" UUID,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL,
    "error_message" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE INDEX "users_tenant_id_status_idx" ON "users"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_tenant_id_user_id_idx" ON "user_roles"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_tenant_id_user_id_role_id_key" ON "user_roles"("tenant_id", "user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_tenant_id_role_id_permission_id_key" ON "role_permissions"("tenant_id", "role_id", "permission_id");

-- CreateIndex
CREATE INDEX "universities_tenant_id_status_idx" ON "universities"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "universities_tenant_id_code_key" ON "universities"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "colleges_tenant_id_university_id_idx" ON "colleges"("tenant_id", "university_id");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_tenant_id_code_key" ON "colleges"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "departments_tenant_id_college_id_idx" ON "departments"("tenant_id", "college_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_college_id_code_key" ON "departments"("tenant_id", "college_id", "code");

-- CreateIndex
CREATE INDEX "programs_tenant_id_department_id_idx" ON "programs"("tenant_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "programs_tenant_id_department_id_code_key" ON "programs"("tenant_id", "department_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_years_tenant_id_code_key" ON "academic_years"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "study_years_tenant_id_ordinal_key" ON "study_years"("tenant_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_tenant_id_academic_year_id_ordinal_key" ON "semesters"("tenant_id", "academic_year_id", "ordinal");

-- CreateIndex
CREATE INDEX "classes_tenant_id_program_id_academic_year_id_idx" ON "classes"("tenant_id", "program_id", "academic_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "classes_tenant_id_code_key" ON "classes"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sections_tenant_id_class_id_code_key" ON "sections"("tenant_id", "class_id", "code");

-- CreateIndex
CREATE INDEX "students_tenant_id_section_id_status_idx" ON "students"("tenant_id", "section_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_register_number_key" ON "students"("tenant_id", "register_number");

-- CreateIndex
CREATE INDEX "subjects_tenant_id_department_id_idx" ON "subjects"("tenant_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_tenant_id_code_key" ON "subjects"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "subject_offerings_tenant_id_section_id_idx" ON "subject_offerings"("tenant_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_offerings_tenant_id_subject_id_academic_year_id_sec_key" ON "subject_offerings"("tenant_id", "subject_id", "academic_year_id", "section_id");

-- CreateIndex
CREATE INDEX "question_papers_tenant_id_subject_id_idx" ON "question_papers"("tenant_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "question_papers_tenant_id_code_key" ON "question_papers"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "question_paper_versions_marking_scheme_version_id_key" ON "question_paper_versions"("marking_scheme_version_id");

-- CreateIndex
CREATE INDEX "question_paper_versions_tenant_id_status_idx" ON "question_paper_versions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "question_paper_versions_tenant_id_question_paper_id_version_key" ON "question_paper_versions"("tenant_id", "question_paper_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "questions_tenant_id_question_paper_version_id_code_key" ON "questions"("tenant_id", "question_paper_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "questions_tenant_id_question_paper_version_id_display_order_key" ON "questions"("tenant_id", "question_paper_version_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "question_parts_tenant_id_question_id_code_key" ON "question_parts"("tenant_id", "question_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "question_parts_tenant_id_question_id_display_order_key" ON "question_parts"("tenant_id", "question_id", "display_order");

-- CreateIndex
CREATE INDEX "marking_schemes_tenant_id_question_paper_id_idx" ON "marking_schemes"("tenant_id", "question_paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "marking_schemes_tenant_id_code_key" ON "marking_schemes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "marking_scheme_versions_tenant_id_status_idx" ON "marking_scheme_versions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marking_scheme_versions_tenant_id_marking_scheme_id_version_key" ON "marking_scheme_versions"("tenant_id", "marking_scheme_id", "version");

-- CreateIndex
CREATE INDEX "marking_scheme_items_tenant_id_marking_scheme_version_id_gr_idx" ON "marking_scheme_items"("tenant_id", "marking_scheme_version_id", "group_code");

-- CreateIndex
CREATE UNIQUE INDEX "marking_scheme_items_tenant_id_marking_scheme_version_id_di_key" ON "marking_scheme_items"("tenant_id", "marking_scheme_version_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "marking_scheme_items_tenant_id_marking_scheme_version_id_qu_key" ON "marking_scheme_items"("tenant_id", "marking_scheme_version_id", "question_id", "question_part_id");

-- CreateIndex
CREATE INDEX "mark_sheets_tenant_id_status_idx" ON "mark_sheets"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mark_sheets_tenant_id_student_id_subject_offering_id_questi_key" ON "mark_sheets"("tenant_id", "student_id", "subject_offering_id", "question_paper_version_id", "attempt");

-- CreateIndex
CREATE INDEX "file_objects_tenant_id_purpose_idx" ON "file_objects"("tenant_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "file_objects_tenant_id_bucket_object_key_key" ON "file_objects"("tenant_id", "bucket", "object_key");

-- CreateIndex
CREATE UNIQUE INDEX "mark_sheet_images_tenant_id_mark_sheet_id_page_number_is_or_key" ON "mark_sheet_images"("tenant_id", "mark_sheet_id", "page_number", "is_original");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_versions_tenant_id_name_version_key" ON "ai_model_versions"("tenant_id", "name", "version");

-- CreateIndex
CREATE INDEX "extracted_marks_tenant_id_extraction_status_verification_st_idx" ON "extracted_marks"("tenant_id", "extraction_status", "verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_marks_tenant_id_mark_sheet_id_marking_scheme_item_key" ON "extracted_marks"("tenant_id", "mark_sheet_id", "marking_scheme_item_id");

-- CreateIndex
CREATE INDEX "mark_values_tenant_id_extracted_mark_id_created_at_idx" ON "mark_values"("tenant_id", "extracted_mark_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_sessions_tenant_id_status_assigned_to_id_idx" ON "verification_sessions"("tenant_id", "status", "assigned_to_id");

-- CreateIndex
CREATE INDEX "verification_items_tenant_id_status_idx" ON "verification_items"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_items_tenant_id_verification_session_id_extrac_key" ON "verification_items"("tenant_id", "verification_session_id", "extracted_mark_id");

-- CreateIndex
CREATE INDEX "calculation_results_tenant_id_status_idx" ON "calculation_results"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calculation_results_tenant_id_mark_sheet_id_calculation_ver_key" ON "calculation_results"("tenant_id", "mark_sheet_id", "calculation_version");

-- CreateIndex
CREATE INDEX "processing_jobs_tenant_id_status_type_idx" ON "processing_jobs"("tenant_id", "status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "processing_jobs_tenant_id_external_job_id_key" ON "processing_jobs"("tenant_id", "external_job_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_type_entity_id_idx" ON "audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "exports_tenant_id_status_created_at_idx" ON "exports"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_status_created_at_idx" ON "notifications"("tenant_id", "user_id", "status", "created_at");

-- Phase 2 integrity constraints that are not expressible in Prisma's schema DSL.
ALTER TABLE "academic_years"
  ADD CONSTRAINT "academic_years_valid_date_range" CHECK ("starts_on" <= "ends_on");
ALTER TABLE "study_years"
  ADD CONSTRAINT "study_years_positive_ordinal" CHECK ("ordinal" > 0);
ALTER TABLE "semesters"
  ADD CONSTRAINT "semesters_positive_ordinal" CHECK ("ordinal" > 0);
ALTER TABLE "classes"
  ADD CONSTRAINT "classes_nonempty_code" CHECK (length(trim("code")) > 0);
ALTER TABLE "marking_scheme_versions"
  ADD CONSTRAINT "marking_scheme_versions_nonnegative_maximum" CHECK ("maximum_mark" >= 0);
ALTER TABLE "marking_scheme_items"
  ADD CONSTRAINT "marking_scheme_items_nonnegative_maximum" CHECK ("maximum_mark" >= 0),
  ADD CONSTRAINT "marking_scheme_items_positive_order" CHECK ("display_order" > 0),
  ADD CONSTRAINT "marking_scheme_items_target" CHECK (
    ("question_id" IS NOT NULL AND "question_part_id" IS NULL)
    OR ("question_id" IS NOT NULL AND "question_part_id" IS NOT NULL)
  );
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_positive_order" CHECK ("display_order" > 0);
ALTER TABLE "question_parts"
  ADD CONSTRAINT "question_parts_positive_order" CHECK ("display_order" > 0);
ALTER TABLE "mark_sheets"
  ADD CONSTRAINT "mark_sheets_positive_attempt" CHECK ("attempt" > 0),
  ADD CONSTRAINT "mark_sheets_nonnegative_written_total" CHECK ("handwritten_total" IS NULL OR "handwritten_total" >= 0);
ALTER TABLE "mark_sheet_images"
  ADD CONSTRAINT "mark_sheet_images_positive_page" CHECK ("page_number" > 0);
ALTER TABLE "file_objects"
  ADD CONSTRAINT "file_objects_nonnegative_size" CHECK ("size_bytes" >= 0),
  ADD CONSTRAINT "file_objects_sha256_format" CHECK ("checksum_sha256" ~ '^[0-9a-fA-F]{64}$');
ALTER TABLE "ai_model_versions"
  ADD CONSTRAINT "ai_model_versions_sha256_format" CHECK (
    "checksum_sha256" IS NULL OR "checksum_sha256" ~ '^[0-9a-fA-F]{64}$'
  );
ALTER TABLE "extracted_marks"
  ADD CONSTRAINT "extracted_marks_nonnegative_value" CHECK ("extracted_value" IS NULL OR "extracted_value" >= 0),
  ADD CONSTRAINT "extracted_marks_confidence_range" CHECK (
    "confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)
  );
ALTER TABLE "mark_values"
  ADD CONSTRAINT "mark_values_nonnegative" CHECK ("value" >= 0);
ALTER TABLE "calculation_results"
  ADD CONSTRAINT "calculation_results_nonnegative_values" CHECK (
    "grand_total" >= 0 AND "maximum_mark" >= 0 AND "percentage" >= 0
  ),
  ADD CONSTRAINT "calculation_results_sha256_format" CHECK ("input_digest" ~ '^[0-9a-fA-F]{64}$');
ALTER TABLE "processing_jobs"
  ADD CONSTRAINT "processing_jobs_nonnegative_attempts" CHECK ("attempt_count" >= 0);

-- PostgreSQL's NULL semantics require partial indexes for one question-level item
-- and one item per concrete question part in each marking-scheme version.
CREATE UNIQUE INDEX "marking_scheme_items_unique_question_target"
  ON "marking_scheme_items" ("tenant_id", "marking_scheme_version_id", "question_id")
  WHERE "question_part_id" IS NULL;
CREATE UNIQUE INDEX "marking_scheme_items_unique_part_target"
  ON "marking_scheme_items" ("tenant_id", "marking_scheme_version_id", "question_part_id")
  WHERE "question_part_id" IS NOT NULL;

-- Every tenant-scoped relationship is checked at the database boundary. UUIDs are
-- globally unique, but this trigger also prevents a child row from carrying a false
-- tenant_id when it references another tenant's parent row.
CREATE FUNCTION "assert_same_tenant"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  referenced_tenant uuid;
  referenced_id uuid;
BEGIN
  referenced_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  IF referenced_id IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', TG_ARGV[0])
    INTO referenced_tenant USING referenced_id;
  IF referenced_tenant IS NULL OR referenced_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'tenant mismatch for %.%', TG_TABLE_NAME, TG_ARGV[1]
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "install_tenant_guard"(child_table regclass, parent_table text, fk_column text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF tenant_id, %I ON %s '
    'FOR EACH ROW EXECUTE FUNCTION assert_same_tenant(%L, %L)',
    'tenant_guard_' || fk_column, fk_column, child_table, parent_table, fk_column
  );
END;
$$;

SELECT "install_tenant_guard"('colleges', 'universities', 'university_id');
SELECT "install_tenant_guard"('departments', 'colleges', 'college_id');
SELECT "install_tenant_guard"('programs', 'departments', 'department_id');
SELECT "install_tenant_guard"('semesters', 'academic_years', 'academic_year_id');
SELECT "install_tenant_guard"('classes', 'programs', 'program_id');
SELECT "install_tenant_guard"('classes', 'academic_years', 'academic_year_id');
SELECT "install_tenant_guard"('classes', 'study_years', 'study_year_id');
SELECT "install_tenant_guard"('classes', 'semesters', 'semester_id');
SELECT "install_tenant_guard"('sections', 'classes', 'class_id');
SELECT "install_tenant_guard"('students', 'departments', 'department_id');
SELECT "install_tenant_guard"('students', 'programs', 'program_id');
SELECT "install_tenant_guard"('students', 'sections', 'section_id');
SELECT "install_tenant_guard"('subjects', 'departments', 'department_id');
SELECT "install_tenant_guard"('subject_offerings', 'subjects', 'subject_id');
SELECT "install_tenant_guard"('subject_offerings', 'programs', 'program_id');
SELECT "install_tenant_guard"('subject_offerings', 'academic_years', 'academic_year_id');
SELECT "install_tenant_guard"('subject_offerings', 'semesters', 'semester_id');
SELECT "install_tenant_guard"('subject_offerings', 'sections', 'section_id');
SELECT "install_tenant_guard"('question_papers', 'subjects', 'subject_id');
SELECT "install_tenant_guard"('question_paper_versions', 'question_papers', 'question_paper_id');
SELECT "install_tenant_guard"('questions', 'question_paper_versions', 'question_paper_version_id');
SELECT "install_tenant_guard"('question_parts', 'questions', 'question_id');
SELECT "install_tenant_guard"('marking_schemes', 'question_papers', 'question_paper_id');
SELECT "install_tenant_guard"('marking_scheme_versions', 'marking_schemes', 'marking_scheme_id');
SELECT "install_tenant_guard"('marking_scheme_items', 'marking_scheme_versions', 'marking_scheme_version_id');
SELECT "install_tenant_guard"('marking_scheme_items', 'questions', 'question_id');
SELECT "install_tenant_guard"('mark_sheets', 'students', 'student_id');
SELECT "install_tenant_guard"('mark_sheets', 'subject_offerings', 'subject_offering_id');
SELECT "install_tenant_guard"('mark_sheets', 'question_paper_versions', 'question_paper_version_id');
SELECT "install_tenant_guard"('mark_sheets', 'marking_scheme_versions', 'marking_scheme_version_id');
SELECT "install_tenant_guard"('mark_sheet_images', 'mark_sheets', 'mark_sheet_id');
SELECT "install_tenant_guard"('mark_sheet_images', 'file_objects', 'file_object_id');
SELECT "install_tenant_guard"('extracted_marks', 'mark_sheets', 'mark_sheet_id');
SELECT "install_tenant_guard"('extracted_marks', 'marking_scheme_items', 'marking_scheme_item_id');
SELECT "install_tenant_guard"('extracted_marks', 'questions', 'question_id');
SELECT "install_tenant_guard"('mark_values', 'extracted_marks', 'extracted_mark_id');
SELECT "install_tenant_guard"('verification_sessions', 'mark_sheets', 'mark_sheet_id');
SELECT "install_tenant_guard"('verification_items', 'verification_sessions', 'verification_session_id');
SELECT "install_tenant_guard"('verification_items', 'extracted_marks', 'extracted_mark_id');
SELECT "install_tenant_guard"('calculation_results', 'mark_sheets', 'mark_sheet_id');
SELECT "install_tenant_guard"('processing_jobs', 'mark_sheets', 'mark_sheet_id');
SELECT "install_tenant_guard"('exports', 'file_objects', 'file_object_id');
DROP FUNCTION "install_tenant_guard"(regclass, text, text);

-- Published paper/scheme structures and append-only examination history cannot be
-- changed in place. A new version/value/log row must be created instead.
CREATE FUNCTION "reject_immutable_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "mark_values_append_only"
  BEFORE UPDATE OR DELETE ON "mark_values"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_change"();
CREATE TRIGGER "audit_logs_append_only"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_change"();

CREATE FUNCTION "protect_published_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'published % version is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "question_paper_versions_immutable"
  BEFORE UPDATE OR DELETE ON "question_paper_versions"
  FOR EACH ROW EXECUTE FUNCTION "protect_published_version"();
CREATE TRIGGER "marking_scheme_versions_immutable"
  BEFORE UPDATE OR DELETE ON "marking_scheme_versions"
  FOR EACH ROW EXECUTE FUNCTION "protect_published_version"();

CREATE FUNCTION "protect_published_child"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_status "VersionStatus";
  parent_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    parent_id := (to_jsonb(OLD) ->> TG_ARGV[1])::uuid;
  ELSE
    parent_id := (to_jsonb(NEW) ->> TG_ARGV[1])::uuid;
  END IF;
  EXECUTE format('SELECT status FROM %I WHERE id = $1', TG_ARGV[0])
    INTO parent_status USING parent_id;
  IF parent_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'children of published % are immutable', TG_ARGV[0] USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "questions_published_parent_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "questions"
  FOR EACH ROW EXECUTE FUNCTION "protect_published_child"('question_paper_versions', 'question_paper_version_id');
CREATE TRIGGER "scheme_items_published_parent_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "marking_scheme_items"
  FOR EACH ROW EXECUTE FUNCTION "protect_published_child"('marking_scheme_versions', 'marking_scheme_version_id');

CREATE FUNCTION "protect_published_question_part"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  version_status "VersionStatus";
  target_question_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_question_id := OLD.question_id;
  ELSE
    target_question_id := NEW.question_id;
  END IF;
  SELECT qpv.status INTO version_status
  FROM "questions" q
  JOIN "question_paper_versions" qpv ON qpv.id = q.question_paper_version_id
  WHERE q.id = target_question_id;
  IF version_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'parts of published question-paper versions are immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "question_parts_published_parent_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "question_parts"
  FOR EACH ROW EXECUTE FUNCTION "protect_published_question_part"();

CREATE FUNCTION "validate_scheme_item_references"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  part_question_id uuid;
  parent_version_id uuid;
  parent_question_id uuid;
BEGIN
  IF NEW.question_part_id IS NOT NULL THEN
    SELECT question_id INTO part_question_id FROM "question_parts" WHERE id = NEW.question_part_id;
    IF part_question_id IS DISTINCT FROM NEW.question_id THEN
      RAISE EXCEPTION 'scheme item question part does not belong to its question'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.parent_item_id IS NOT NULL THEN
    SELECT marking_scheme_version_id, question_id
      INTO parent_version_id, parent_question_id
      FROM "marking_scheme_items" WHERE id = NEW.parent_item_id;
    IF parent_version_id IS DISTINCT FROM NEW.marking_scheme_version_id
       OR parent_question_id IS DISTINCT FROM NEW.question_id THEN
      RAISE EXCEPTION 'scheme item parent must belong to the same version and question'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "scheme_items_validate_references"
  BEFORE INSERT OR UPDATE ON "marking_scheme_items"
  FOR EACH ROW EXECUTE FUNCTION "validate_scheme_item_references"();

CREATE FUNCTION "validate_question_paper_scheme_binding"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  scheme_question_paper_id uuid;
BEGIN
  IF NEW.marking_scheme_version_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT ms.question_paper_id INTO scheme_question_paper_id
  FROM "marking_scheme_versions" msv
  JOIN "marking_schemes" ms ON ms.id = msv.marking_scheme_id
  WHERE msv.id = NEW.marking_scheme_version_id;
  IF scheme_question_paper_id IS DISTINCT FROM NEW.question_paper_id THEN
    RAISE EXCEPTION 'marking scheme version belongs to another question paper'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "question_paper_versions_validate_scheme"
  BEFORE INSERT OR UPDATE ON "question_paper_versions"
  FOR EACH ROW EXECUTE FUNCTION "validate_question_paper_scheme_binding"();

CREATE FUNCTION "validate_mark_sheet_versions"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  bound_scheme_id uuid;
BEGIN
  SELECT marking_scheme_version_id INTO bound_scheme_id
  FROM "question_paper_versions" WHERE id = NEW.question_paper_version_id;
  IF bound_scheme_id IS NULL OR bound_scheme_id <> NEW.marking_scheme_version_id THEN
    RAISE EXCEPTION 'mark sheet versions are not bound to each other'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "mark_sheets_validate_versions"
  BEFORE INSERT OR UPDATE OF question_paper_version_id, marking_scheme_version_id
  ON "mark_sheets" FOR EACH ROW EXECUTE FUNCTION "validate_mark_sheet_versions"();

-- Phase 3 can activate RLS per request by setting app.tenant_id transaction-locally.
CREATE FUNCTION "current_app_tenant_id"() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colleges" ADD CONSTRAINT "colleges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colleges" ADD CONSTRAINT "colleges_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "colleges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_years" ADD CONSTRAINT "study_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_study_year_id_fkey" FOREIGN KEY ("study_year_id") REFERENCES "study_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_offerings" ADD CONSTRAINT "subject_offerings_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_papers" ADD CONSTRAINT "question_papers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_versions" ADD CONSTRAINT "question_paper_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_versions" ADD CONSTRAINT "question_paper_versions_question_paper_id_fkey" FOREIGN KEY ("question_paper_id") REFERENCES "question_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_versions" ADD CONSTRAINT "question_paper_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_versions" ADD CONSTRAINT "question_paper_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paper_versions" ADD CONSTRAINT "question_paper_versions_marking_scheme_version_id_fkey" FOREIGN KEY ("marking_scheme_version_id") REFERENCES "marking_scheme_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_question_paper_version_id_fkey" FOREIGN KEY ("question_paper_version_id") REFERENCES "question_paper_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_parts" ADD CONSTRAINT "question_parts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_parts" ADD CONSTRAINT "question_parts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_schemes" ADD CONSTRAINT "marking_schemes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_schemes" ADD CONSTRAINT "marking_schemes_question_paper_id_fkey" FOREIGN KEY ("question_paper_id") REFERENCES "question_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_versions" ADD CONSTRAINT "marking_scheme_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_versions" ADD CONSTRAINT "marking_scheme_versions_marking_scheme_id_fkey" FOREIGN KEY ("marking_scheme_id") REFERENCES "marking_schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_versions" ADD CONSTRAINT "marking_scheme_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_versions" ADD CONSTRAINT "marking_scheme_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_items" ADD CONSTRAINT "marking_scheme_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_items" ADD CONSTRAINT "marking_scheme_items_marking_scheme_version_id_fkey" FOREIGN KEY ("marking_scheme_version_id") REFERENCES "marking_scheme_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_items" ADD CONSTRAINT "marking_scheme_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_items" ADD CONSTRAINT "marking_scheme_items_question_part_id_fkey" FOREIGN KEY ("question_part_id") REFERENCES "question_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marking_scheme_items" ADD CONSTRAINT "marking_scheme_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "marking_scheme_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheets" ADD CONSTRAINT "mark_sheets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheets" ADD CONSTRAINT "mark_sheets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheets" ADD CONSTRAINT "mark_sheets_subject_offering_id_fkey" FOREIGN KEY ("subject_offering_id") REFERENCES "subject_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheets" ADD CONSTRAINT "mark_sheets_question_paper_version_id_fkey" FOREIGN KEY ("question_paper_version_id") REFERENCES "question_paper_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheets" ADD CONSTRAINT "mark_sheets_marking_scheme_version_id_fkey" FOREIGN KEY ("marking_scheme_version_id") REFERENCES "marking_scheme_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheet_images" ADD CONSTRAINT "mark_sheet_images_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheet_images" ADD CONSTRAINT "mark_sheet_images_mark_sheet_id_fkey" FOREIGN KEY ("mark_sheet_id") REFERENCES "mark_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_sheet_images" ADD CONSTRAINT "mark_sheet_images_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_versions" ADD CONSTRAINT "ai_model_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_versions" ADD CONSTRAINT "ai_model_versions_artifact_file_id_fkey" FOREIGN KEY ("artifact_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_mark_sheet_id_fkey" FOREIGN KEY ("mark_sheet_id") REFERENCES "mark_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_marking_scheme_item_id_fkey" FOREIGN KEY ("marking_scheme_item_id") REFERENCES "marking_scheme_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_question_part_id_fkey" FOREIGN KEY ("question_part_id") REFERENCES "question_parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_source_image_id_fkey" FOREIGN KEY ("source_image_id") REFERENCES "mark_sheet_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_marks" ADD CONSTRAINT "extracted_marks_ai_model_version_id_fkey" FOREIGN KEY ("ai_model_version_id") REFERENCES "ai_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_values" ADD CONSTRAINT "mark_values_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_values" ADD CONSTRAINT "mark_values_extracted_mark_id_fkey" FOREIGN KEY ("extracted_mark_id") REFERENCES "extracted_marks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark_values" ADD CONSTRAINT "mark_values_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_mark_sheet_id_fkey" FOREIGN KEY ("mark_sheet_id") REFERENCES "mark_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_sessions" ADD CONSTRAINT "verification_sessions_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_verification_session_id_fkey" FOREIGN KEY ("verification_session_id") REFERENCES "verification_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_extracted_mark_id_fkey" FOREIGN KEY ("extracted_mark_id") REFERENCES "extracted_marks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_items" ADD CONSTRAINT "verification_items_selected_mark_value_id_fkey" FOREIGN KEY ("selected_mark_value_id") REFERENCES "mark_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_results" ADD CONSTRAINT "calculation_results_mark_sheet_id_fkey" FOREIGN KEY ("mark_sheet_id") REFERENCES "mark_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_mark_sheet_id_fkey" FOREIGN KEY ("mark_sheet_id") REFERENCES "mark_sheets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_ai_model_version_id_fkey" FOREIGN KEY ("ai_model_version_id") REFERENCES "ai_model_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
