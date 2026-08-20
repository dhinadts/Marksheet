# Security

Phase 3 implements tenant-qualified password authentication, short-lived access JWTs,
opaque rotating refresh tokens, replay detection, logout/revocation, account lockout,
permission guards, request tenant context, rate limiting, CORS allowlists, security
headers, DTO validation, and authentication audit events.

Passwords use Argon2id. Refresh tokens are stored only as SHA-256 digests. Reuse of a
rotated token revokes its full family and increments `users.token_version`, invalidating
previously issued access tokens. Access JWTs contain the tenant, roles, permissions, and
token version; guards also re-check active account state and token version.

Development administrators are seeded only when `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` are supplied. Production secrets must come from environment-
specific secret management and must never be committed. AI output never bypasses
validation or authorized human verification.

PostgreSQL relationship triggers continue to enforce tenant consistency. The request
context exposes a transaction helper that sets `app.tenant_id` transaction-locally for
future RLS-protected repositories. Full RLS policy activation remains coupled to the
Phase 4 repository layer so ordinary Prisma queries cannot accidentally run outside the
tenant transaction wrapper.
# Phase 13–14 controls

Review and calculation lookups include `tenantId` in every root query, and nested writes
are reached only from those tenant-scoped roots. Permissions separate reading, reviewing,
and final authorization. Optimistic lock versions reject stale review submissions. Mark
corrections and calculation/mismatch decisions are append-only and audit logged with the
actor and reason. Signed image downloads are short-lived; credentials and object keys are
not embedded in frontend source.

Phase 15 report roots include authenticated `tenantId`; nested organization filters cannot
widen that boundary. Student detail verifies tenant ownership first, and `report.read`
protects all reporting routes. Reports are read-only views of approved marks and immutable
calculations.

Phase 16 export records, source queries, files, and status lookups are tenant-scoped.
`export.create` is required, unverified scopes are rejected atomically, generated files
are SHA-256 checksummed in private object storage, and downloads use short-lived signed
URLs. Request, completion, and failure transitions are audit logged.
# Phase 17 security baseline

Production startup fails closed when database, Redis, JWT, internal AI, object-storage,
or CORS settings are absent. Wildcard CORS, short JWT secrets, and development database
placeholders are rejected. Helmet headers, rate limiting, DTO whitelisting, password
hashing, refresh-token rotation, permission guards, private signed storage, audit history,
and tenant-scoped queries form the application baseline. Secrets must be injected from a
managed secret store and never committed.
