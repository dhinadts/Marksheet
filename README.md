# AI-MARKS

AI Examination Marks Digitization & Valuation System is a multi-tenant SaaS platform for capturing examination mark sheets, extracting individual handwritten marks, validating them, and completing human-controlled verification and export workflows.

This repository contains the foundations through **Phase 15**: monorepo setup,
PostgreSQL/Prisma, authentication and RBAC, tenant-scoped master data, and
student/subject/question-paper management, plus administrator-managed marking-scheme
authoring and validation. OCR and production workflows belong to later phases and are
intentionally not claimed complete.

The Flutter client provides secure login, data-driven academic/paper selection, guided
camera capture, local image-quality preflight, durable offline queueing, and verified
direct-to-object-storage upload. OCR and mark extraction remain later-phase work.

The FastAPI service now provides configurable image-quality checks, document/perspective
correction, deskewing, contrast enhancement, versioned normalized template-cell extraction,
checksummed ONNX model loading, per-mark confidence/range validation, and a Redis-backed
asynchronous worker boundary. AI values remain advisory and always require the authorized
NestJS verification workflow before they can become final marks.

## Applications

| Directory         | Technology                               | Purpose                                              |
| ----------------- | ---------------------------------------- | ---------------------------------------------------- |
| `frontend/`       | Next.js, React, TypeScript, Tailwind CSS | Administrative and review dashboard                  |
| `backend/`        | NestJS, TypeScript                       | Main API and business layer                          |
| `mobile/`         | Flutter, Dart                            | Capture and mobile verification client               |
| `ai-service/`     | FastAPI, Python                          | Isolated image-processing and inference service      |
| `database/`       | PostgreSQL assets                        | Migrations, seed support, and database documentation |
| `infrastructure/` | Docker and future Terraform              | Local and production infrastructure                  |
| `assets/`         | Private development references           | Sample mark sheets and related non-training assets   |

## Configurable marking schemes

Question numbers, parts, and maximum marks are domain data—not constants in application code. For the sample paper, an administrator creates a scheme with Q1–Q10 at 2 marks each, Q11–Q15 at 13 marks each, and Q16 at 15 marks. A different paper creates a different scheme without a software release. See `docs/architecture/marking-scheme.md`.

## Prerequisites

Published question-paper and marking-scheme versions are immutable. Individual AI,
reviewer, and calculated values are stored as separate records so examination history
is preserved rather than overwritten.

- Node.js 20+
- Python 3.12+
- Flutter SDK
- Docker Desktop with Docker Compose

## Local setup

1. Copy `.env.example` to `.env` and replace development placeholders as appropriate.
2. Install application dependencies:

   ```sh
   npm install
   python -m pip install -e "./ai-service[dev]"
   cd mobile && flutter pub get
   ```

3. Run all services:

   ```sh
   docker compose up -d --build
   ```

4. Open the frontend at `http://localhost:3000`, backend at `http://localhost:3001`, and AI health endpoint at `http://localhost:8000/health`.

## Database

The canonical Prisma schema, migration, and idempotent development seed are in
`backend/prisma/`. Apply them from a network location where `DATABASE_URL` resolves:

```sh
npm run prisma:validate
npm run prisma:generate
npm run db:migrate
npm run db:seed
```

For local host commands, set `DATABASE_URL` to use `localhost`; the Compose backend
uses the `postgres` service hostname. The development seed creates the demo hierarchy,
roles and permissions, 20 students, and the configurable Q0013 marking scheme.

If `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are configured, seeding also creates a
development super administrator. Swagger is served at `http://localhost:3001/api/docs`.

## Phase 4 and 5 APIs

Authenticated catalog APIs are exposed under `/catalog/:resource`. Supported resources
are `universities`, `colleges`, `departments`, `programs`, `academic-years`,
`study-years`, `semesters`, `classes`, `sections`, `students`, `subjects`, and
`subject-offerings`. Lists accept `page`, `pageSize`, `search`, and `status`. Updates
require `expectedUpdatedAt` for optimistic concurrency; lifecycle changes use
`PATCH /catalog/:resource/:id/status`, so records are deactivated rather than deleted.

Question-paper APIs under `/question-papers` create paper identities and immutable,
dynamic versions with any number of questions and parts. Draft versions can be previewed
and published after a valid scheme has been published. Student CSV files can be preflighted without mutation at
`POST /catalog/students/import/validate`.

Marking-scheme APIs under `/marking-schemes` create versioned configurations against an
exact question-paper version. Publication validates individual question and part maximums,
parent/child totals, paper totals, group membership, and administrator-defined confidence
thresholds. Published versions and their items are immutable.

## Phase 8 image upload

Authenticated users with `mark_sheet.upload` can request a short-lived upload session at
`POST /mark-sheets/upload-sessions`, upload the image directly to configured S3-compatible
storage, and finalize verification at `POST /mark-sheets/:id/upload-complete`. The API
validates the tenant-owned student, offering, paper version, and scheme version before it
creates any records. Completion verifies the stored object's size, media type, and SHA-256
metadata; client-provided completion claims are not trusted. See
`docs/api/image-upload.md` for configuration and protocol details.

## Phase 13 review and Phase 14 calculation

Phase 13 accepts advisory extraction results for every scorable item in the selected
scheme and creates an assigned verification session. Reviewers compare the signed source
image with AI suggestions, and every correction appends a new mark value with its reason;
AI values and earlier corrections are never overwritten. The web review workspace is at
`/review/{markSheetId}` and reads `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).
The existing authentication flow must place the access token in session storage as
`ai_marks_access_token`.

Phase 14 calculates group and grand totals only from individual values in an approved
verification session. Results are immutable, versioned, and input-digested. A handwritten
total is comparison evidence only: mismatches require an authorized, reasoned resolution
and create another result version. See `docs/api/README.md` for endpoints.

## Phase 15 reports

Users with `report.read` can view tenant-scoped summary, hierarchy, class, subject, and
student reports. Reports use the newest immutable calculation per mark sheet and approved
individual mark values. The responsive dashboard is available at `/reports`. Report APIs
are documented in `docs/api/README.md`; file generation remains Phase 16 scope.

## Verification

```sh
npm run build
npm run lint
npm run typecheck
npm test
npm run test:database
python -m pytest ai-service/tests
python -m ruff check ai-service
python -m mypy ai-service/app
cd mobile && flutter analyze && flutter test
docker compose config
```

On Windows without `make`, run these commands directly. The Makefile provides equivalent shortcuts on environments that include GNU Make.
