# Testing strategy

Each application owns unit tests. Cross-service integration, E2E, AI evaluation, and performance suites live under the root `tests/` tree as those capabilities are implemented.
# Phase 13–14 coverage

Backend unit tests verify append-only reviewer corrections and configured per-item maximum
validation. Calculation tests cover the administrator-configured 100-mark sample, group
totals, handwritten-total mismatch handling, incomplete/invalid inputs, and deterministic
digests. Run `npm test -- --runInBand` in `backend`, then lint, type-check, and build both
backend and frontend.

Phase 15 covers aggregation, hierarchy breakdowns, confidence summaries, tenant-scoped
report roots, and cross-tenant student-detail concealment.

Phase 16 tests dynamic question/group columns, CSV escaping, JSON output, XLSX ZIP/OpenXML
containers, PDF containers, and rejection of export scopes containing unverified marks.
