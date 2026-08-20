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

| Method   | Route                                            | Purpose                                                  |
| -------- | ------------------------------------------------ | -------------------------------------------------------- |
| GET      | `/catalog/:resource`                             | Paginated catalog list                                   |
| POST     | `/catalog/:resource`                             | Create a hierarchy, student, subject, or offering record |
| PATCH    | `/catalog/:resource/:id`                         | Update with `expectedUpdatedAt`                          |
| PATCH    | `/catalog/:resource/:id/status`                  | Activate/deactivate without deletion                     |
| POST     | `/catalog/students/import/validate`              | Validate CSV rows without importing                      |
| GET/POST | `/question-papers`                               | List/create paper identities                             |
| POST     | `/question-papers/:id/versions`                  | Create a nested draft version                            |
| GET      | `/question-papers/:id/versions/:version`         | Preview the ordered structure                            |
| POST     | `/question-papers/:id/versions/:version/publish` | Publish an immutable version                             |
| GET/POST | `/marking-schemes`                               | List/create marking-scheme identities                    |
| POST     | `/marking-schemes/:id/versions`                  | Validate and create a draft scheme version               |
| GET      | `/marking-schemes/:id/versions/:version`         | Preview configured items and derived totals              |
| POST     | `/marking-schemes/:id/versions/:version/publish` | Publish an immutable scheme                              |

Parent identifiers are checked inside the same tenant transaction. Every successful
create, update, lifecycle change, and publication creates an append-only audit record.
Prisma unique and foreign-key constraints remain the final integrity boundary.

Scheme items use request-local `clientKey` and optional `parentClientKey` values to express
arbitrary question-part hierarchies. These keys are resolved to UUID relationships during
one database transaction and are not persisted as business identifiers. The API derives
group and paper totals from root item maximums and never accepts an OCR-extracted total.
# Review and calculation

All routes require a bearer token and are tenant-scoped by the authenticated tenant.

- `POST /mark-sheets/:id/extractions` ingests one advisory AI result set and creates a review session (`mark.review`). Existing extraction history cannot be replaced.
- `GET /mark-sheets/:id/review` returns signed images, the current session, dynamic scheme items, and complete value history (`mark_sheet.read`).
- `PATCH /verification-sessions/:sessionId/items/:itemId` appends and selects a reviewer value; requires a reason and expected lock version (`mark.review`).
- `POST /verification-sessions/:id/submit` requires every individual item to have a selected value (`mark.review`).
- `POST /verification-sessions/:id/approve` authorizes the verified set (`mark.verify`).
- `POST /mark-sheets/:id/calculations` creates or returns the idempotent calculation for the approved values (`mark.verify`).
- `GET /mark-sheets/:id/calculations/latest` reads the newest immutable version (`mark_sheet.read`).
- `POST /calculations/:id/resolve-total-mismatch` records a reasoned decision as a successor version (`mark.verify`).

Question labels, parts, maximums, groups, paper maximums, and confidence statuses come
from versioned data. The calculation endpoint never uses OCR or handwritten totals as its
grand total.

# Reports

All report endpoints require `report.read` and derive tenant identity from the token.

- `GET /reports/summary` returns cards, confidence, and hierarchy breakdowns.
- `GET /reports/classes` returns a paginated student/subject result table.
- `GET /reports/students/:id` returns dynamic question/part marks and calculated totals.

Filters cover organization and academic hierarchy UUIDs, subject/offering UUIDs, search,
page, and page size. These routes return JSON data; file exports belong to Phase 16.
