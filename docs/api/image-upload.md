# Phase 8 mark-sheet image upload

Phase 8 adds an idempotent, tenant-scoped upload protocol. Original images travel directly
from the Flutter client to private S3-compatible object storage; credentials are never sent
to the client or stored in the repository.

## Protocol

1. `POST /mark-sheets/upload-sessions` with a UUID `clientRequestId`, selected context IDs,
   attempt, page number, media type, byte length, and lowercase or uppercase SHA-256 hex.
2. Upload the unchanged bytes to the returned `upload.url` using `PUT` and every returned
   header. The signed URL expires after `UPLOAD_URL_TTL_SECONDS`.
3. `POST /mark-sheets/{markSheetId}/upload-complete`. The API performs a signed `HEAD`
   request and compares byte length, content type, and `x-amz-meta-sha256` before changing
   the file and mark-sheet statuses.

Repeating step 1 with the same tenant and `clientRequestId` returns a new signature for the
same pending object only when every request parameter is identical. Reuse with different
parameters is rejected. Object keys begin with the authenticated tenant UUID. All database
lookups also include that tenant UUID, and create/complete actions append audit records.

## Configuration

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `AWS_S3_ENDPOINT` (optional for AWS; required for a custom compatible service)
- `AWS_S3_FORCE_PATH_STYLE` (`true` for services that require path-style URLs)
- `UPLOAD_URL_TTL_SECONDS` (60–3600, default 900)

The bucket must be private. Its CORS policy must allow mobile `PUT` requests with
`content-type` and `x-amz-meta-sha256`. Production credentials should come from the runtime
secret manager and should have access only to the configured bucket prefix.

## Current boundary

The mobile client attempts upload immediately when connected and retains a durable app-local
copy plus queue metadata after failures. Automatic background retry and encrypted image-at-
rest storage are not yet implemented. OCR, mark extraction, and mark finalization are outside
Phase 8; a successful upload only moves the mark sheet to `UPLOADED`.
