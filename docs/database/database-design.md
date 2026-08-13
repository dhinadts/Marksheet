# PostgreSQL and Prisma database design

## Design guarantees

- UUID primary keys and timezone-aware timestamps are used throughout.
- Every organization-owned row carries `tenant_id` and an indexed ownership path.
- Database triggers reject cross-tenant parent relationships even when a caller supplies
  an otherwise valid UUID.
- Published question-paper and marking-scheme versions cannot be changed in place.
- AI output, later human values, verification decisions, calculations, and audit events
  remain distinct and reproducible.
- Marks use `numeric(7,2)`, never floating point.
- Images and exports are represented by private object-storage metadata, not database
  binary columns.

## Principal relationships

```mermaid
erDiagram
    TENANT ||--o{ UNIVERSITY : owns
    UNIVERSITY ||--o{ COLLEGE : contains
    COLLEGE ||--o{ DEPARTMENT : contains
    DEPARTMENT ||--o{ PROGRAM : offers
    PROGRAM ||--o{ CLASS : organizes
    CLASS ||--o{ SECTION : contains
    SECTION ||--o{ STUDENT : enrolls
    DEPARTMENT ||--o{ SUBJECT : owns
    SUBJECT ||--o{ SUBJECT_OFFERING : schedules
    SECTION ||--o{ SUBJECT_OFFERING : receives
    SUBJECT ||--o{ QUESTION_PAPER : has
    QUESTION_PAPER ||--o{ QUESTION_PAPER_VERSION : versions
    QUESTION_PAPER_VERSION ||--o{ QUESTION : defines
    QUESTION ||--o{ QUESTION_PART : contains
    QUESTION_PAPER ||--o{ MARKING_SCHEME : has
    MARKING_SCHEME ||--o{ MARKING_SCHEME_VERSION : versions
    MARKING_SCHEME_VERSION ||--o{ MARKING_SCHEME_ITEM : configures
    QUESTION_PAPER_VERSION |o--o| MARKING_SCHEME_VERSION : binds
    STUDENT ||--o{ MARK_SHEET : owns
    SUBJECT_OFFERING ||--o{ MARK_SHEET : receives
    MARK_SHEET ||--o{ EXTRACTED_MARK : contains
    MARKING_SCHEME_ITEM ||--o{ EXTRACTED_MARK : constrains
    EXTRACTED_MARK ||--o{ MARK_VALUE : history
    MARK_SHEET ||--o{ VERIFICATION_SESSION : reviewed_in
    VERIFICATION_SESSION ||--o{ VERIFICATION_ITEM : contains
    MARK_SHEET ||--o{ CALCULATION_RESULT : calculates
    FILE_OBJECT ||--o{ MARK_SHEET_IMAGE : stores
```

## Versioning

A `question_paper_version` owns an ordered, arbitrary question tree. A
`marking_scheme_version` owns ordered items that reference either a question or one of
its parts. Non-scorable parent items carry the configured question maximum; scorable
children carry individually recordable maxima. Calculation code must sum only scorable
items and must use the version bound to the mark sheet.

Publication is a one-way integrity boundary in this phase. PostgreSQL triggers prevent
changes to a published version and its scheme items/questions. A correction therefore
requires a successor version, preserving historical mark-sheet interpretation.

## Individual mark history

`extracted_marks` contains the raw AI result, confidence, source image, bounding box,
model version, and workflow statuses. `mark_values` is append-only and records each AI,
reviewer, data-entry, calculation, or imported value. A later verification item selects
the accepted value; it does not overwrite the source extraction.

## Tenant isolation and RLS preparation

All tenant-owned entities carry `tenant_id`. The initial migration installs triggers on
relationships to reject a tenant mismatch at insert/update time. It also provides
`current_app_tenant_id()`, which reads the transaction-local `app.tenant_id` setting.

Phase 3 must authenticate the actor, set `app.tenant_id` transaction-locally, activate
and force PostgreSQL RLS policies, and test both application and database roles. RLS is
not activated before authenticated tenant context exists, because doing so would either
block migrations/seeding or encourage an unsafe bypass role.

## Seed data

The repeatable seed creates Demo University, Demo Engineering College, Computer Science
and Engineering, B.E. CSE, academic year 2025–2026, III CSE A, Biofuel and Bioenergy
(`023BTV37`), paper `Q0013`, 20 students, system roles/permissions, and a published
scheme version. Q1–Q10 are 2 marks each; Q11–Q15 are 13 marks each; Q16 is 15 marks.
For demonstration, Q11–Q16 each have two configured parts whose maxima add to their
parent maximum. These values are rows in the seed—not business-code constants.
