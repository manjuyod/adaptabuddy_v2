# Engine 21 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_21_analytics_api_endpoint.md`
- Builds on:
  - `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`

## Intent

- Expose `DeterministicAnalyticsReadModel` through an authenticated app-owned API endpoint for non-dashboard consumers.
- Reuse the reporting/read-model service instead of dashboard presenter helpers.
- Keep analytics deterministic and derived from normalized cycle/reporting/session-history data first.
- Keep the slice in the app/reporting layer unless implementation discovery proves a boundary revision is required.

## Current baseline

- Engine 18 created the deterministic analytics read-model layer.
- Engine 19 migrated dashboard progress, adherence, and recent-session consumption onto analytics.
- Engine 20 added fatigue summary, capacity timeline, and weekly-volume analytics, with dashboard analytics-first fallback behavior.
- Engine 21 added an authenticated broader analytics API endpoint for non-dashboard consumers.
- Rust operations and database schema were unchanged through Engine 21.

## Boundary guardrails

- Do not introduce Rust operation changes by default.
- Do not introduce database migrations by default.
- Do not widen `users.stats_json` compatibility responsibilities.
- Auth stays cookie-backed and enforced at the app shell.
- Validate endpoint inputs at the app edge.
- Do not let dashboard presenter formatting define the API contract.

## Closure notes

- Added `GET /api/v0/reporting/analytics` for authenticated non-dashboard consumers.
- Reused `getDeterministicAnalyticsReadModel`.
- Added strict empty request validation and available/unavailable response contracts.
- Added route, app schema, and contract smoke coverage.
- Kept the work out of Rust engine operations and database schema.

## Verification record

- `npm run test --workspace apps/web -- tests/api-reporting.test.ts tests/reporting-service.test.ts tests/api-schema.test.ts`
- `npm run test --workspace packages/contracts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build --workspace apps/web`

## Next exact action

- Engine 22 replay-policy planning and Rust implementation is now complete in `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`.
