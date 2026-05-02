# Spec 20: API Consistency Cleanup (Non-Breaking)

**Status:** COMPLETED (2026-02-14)
**Dependencies:** Spec 19

---

## Goal

Consolidate repeated API handler patterns into shared route infrastructure while preserving existing contracts.

---

## Implemented

- Migrated all `/api/v0/*` handlers to shared route factory (`runAuthedRoute`) in `apps/web/src/lib/api/routeHandler.ts`.
- Standardized route concerns across endpoints:
  - auth lookup
  - distributed rate limiting
  - schema validation
  - structured logging
  - security headers
  - request-id response header
- Kept legacy compatibility behavior for `POST /api/v0/workouts/generate`:
  - legacy error body shape retained (`{ error: ... }`)
  - deprecation headers added (`Deprecation`, `Sunset`, `Link`)
- Added route compatibility regression tests:
  - `apps/web/tests/api-workouts-generate-legacy.test.ts`
  - existing route tests continue to assert status/body contract behavior

---

## Acceptance Criteria

- [x] Route implementation duplication reduced through shared API helper.
- [x] Existing API response shapes and status behavior remain stable.
- [x] Legacy workout route remains available with explicit deprecation signaling.
- [x] Security headers and request correlation are applied consistently on all route exits.
