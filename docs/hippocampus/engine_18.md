# Engine 18 Hippocampus

## Status

- `complete`

## Scope snapshot

- Archived numbered spec: `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`
- Builds on:
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
  - `docs/archive/specs/engine_16_operational_release_hardening.md`
  - `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`

## Intent

- Define deterministic analytics read models from normalized cycle/session state.
- Extend the Engine 15 reporting foundation without changing `EngineInputV1`, `EngineOutputV1`, Rust operations, `decisionLog`, or `replayReceipt`.
- Keep analytics app-owned and prevent `users.stats_json` compatibility summaries from becoming the canonical analytics source.

## Current baseline

- `ActiveCycleReportingReadModel` already derives active-cycle progress, adherence, class context, and progression summaries from normalized cycle/gamification/progression state.
- Engine 17 user-facing explanation consumers are complete and archived.
- `DeterministicAnalyticsReadModel` derives cycle completion, adherence, progression, and recent-session analytics from normalized reporting and workout-history inputs.
- Dashboard summary helpers still include compatibility-era `stats_json` summaries; dashboard migration remains a later consumer step.
- Live Supabase and Playwright E2E remain manual release-confidence lanes.

## Boundary guardrails

- No engine-envelope fields are introduced in Engine 18.
- No Rust operation is added or revised for the spec-authoring slice.
- No new persistence table is planned unless implementation discovery proves existing normalized/session-history inputs are insufficient.
- Analytics consumers should use the read-model layer rather than duplicating normalized-table or raw-trace parsing.

## Closure notes

- Added analytics schemas/contracts in the reporting layer.
- Added deterministic reporting-service derivation from normalized active-cycle reporting and workout-history rows.
- Added contract and service tests proving normalized state is preferred over `users.stats_json`.
- Deferred API/UI consumers and dashboard migration as planned.
- Dashboard migration follow-up is complete and archived as `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`.
