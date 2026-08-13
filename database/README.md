# Database

PostgreSQL is the system of record. The canonical Prisma schema, initial migration,
and seed implementation live in `backend/prisma/` so generation and NestJS database
access share one source of truth.

Mark values will be stored individually and marking schemes will be tenant-scoped, versioned configuration. No question number, subquestion layout, or maximum mark will be hard-coded.

The initial migration adds constraints and triggers beyond Prisma's schema language:
tenant-consistency guards, nonnegative/range checks, published-version immutability,
and append-only audit and mark-value history. RLS activation is reserved for the
authenticated tenant context introduced in Phase 3.
