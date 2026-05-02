# Engine 15 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
- Upstream closed trace contracts:
  - `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md`
  - `docs/archive/specs/engine_05_testing_and_replay.md`
- Upstream normalized-state boundaries:
  - `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
  - `docs/archive/specs/engine_13_class_definition_and_resolution_boundary.md`
  - `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`
  - `docs/archive/specs/engine_14_class_preset_addendum.md`

## Intent

- Start Wave 4 with an app-layer read-model boundary for explainability and reporting.
- Keep `EngineInputV1`, `EngineOutputV1`, `decisionLog`, and `replayReceipt` unchanged.
- Build future user-facing and internal/admin explanation surfaces from closed engine traces plus normalized engine-owned cycle state.

## Current baseline

- Broad repo verification is currently green:
  - `npm run test`
  - `cd apps/web && npm run build`
- The gated live Supabase lane remains manual:
  - `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- The read-model boundary is implemented in the app shell:
  - canonical derivation layer in `apps/web/src/modules/reporting/service.ts`
  - persisted trace support in `packages/db/sql/017_engine_15_session_traces.sql`
  - current consumers in session generation, workout history, and active-cycle reporting

## Boundary guardrails

- No new engine-envelope fields are introduced in Engine 15.
- Explanation and reporting are app-owned read models, not new engine patch buckets.
- `users.stats_json` remains compatibility-only wherever normalized engine-owned state exists.
- Operational and release hardening are explicitly deferred to a later Wave 4 spec.

## Next exact action

- No further Engine 15 boundary implementation is required for closure of this spec. The completed follow-on boundary is `docs/archive/specs/engine_16_operational_release_hardening.md`.
