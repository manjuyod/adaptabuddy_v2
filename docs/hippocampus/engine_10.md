# Engine 10 Hippocampus

## Status

- `complete`

## Supersession

- This Wave 2 implementation record is superseded by `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`.
- Normalized engine-owned tables are canonical for initialized-cycle identity, cursor state, and gamification; `users.stats_json.activeProgram` is compatibility-only when normalized state exists.

## Acceptance targets

- Initialized cycle state persists outside `users.stats_json`.
- Session generation can read the active normalized cycle session.
- Completion sync advances normalized session cursor and gamification state.
- Projection updates stay narrow and compatible with the current shell.

## Owned files / lane

- `Lane A`
- `packages/db/sql/012_engine_cycle_state_tables.sql`
- `apps/web/src/modules/cycles/service.ts`
- `apps/web/src/modules/sessions/service.ts`
- Related tests for normalized persistence and sync

## Verified commands

- `npm run test --workspace apps/web -- tests/initialize-cycle-service.test.ts tests/session-cycle-bridge.test.ts tests/session-cycle-sync.test.ts tests/session-completion-reliability.test.ts`
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

## Open findings

- None for the implemented normalized persistence and projection scope.

## Next exact action

- None for the accepted persistence/projection scope. Migration `012_engine_cycle_state_tables` is applied to the target Supabase project and the gated live verification lane is green.

## Handoff log

- `2026-03-29`: File created by coordinator. Initial status set to `review-pending`.
- `2026-03-29`: Fixed normalized insert id retrieval, previous-active-plan handling, and muscle-group load error reporting in initialize.
- `2026-03-29`: Completion sync now surfaces normalized read failures, requires gamification state, rolls back partial normalized writes on follow-up mutation failure, and refreshes compatibility projection by patching only active cycle fields in stored `stats_json`.
- `2026-03-29`: Added select-failure support to the local Supabase mock and covered projection retry, missing gamification, and compatibility projection refresh in unit tests.
- `2026-03-29`: Applied `packages/db/sql/012_engine_cycle_state_tables.sql` to the target Supabase project via MCP and verified that `engine_cycle_profiles`, `engine_cycle_program_mix`, `engine_cycle_plans`, `engine_cycle_sessions`, and `engine_gamification_states` now exist in `public`.
- `2026-03-29`: Ran the gated live Supabase verification lane successfully after the migration landed.
- `2026-04-02`: Superseded by `engine_12`; normalized tables now own initialized-cycle identity, cursor, and gamification state, with `users.stats_json.activeProgram` retained only for compatibility fallback.
