# Engine 20 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`
- Builds on:
  - `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`

## Intent

- Shrank dashboard dependence on `users.stats_json` by adding deterministic read-model coverage for remaining compatibility-only dashboard summaries.
- Covered fatigue, capacity timeline, and per-muscle weekly-volume analytics.
- Kept Engine 20 in the app/reporting layer without revising the engine boundary.

## Boundary guardrails

- No Rust operation changes were introduced.
- No database migrations were introduced.
- `users.stats_json` remained compatibility-only fallback state.
- Engine 19 dashboard analytics behavior was preserved while adding the next normalized read-model surfaces.

## Closure notes

- `DeterministicAnalyticsReadModel` now includes fatigue summary, capacity timeline, and weekly-volume analytics.
- Reporting derives the new analytics from normalized/session-history data.
- Dashboard summaries prefer analytics over `stats_json` where normalized coverage exists, with compatibility fallback retained.

## Verified commands

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`
- `cargo test --manifest-path packages/engine-rs/Cargo.toml`

## Next exact action

- Start Engine 21 planning and implementation for the broader analytics API endpoint for non-dashboard consumers:
  - keep the work app/reporting-layer scoped
  - reuse `DeterministicAnalyticsReadModel`
  - avoid Rust operation and database schema changes by default
