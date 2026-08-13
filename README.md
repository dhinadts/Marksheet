# AI-MARKS

AI Examination Marks Digitization & Valuation System is a multi-tenant SaaS platform for capturing examination mark sheets, extracting individual handwritten marks, validating them, and completing human-controlled verification and export workflows.

This repository currently contains **Phase 1: the monorepo foundation**. Database modeling, authentication, marking-scheme persistence, OCR, and production workflows belong to later phases and are intentionally not claimed as complete.

## Applications

| Directory | Technology | Purpose |
| --- | --- | --- |
| `frontend/` | Next.js, React, TypeScript, Tailwind CSS | Administrative and review dashboard |
| `backend/` | NestJS, TypeScript | Main API and business layer |
| `mobile/` | Flutter, Dart | Capture and mobile verification client |
| `ai-service/` | FastAPI, Python | Isolated image-processing and inference service |
| `database/` | PostgreSQL assets | Migrations, seed support, and database documentation |
| `infrastructure/` | Docker and future Terraform | Local and production infrastructure |

## Configurable marking schemes

Question numbers, parts, and maximum marks are domain data—not constants in application code. For the sample paper, an administrator creates a scheme with Q1–Q10 at 2 marks each, Q11–Q15 at 13 marks each, and Q16 at 15 marks. A different paper creates a different scheme without a software release. See `docs/architecture/marking-scheme.md`.

## Prerequisites

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

## Verification

```sh
npm run build
npm run lint
npm run typecheck
npm test
python -m pytest ai-service/tests
python -m ruff check ai-service
python -m mypy ai-service/app
cd mobile && flutter analyze && flutter test
docker compose config
```

On Windows without `make`, run these commands directly. The Makefile provides equivalent shortcuts on environments that include GNU Make.

