# Engine 11 Hippocampus

## Status

- `complete`

## Supersession

- This Wave 2 implementation record is superseded by `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`.
- Normalized engine-owned tables are canonical for initialized-cycle identity, cursor state, and gamification; `users.stats_json.activeProgram` is compatibility-only when normalized state exists.

## Acceptance targets

- `POST /api/v0/sessions/initialize` is authenticated and validated.
- The app persists cycle state into normalized tables.
- Generate/complete routes work against normalized cycle state without breaking legacy fallback.
- Live Supabase checks remain opt-in rather than default CI blockers.

## Owned files / lane

- `Lane A`
- `apps/web/src/modules/cycles/service.ts`
- `apps/web/src/modules/sessions/service.ts`
- Related routes, contracts, and tests for initialize/generate/complete bridging

## Verified commands

- `npm run test --workspace apps/web -- tests/api-sessions-initialize.test.ts tests/initialize-cycle-service.test.ts tests/session-cycle-bridge.test.ts tests/session-cycle-sync.test.ts tests/session-completion-reliability.test.ts`
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright --workspace apps/web`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

## Open findings

- None for the implemented app bridge scope.

## Next exact action

- None for the implemented app bridge scope. The gated live Supabase verifier and the Playwright first-session journey are both green against the target environment.

## Handoff log

- `2026-03-29`: File created by coordinator. Initial status set to `review-pending`.
- `2026-03-29`: Generate bridge now rejects plain wrong-day requests while an active cycle session exists.
- `2026-03-29`: Generate bridge now regenerates and persists the active normalized session when initialize stored only raw engine slot metadata.
- `2026-03-29`: Completion now derives a deterministic fallback idempotency key when callers omit one, making retry safety independent of a client-supplied header.
- `2026-03-29`: Gated live verification was updated to reuse the generated session seed for completion and to assert normalized plan/gamification state after completion, but the gated lane was not executed in this session.
- `2026-03-29`: Executed the gated live Supabase verification lane successfully after live migration parity was restored.
- `2026-03-29`: Executed `apps/web` Playwright first-session browser verification successfully against the live test-user environment, including invalid-login handling, workout-log redirect recovery, and the full onboarding/generate/complete/history flow.
- `2026-04-02`: Superseded by `engine_12`; normalized tables now own initialized-cycle identity, cursor, and gamification state, with `users.stats_json.activeProgram` retained only for compatibility fallback.
