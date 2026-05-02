# Dashboard Analytics Consumer Migration

## Goal

Migrate the dashboard's progress, adherence, and recent-session display to the app-owned deterministic analytics read model introduced by Engine 18, while keeping `users.stats_json` only for dashboard compatibility gaps that do not yet have normalized analytics coverage.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`

## Current Baseline

Engine 18 added `DeterministicAnalyticsReadModel` in the reporting layer. It derives cycle completion, adherence, progression, and recent-session analytics from normalized active-cycle reporting plus workout-history rows.

Before Engine 19, the dashboard still reads `users.stats_json` directly for several summary surfaces and calls recent workout history directly. That keeps compatibility summaries on the dashboard even when normalized analytics exist.

## Boundary Decision

Engine 19 is an app-shell consumer migration, not an engine-boundary revision.

This spec keeps unchanged:
- `EngineInputV1` and `EngineOutputV1`
- Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- engine decision-log and replay-receipt semantics
- database schema
- reporting API route surface

This spec defines:
- dashboard-facing consumption of deterministic analytics
- recent-session display labels derived by the analytics read model
- fallback limits for `users.stats_json` on the dashboard
- acceptance rules for proving analytics are preferred over compatibility summaries

## Dashboard Input Rules

Canonical dashboard analytics inputs are:
- `DeterministicAnalyticsReadModel` for cycle completion, adherence, progression counts, and recent completed sessions
- `users.stats_json` only for dashboard data not yet represented by normalized analytics, including fatigue summaries, capacity timeline, and per-muscle weekly-volume compatibility summaries

Rules:
- dashboard recent workout cards must prefer analytics `recentSessions` over `stats_json.progression.recentWorkouts`
- dashboard cycle/adherence display must prefer analytics cycle/adherence fields over `stats_json`
- direct dashboard calls to `getRecentWorkoutHistory` should be removed once analytics provides recent sessions
- `stats_json` fallback remains allowed when analytics is unavailable or for fields outside Engine 18 coverage

## Interface Rules

`RecentSessionAnalytics` should include a display-safe `dayName` derived from:
1. `program_days.name` when `program_day_id` resolves
2. workout metadata such as `programDayName` or `dayName`
3. `"Workout Session"` as the deterministic fallback

Dashboard presenter helpers should live in the dashboard module and accept both `DeterministicAnalyticsReadModel | null` and `UserStats`, so analytics-first behavior is testable without rendering the page.

## Verification And Acceptance Rules

Implementation acceptance should cover:
- contract smoke tests proving `RecentSessionAnalytics.dayName` is required
- reporting-service tests for program-day, metadata, and default `dayName` derivation
- dashboard summary tests proving analytics recent sessions win over conflicting `stats_json`
- dashboard page tests proving analytics values render and direct recent-history calls are removed

Execution-side verification remains:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

Manual release-confidence lanes remain:
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `npm run test:e2e:playwright`

## Deferred Follow-Up

- normalized analytics for fatigue and capacity timeline
- dashboard migration away from per-muscle weekly-volume compatibility summaries
- a broader analytics API endpoint for non-dashboard consumers
- long-term removal or narrowing of remaining dashboard `stats_json` fallbacks

## Completion Target

Engine 19 should close when the dashboard consumes deterministic analytics for cycle progress, adherence, and recent sessions, tests prove normalized analytics are preferred over `stats_json`, and Engine 19 remains limited to app-shell consumer migration.
