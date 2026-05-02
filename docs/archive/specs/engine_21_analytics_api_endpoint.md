# Analytics API Endpoint

## Goal

Expose the deterministic analytics read model through an authenticated app-owned API endpoint so non-dashboard consumers can use the Engine 18-20 reporting layer without duplicating dashboard-specific presenter logic or reading `users.stats_json` directly.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`

## Current Baseline

Engine 18 introduced `DeterministicAnalyticsReadModel` in the reporting layer. Engine 19 moved dashboard progress, adherence, and recent-session display onto that model. Engine 20 expanded the model with fatigue summary, capacity timeline, and weekly volume, and the dashboard now prefers normalized analytics over `users.stats_json` for those summaries.

The remaining gap is access: analytics are available to dashboard/reporting code, but there is no broader endpoint for authenticated app consumers that need the same deterministic read model.

## Boundary Decision

Engine 21 is an app/reporting-layer API exposure slice, not an engine-boundary revision.

This spec keeps unchanged:
- Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- `EngineInputV1` and `EngineOutputV1`
- engine replay and decision-log semantics
- database schema
- Engine 20 dashboard analytics behavior

This spec defines:
- an authenticated analytics API route for the current user
- edge validation and response-shape rules for returning deterministic analytics
- reuse of the reporting/read-model service rather than dashboard presenter helpers
- acceptance rules proving non-dashboard consumers can access analytics without widening `stats_json`

## API Rules

The endpoint should return the app-owned `DeterministicAnalyticsReadModel` or a typed empty/unavailable state when normalized inputs are absent.

Rules:
- auth remains cookie-backed and enforced in the app shell
- external inputs are validated at the route edge
- server secrets do not enter client bundles
- RLS-backed persistence ownership remains assumed
- response data derives from normalized cycle/reporting/session-history inputs first
- `users.stats_json` may only remain a compatibility fallback where existing reporting derivation already allows it
- dashboard presenter-only formatting should not become the endpoint contract

## Initial Implementation Direction

- Add a narrow authenticated analytics route under the app API/reporting surface.
- Reuse the existing reporting-service derivation for `DeterministicAnalyticsReadModel`.
- Add contract or route schema coverage for the endpoint response.
- Add route/service tests for authenticated success, unauthenticated rejection, missing-normalized-data behavior, and analytics-first derivation.
- Keep dashboard UI changes out of scope unless implementation discovery finds a shared helper boundary that must be clarified.

## Verification And Acceptance Rules

Implementation acceptance should cover:
- API route tests for auth and edge validation
- schema smoke tests for the returned analytics payload
- reporting-service or route tests proving the endpoint uses deterministic analytics rather than dashboard `stats_json` summaries
- regression coverage that Engine 20 dashboard behavior remains unchanged

Execution-side verification remains:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

Manual release-confidence lanes remain:
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `npm run test:e2e:playwright`

## Completion Result

Engine 21 added `GET /api/v0/reporting/analytics` as an authenticated app-owned reporting endpoint for the current user.

Implemented surfaces:
- route: `apps/web/app/api/v0/reporting/analytics/route.ts`
- contracts: `DeterministicAnalyticsRequestSchema` and `DeterministicAnalyticsResponseSchema`
- route tests: `apps/web/tests/api-reporting.test.ts`
- app schema tests: `apps/web/tests/api-schema.test.ts`
- contract smoke tests: `packages/contracts/tests/smoke.test.ts`

The implementation stayed in the app/reporting and contract layers. It did not revise Rust engine operations, `EngineInputV1`, `EngineOutputV1`, replay semantics, or database schema.

## Deferred Follow-Up

- long-term removal or narrowing of remaining dashboard `stats_json` fallbacks
- admin/reporting views that expose analytics alongside replay/debug correlation

## Completion Target

Engine 21 closed when authenticated non-dashboard app consumers could fetch `DeterministicAnalyticsReadModel` through a validated API endpoint, tests proved analytics-first behavior and auth enforcement, and the work remained limited to the app/reporting layer without requiring a boundary revision.
