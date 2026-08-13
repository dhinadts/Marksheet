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
