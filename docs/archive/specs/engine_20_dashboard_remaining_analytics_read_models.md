# Dashboard Remaining Analytics Read Models

## Goal

Extend deterministic app-owned analytics read models to cover the dashboard summaries that still depend on `users.stats_json` compatibility fields after Engine 19.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`

## Current Baseline

Engine 19 moved dashboard cycle progress, adherence, and recent-session display onto `DeterministicAnalyticsReadModel`.

The dashboard still depends on `users.stats_json` for:
- fatigue summaries
- capacity and 1RM timeline summaries
- per-muscle weekly-volume summaries

## Boundary Decision

Engine 20 starts as an app/reporting-layer analytics expansion.

This spec keeps unchanged by default:
- Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- `EngineInputV1` and `EngineOutputV1`
- engine replay and decision-log semantics
- database schema
- existing Engine 19 dashboard analytics behavior

This spec defines:
- normalized deterministic read-model coverage for remaining dashboard analytics gaps
- dashboard fallback limits for compatibility-only `stats_json` data
- acceptance rules for proving normalized analytics are preferred where coverage exists

## Initial Implementation Direction

- Define reporting-layer analytics shapes for fatigue, capacity timeline, and per-muscle weekly volume.
- Derive analytics from normalized cycle/reporting inputs and workout-history rows where available.
- Keep `stats_json` fallback only for fields not yet covered or when normalized analytics are unavailable.
- Add dashboard presenter helpers that accept analytics plus `UserStats` so analytics-first behavior can be tested without rendering the page.

## Verification And Acceptance Rules

Implementation acceptance should cover:
- read-model contract smoke tests for the new analytics fields
- reporting-service tests for deterministic derivation and fallback behavior
- dashboard summary tests proving normalized analytics win over conflicting `stats_json`
- dashboard page tests proving the migrated values render

Execution-side verification remains:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

Manual release-confidence lanes remain:
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `npm run test:e2e:playwright`

## Deferred Follow-Up

- broader analytics API endpoint for non-dashboard consumers, promoted to Engine 21
- long-term removal or narrowing of remaining dashboard `stats_json` fallbacks

## Completion Target

Engine 20 should close when `DeterministicAnalyticsReadModel` covers fatigue summary, capacity timeline, and weekly volume, reporting derives those fields from normalized/session-history data, and the dashboard prefers analytics over `stats_json` where normalized coverage exists.

## Completion Result

Engine 20 is closed. The implementation added fatigue summary, capacity timeline, and weekly-volume analytics to the app/reporting read model, migrated the dashboard to prefer those analytics with compatibility fallback, and left Rust operations and database schema unchanged.

Verification completed:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`
- `cargo test --manifest-path packages/engine-rs/Cargo.toml`
