# Engine 25: `stats_json` Compatibility Sunset Map

## Goal

Turn the repeated `users.stats_json` compatibility-only guidance into a concrete deprecation workflow with field ownership, fallback limits, drift detection, and removal gates.

This spec does not immediately delete compatibility data. It defines how to finish shrinking it safely.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
  - `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`
  - `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`
  - `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`
  - `docs/archive/specs/engine_21_analytics_api_endpoint.md`
  - `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`

## GitNexus Grounding

GitNexus and repo search identify current compatibility surfaces:

- `getDeterministicAnalyticsReadModel` derives normalized analytics in `apps/web/src/modules/reporting/service.ts`.
- dashboard summary helpers consume `DeterministicAnalyticsReadModel | UserStats | null`, preserving fallback behavior.
- `persistCycleCompatibilityProjection` updates app-owned summary projection after cycle-backed completion.
- `buildProjection` in cycle initialization seeds `users.stats_json.activeProgram` compatibility data.
- many app modules still read `stats_json` for settings, opt-ins, preferences, guardrails, deviation, volume, progression, onboarding, and legacy program flows.
- GitNexus impact for `getDeterministicAnalyticsReadModel` is LOW, while `EngineInputV1`/`EngineOutputV1` are CRITICAL. This means compatibility cleanup should proceed in app/read-model layers, not by pushing app persistence shape into the engine boundary.

## Boundary Decision

Engine 25 is an app ownership and migration spec, not a Rust engine operation revision.

This spec keeps unchanged:

- Rust engine public envelopes
- normalized cycle tables as canonical initialized-cycle state
- app-owned preferences and settings remaining outside the engine unless explicitly normalized into snapshots at invocation
- `users.stats_json` as a temporary compatibility and app-summary shape during rollout

This spec defines:

- an ownership matrix for each remaining `stats_json` family
- fallback rules for normalized analytics, cycle state, settings, and legacy flows
- a drift detector that compares normalized/read-model truth against compatibility projections where both exist
- removal gates for dashboard, session, onboarding, and API consumers

## Ownership Map

Implementation should classify each `stats_json` field family as one of:

- engine-owned canonical state already represented in normalized cycle tables
- app-owned user preference or opt-in state
- app-owned derived analytics that should come from deterministic read models
- compatibility projection required only for legacy fallback
- obsolete or untrusted data that should not be written by new flows

Fields in the first and third groups must prefer normalized or read-model sources. Fields in the fourth group must have an explicit removal gate.

## Implementation Direction

- Add a documented `stats_json` ownership matrix near the contracts or DB schema notes.
- Add tests around dashboard/session readers proving normalized data wins over conflicting compatibility projection.
- Add a drift detector in a test helper, diagnostic service, or release verification command. It should report mismatches without making the engine depend on app persistence shape.
- Stop adding new `stats_json` fields unless they are app-owned preferences or an explicitly approved compatibility field.
- Keep legacy fallback only when no normalized active cycle or analytics source exists.

## Verification And Acceptance Rules

Implementation acceptance requires:

- ownership matrix documentation covering active program, preferences, opt-ins, progression summaries, fatigue summaries, analytics summaries, and compatibility projection fields
- tests proving normalized cycle state wins over `stats_json.activeProgram`
- tests proving deterministic analytics wins over conflicting dashboard `stats_json` summaries
- drift detector coverage for at least active cycle identity/cursor and dashboard analytics summaries
- no Rust engine dependency on `users.stats_json`

Execution-side verification:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

## Completion Target

Engine 25 closes when every remaining `stats_json` responsibility has an owner, fallback policy, drift check or removal gate, and the app has tests proving normalized/read-model sources win wherever they are available.
