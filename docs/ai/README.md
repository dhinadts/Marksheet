# AI service

Phase 9 establishes the isolated FastAPI service and its typed internal API contract. It
provides liveness/readiness probes, OpenAPI, internal service-key authentication,
correlation IDs, structured errors, strict source-object metadata, and tenant-prefix
validation.

The processing routes exist so later stages can evolve without changing transport paths,
but currently return `501 CAPABILITY_NOT_IMPLEMENTED` with their target phase. This is
intentional: Phase 9 does not claim image preprocessing, template/cell detection,
handwriting recognition, confidence accuracy, or asynchronous job execution.

## Endpoints

- `GET /health` — public liveness probe
- `GET /ready` — readiness and explicit capability manifest
- `POST /ai/quality-check` — Phase 10 capability boundary
- `POST /ai/preprocess` — Phase 10 capability boundary
- `POST /ai/detect-template` — Phase 11 capability boundary
- `POST /ai/detect-cells` — Phase 11 capability boundary
- `POST /ai/extract-marks` — Phase 12 capability boundary
- `POST /ai/validate-marks` — Phase 12 capability boundary
- `POST /ai/process-mark-sheet` — final asynchronous pipeline boundary
- `GET /ai/jobs/{job_id}` — job status boundary

All `/ai/*` routes require `X-AI-Service-Key`, configured through
`AI_INTERNAL_API_KEY` with at least 32 characters. The caller sends an object-storage
reference, never a public or caller-selected download URL. The source key must begin with
the same tenant UUID supplied in the processing context.
