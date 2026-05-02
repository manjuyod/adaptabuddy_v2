# User-Facing Explanation Consumers

## Goal

Expose the completed Engine 15 explanation/read-model layer in user-facing `apps/web` surfaces without changing the engine envelope, Rust operations, `decisionLog`, or `replayReceipt`.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
  - `docs/archive/specs/engine_16_operational_release_hardening.md`

## Current Baseline

The app shell already derives explanation and reporting read models from persisted engine traces and normalized engine-owned cycle state. Before this slice, those read models existed mostly as API/service output and limited history detail enrichment, while generated cycle-backed sessions did not present a deliberate user-facing "why this session" explanation.

## Boundary Decision

Engine 17 is an app-shell consumer slice, not an engine-boundary revision.

This spec keeps unchanged:
- `EngineInputV1`
- `EngineOutputV1`
- Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- `decisionLog` and `replayReceipt` semantics
- the Engine 15 read-model contracts

This spec defines:
- a generated-session explanation consumer in the workout UI
- readable completion explanation presentation in workout history
- a rule that user-facing explanation copy derives from the existing read models, not raw trace parsing in components

This spec does not define:
- analytics dashboards or broader reporting expansion
- new engine output fields
- new replay receipt fields
- new persistence ownership rules

## Consumer Rules

User-facing explanation consumers must:
- consume `PlanSessionExplanationReadModel`, `WorkoutCompletionExplanationReadModel`, and `ActiveCycleReportingReadModel` where applicable
- keep raw replay hashes and trace internals out of normal workout-generation copy
- render missing optional explanation sections gracefully
- keep any replay/debug reference display limited to surfaces already intended for debugging or detailed history inspection

The workout generation surface may show:
- the session rationale
- the recommended movement family
- scope/filter/tie-break summaries when present
- progression change summaries

The workout history detail surface may show:
- readable completion outcome labels
- XP and streak changes
- readable XP reasons and warnings
- readable progression action/trend summaries

## Verification And Acceptance Rules

This boundary is closed by:
- UI coverage for rendering generated-session explanations without exposing replay hashes
- UI coverage for readable completion explanation labels in history detail
- continued use of the Engine 15 reporting service and contracts as the derivation source

Execution-side verification remains:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

## Deferred Follow-Up

- analytics and reporting expansion from normalized deterministic cycle/session state
- broader dashboard-level cycle explanation summaries
- further reduction of compatibility-only summaries still sourced from `users.stats_json`

## Completion Note

Engine 17 is complete as a Wave 4 user-facing explanation-consumer slice. Future Wave 4 work can proceed to analytics/reporting expansion without reopening the engine envelope or Engine 15 read-model boundary.
