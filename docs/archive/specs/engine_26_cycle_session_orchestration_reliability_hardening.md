# Engine 26: Cycle And Session Orchestration Reliability Hardening

## Goal

Harden the app-owned cycle/session orchestration path for private beta: generation, completion, idempotency, rollback, trace persistence, normalized state sync, and compatibility projection updates.

The Rust engine remains pure and deterministic. Engine 26 focuses on the app shell around it.

## Status

- `State`: Complete
- `Priority`: Critical
- `Depends On`:
  - `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
  - `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
  - `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`
  - `docs/archive/specs/engine_16_operational_release_hardening.md`

## GitNexus Grounding

GitNexus context used for this spec:

- `/api/v0/sessions/generate` routes to `handleGenerateSession` and flows through active-cycle loading, targeted request checks, and cycle slot construction.
- `/api/v0/sessions/complete` routes to `handleCompleteSession` and flows through seed normalization, active-cycle loading, default stats resolution, and completion persistence.
- `handleCompleteSession` calls `runEngineInput`, `persistEngineSessionTrace`, `syncNormalizedCycleCompletion`, `persistCycleCompatibilityProjection`, `rollbackWorkoutLog`, and `complete_session_atomic`.
- `handleGenerateSession` calls `runEngineInput`, `parseEnginePlanSessionOutput`, and `persistEngineSessionTrace`.
- GitNexus impact reports for `handleGenerateSession` and `handleCompleteSession` are LOW for direct callers, but these are beta-critical flows because they touch app persistence, replay traces, normalized cycle state, and compatibility projection.

## Boundary Decision

Engine 26 is an app orchestration reliability slice.

This spec keeps unchanged:

- Rust engine purity and no-IO rule
- engine public envelopes
- RLS-backed app persistence ownership
- cookie-only auth and edge validation rules

This spec defines:

- idempotency behavior for duplicate completion requests
- rollback behavior when post-engine persistence partially fails
- trace persistence requirements for plan and completion paths
- normalized cycle sync failure handling
- compatibility projection failure handling
- release-confidence scenarios for beta-critical session flows

## Reliability Rules

- Duplicate completions with the same idempotency key must return the existing workout result or a typed reused result without double-applying normalized progression, gamification, or compatibility projection.
- If the workout log is written but normalized cycle sync fails, the app must either roll back the workout write or return a typed partial-failure state with enough replay evidence for manual repair.
- Trace persistence failure must be visible in logs or response errors for beta-critical paths. It must not silently claim full replay evidence exists.
- Compatibility projection failure must not corrupt normalized cycle state. Normalized state remains authoritative.
- Cycle-backed generation should not persist filled sessions with replay receipts that cannot be matched to the generated cycle session.
- All fallback from cycle-backed flow to legacy flow must be explicit and tested.

## Implementation Direction

- Audit `handleCompleteSession` branches around RPC success, RPC fallback, normalized sync, projection persistence, and rollback.
- Add or strengthen tests in the existing session reliability suites for duplicate completion, trace failure, projection failure, sync failure, and rollback failure.
- Add release-smoke assertions or diagnostics that prove a generated session can be completed once and re-submitted idempotently.
- Keep app-level errors typed and actionable. Avoid generic success responses when normalized or trace evidence is incomplete.
- Keep changes scoped to `apps/web` and `packages/db` unless implementation discovery proves a contract smoke test is required.

## Verification And Acceptance Rules

Implementation acceptance requires:

- route/service tests for generation trace persistence and replay receipt association
- completion tests for idempotent retry, duplicate completion, RPC path, fallback path, normalized sync failure, projection failure, and rollback failure
- tests proving normalized state is not advanced twice
- tests proving compatibility projection is derived from normalized/app-owned state, not treated as canonical
- live Supabase E2E verification remains manual but should include generate, complete, retry/duplicate awareness where practical

Execution-side verification:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts` for release confidence

## Completion Target

Engine 26 closes when beta-critical generation and completion paths have explicit idempotency, rollback, trace, normalized sync, and projection behavior covered by tests and documented as app-owned orchestration around the deterministic Rust engine.
