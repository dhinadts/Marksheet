CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED');

ALTER TABLE "mark_sheets"
  ADD COLUMN "client_request_id" UUID;
UPDATE "mark_sheets" SET "client_request_id" = "id" WHERE "client_request_id" IS NULL;
ALTER TABLE "mark_sheets" ALTER COLUMN "client_request_id" SET NOT NULL;
ALTER TABLE "mark_sheets" ALTER COLUMN "status" SET DEFAULT 'PENDING_UPLOAD';
CREATE UNIQUE INDEX "mark_sheets_tenant_id_client_request_id_key"
  ON "mark_sheets"("tenant_id", "client_request_id");

ALTER TABLE "file_objects"
  ADD COLUMN "upload_status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "upload_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "uploaded_at" TIMESTAMPTZ(6);
UPDATE "file_objects"
SET "upload_status" = 'COMPLETED', "uploaded_at" = "created_at",
    "upload_expires_at" = "created_at" + INTERVAL '15 minutes'
WHERE "upload_expires_at" IS NULL;
ALTER TABLE "file_objects" ALTER COLUMN "upload_expires_at" SET NOT NULL;

CREATE INDEX "file_objects_tenant_id_upload_status_idx"
  ON "file_objects"("tenant_id", "upload_status");
