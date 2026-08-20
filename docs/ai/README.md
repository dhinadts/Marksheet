# AI service

Phases 10–12 implement the image-processing and advisory inference pipeline behind the
authenticated Phase 9 API boundary.

Phase 10 decodes JPEG, PNG, and HEIC images; measures resolution, brightness, Laplacian
blur, glare, and visible document area; performs document perspective correction, deskew,
grayscale conversion, and CLAHE enhancement; and writes derived PNG objects to private
storage. Quality policy values are isolated in `QualityPolicy` and can be supplied by the
runtime composition layer.

Phase 11 uses a versioned `TemplateDefinition` supplied by the trusted NestJS business
layer. Every scorable cell has a normalized bounding box and UUID links to a marking-scheme
item, question, and optional question part. No question number, cell count, coordinate, or
maximum mark is embedded in the detector. Template matching rejects incompatible page
aspect ratios before extracting or storing crops.

Phase 12 loads only a configured ONNX artifact whose SHA-256 checksum matches runtime
configuration. Labels are configurable, so a reviewed model may represent marks beyond
single digits. Each inferred value is independently compared with its administrator-
supplied maximum and confidence thresholds. Results are always advisory and set
`requires_human_review=true`; they never write to PostgreSQL or finalize marks.

## Endpoints

- `GET /health` — public liveness probe
- `GET /ready` — readiness and explicit capability manifest
- `POST /ai/quality-check` — return pixel-derived quality metrics and retake reasons
- `POST /ai/preprocess` — store and return a derived, corrected PNG reference
- `POST /ai/detect-template` — validate the selected layout against the corrected page
- `POST /ai/detect-cells` — extract configured cells and store private crop objects
- `POST /ai/extract-marks` — run configured ONNX inference and validation synchronously
- `POST /ai/validate-marks` — classify supplied candidates using versioned limits/thresholds
- `POST /ai/process-mark-sheet` — idempotently enqueue a durable Redis Stream job
- `GET /ai/jobs/{job_id}?tenant_id={tenant_id}` — tenant-scoped job status/result

All `/ai/*` routes require `X-AI-Service-Key`, configured through
`AI_INTERNAL_API_KEY` with at least 32 characters. The caller sends an object-storage
reference, never a public or caller-selected download URL. The source key must begin with
the same tenant UUID supplied in the processing context.

## Model contract and honest evaluation

`AI_MODEL_PATH`, `AI_MODEL_CHECKSUM_SHA256`, and `AI_MODEL_LABELS` are mandatory for
recognition. The service fails closed if the artifact is absent, modified, unloadable, or
returns a shape that does not match the configured labels. This repository does not ship a
trained model and makes no accuracy claim. Model promotion requires a separately reviewed
dataset, metrics broken down by mark class and institution template, and an `AiModelVersion`
record in the business database.

## Asynchronous worker

The API persists idempotent job state and payloads in tenant-qualified Redis keys and adds
work to a capped Redis Stream. Run the worker with `python -m app.worker`, or locally with
`docker compose --profile ai-processing up ai-worker` after configuring storage, Redis, and
a checksummed model. NestJS remains responsible for authorization, database persistence,
auditing, review, totals, and finalization.
