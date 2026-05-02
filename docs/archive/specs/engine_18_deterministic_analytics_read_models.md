# Deterministic Analytics Read Models

## Goal

Define the next Wave 4 boundary as an app-owned deterministic analytics read-model contract derived from normalized cycle/session state, without reopening the engine envelope or changing Rust operations.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
  - `docs/archive/specs/engine_16_operational_release_hardening.md`
  - `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`

## Current Baseline

Engine 15 introduced the app-owned reporting and explanation read-model layer. The current implemented reporting surface is centered on `ActiveCycleReportingReadModel`, which derives active-cycle progress, adherence, class context, and progression summaries from normalized cycle tables, gamification state, and progression rows.

Engine 17 exposed selected explanation read models in user-facing surfaces, but explicitly deferred broader analytics and reporting expansion. The dashboard still has compatibility-era summaries that can read from `users.stats_json` where normalized analytics read models do not yet exist.

## Boundary Decision

Engine 18 is a read-model contract slice, not an engine-boundary revision.

This spec keeps unchanged:
- `EngineInputV1`
- `EngineOutputV1`
- Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- `decisionLog` and `replayReceipt` semantics
- existing Engine 15 and Engine 17 explanation consumers

This spec defines:
- app-owned deterministic analytics read-model categories
- canonical analytics input rules
- limits on `users.stats_json` compatibility fallback
- acceptance rules for later analytics implementation work

This spec does not define:
- new engine output fields
- new Rust operations
- new persistence tables
- new dashboard UI requirements
- analytics dashboards or admin views as a required closure condition

## Analytics Input Rules

Canonical analytics inputs are:
- normalized cycle plan and session state
- normalized progression rows
- normalized gamification and adherence state
- persisted engine traces only when analytics need replay or explanation correlation
- workout history/session completion records where normalized session history needs user-facing recency or volume context

Input ownership rules:
- normalized engine-owned state is preferred wherever it exists
- `users.stats_json` may only fill compatibility gaps where no normalized source currently exists
- compatibility fallback must not redefine engine semantics or become a new analytics source of truth
- analytics derivation must be deterministic from persisted app-owned inputs and closed engine trace semantics

## Analytics Output Rules

Required analytics read-model categories:
- cycle completion analytics: total sessions, completed sessions, remaining sessions, current cursor, and completion percentage
- adherence analytics: streak, completed and missed counts, last outcome, XP, and level context
- progression analytics: improving, stalled, regressing, blocked, and swap-pressure summaries
- recent-session analytics: completed session history from normalized/session-history sources

Rules:
- analytics read models are app-owned derived models, not engine fields
- analytics contracts may include labels and grouping for app consumers, but those values must derive from canonical inputs
- future API/UI consumers must use the analytics read-model layer instead of duplicating ad hoc normalized-table queries
- dashboard migration away from `stats_json` summaries is a later consumer step unless implementation discovery proves it is required for this contract

## Interface And Integration Rules

Later implementation should add an app-owned analytics read-model contract, likely alongside the existing reporting contracts in `packages/contracts/src/reporting.ts`.

The first implementation target should be the reporting/read-model layer. API routes or UI consumers should be added only after the analytics contract is stable or when needed as minimal acceptance evidence.

No new SQL migration or engine change should be introduced unless implementation discovery proves the required analytics cannot be derived from the existing normalized/session-history inputs.

## Verification And Acceptance Rules

This boundary is complete with an app-owned analytics read-model contract in the reporting layer, schema smoke coverage, and reporting-service tests proving normalized state is preferred over `users.stats_json`.

Later implementation acceptance should cover:
- contract smoke tests for any new analytics schemas
- reporting-service tests proving normalized state is preferred over `users.stats_json`
- deterministic handling of missing normalized rows and compatibility fallback gaps
- API or UI tests only if Engine 18 adds a consumer surface

Execution-side verification remains:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

Manual release-confidence lanes remain:
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `npm run test:e2e:playwright`

## Deferred Follow-Up

- dashboard migration from compatibility-era `stats_json` summaries to analytics read models
- broader analytics API endpoints for internal or future consumers
- admin/reporting views that expose replay/debug correlation
- long-term removal or narrowing of remaining compatibility-only summaries

## Completion Target

Engine 18 is closed. The deterministic analytics read-model contract is implemented, schema-tested, and proven to derive from normalized state first while tolerating current compatibility gaps.
