# Spec 18: Backend Reliability Hardening

**Status:** COMPLETED (2026-02-14)
**Dependencies:** Spec 17

---

## Goal

Harden session completion and API runtime behavior for production reliability without breaking existing contracts.

---

## Implemented

- Added migration `packages/db/sql/010_sessions_complete_atomic_rpc.sql`:
  - `workout_logs.idempotency_key` column
  - partial unique index on `(user_id, idempotency_key)`
  - transactional RPC `public.complete_session_atomic(...)`
- Refactored `apps/web/src/modules/sessions/service.ts`:
  - `handleCompleteSession()` now accepts optional idempotency metadata
  - primary completion path uses `complete_session_atomic` RPC
  - compatibility fallback retained when RPC is missing in local/test contexts
- Added idempotency support on `POST /api/v0/sessions/complete` via optional `Idempotency-Key` header.
- Optimized `getRecentWorkoutHistory()` to enforce DB-side limit before parsing.
- Added migration `packages/db/sql/011_distributed_rate_limit.sql`:
  - `rate_limit_counters` table
  - RPC `consume_rate_limit(...)`
  - cleanup RPC `purge_expired_rate_limit_counters(...)`
- Replaced in-memory-only limiter implementation with DB-backed limiter in `apps/web/src/lib/security/rateLimit.ts` plus safe in-memory fallback.
- Added reliability-focused tests:
  - `apps/web/tests/session-completion-reliability.test.ts`
  - `apps/web/tests/rate-limit.test.ts`

---

## Acceptance Criteria

- [x] Session completion supports idempotent replay without duplicate history writes.
- [x] Primary session completion write path is atomic at DB function boundary.
- [x] Distributed rate limiting path exists and is callable from server runtime.
- [x] Route-level behavior remains backward compatible for existing consumers.
