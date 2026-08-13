# API documentation

OpenAPI documentation is available at `/api/docs` while the backend is running.

Phase 3 endpoints:

- `POST /auth/login` — tenant-qualified password login
- `POST /auth/refresh` — one-time refresh-token rotation
- `POST /auth/logout` — revoke a refresh-token family
- `GET /auth/me` — return the authenticated account profile

Login and refresh endpoints have stricter rate limits. Protected endpoints require a
Bearer access token. Validation failures and HTTP exceptions use a consistent JSON
error envelope.
# Phase 4 and Phase 5 API

All routes below require a bearer access token and are tenant-scoped from the verified
token claim. `master_data.read` protects catalog reads, `master_data.manage` protects
catalog writes, and question-paper routes use `question_paper.read` or
`question_paper.manage`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/catalog/:resource` | Paginated catalog list |
| POST | `/catalog/:resource` | Create a hierarchy, student, subject, or offering record |
| PATCH | `/catalog/:resource/:id` | Update with `expectedUpdatedAt` |
| PATCH | `/catalog/:resource/:id/status` | Activate/deactivate without deletion |
| POST | `/catalog/students/import/validate` | Validate CSV rows without importing |
| GET/POST | `/question-papers` | List/create paper identities |
| POST | `/question-papers/:id/versions` | Create a nested draft version |
| GET | `/question-papers/:id/versions/:version` | Preview the ordered structure |
| POST | `/question-papers/:id/versions/:version/publish` | Publish an immutable version |
| GET/POST | `/marking-schemes` | List/create marking-scheme identities |
| POST | `/marking-schemes/:id/versions` | Validate and create a draft scheme version |
| GET | `/marking-schemes/:id/versions/:version` | Preview configured items and derived totals |
| POST | `/marking-schemes/:id/versions/:version/publish` | Publish an immutable scheme |

Parent identifiers are checked inside the same tenant transaction. Every successful
create, update, lifecycle change, and publication creates an append-only audit record.
Prisma unique and foreign-key constraints remain the final integrity boundary.

Scheme items use request-local `clientKey` and optional `parentClientKey` values to express
arbitrary question-part hierarchies. These keys are resolved to UUID relationships during
one database transaction and are not persisted as business identifiers. The API derives
group and paper totals from root item maximums and never accepts an OCR-extracted total.
