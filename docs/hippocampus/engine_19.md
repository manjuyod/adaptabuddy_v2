# Engine 19 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`
- Builds on:
  - `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`

## Intent

- Move dashboard progress, adherence, and recent-session display onto `DeterministicAnalyticsReadModel`.
- Keep `users.stats_json` as a compatibility source only for dashboard gaps not covered by normalized analytics.
- Avoid Rust, SQL, engine-envelope, replay, or API route changes.

## Current baseline

- Engine 18 provides deterministic analytics read models in the reporting layer.
- Dashboard display can now consume analytics for cycle completion, adherence, XP/level/streak context, and recent completed sessions.
- Fatigue, 1RM timeline, and per-muscle weekly-volume summaries still depend on app-owned compatibility fields until normalized analytics exist for those domains.

## Boundary guardrails

- No engine operation changes are introduced in Engine 19.
- No database migration is introduced in Engine 19.
- No new reporting API route is required for the dashboard migration.
- Dashboard direct workout-history queries should not duplicate analytics read-model derivation when analytics is available.

## Verified commands

- `npm run typecheck`
  - Exit code `0`
  - `tsc --noEmit` completed successfully for `apps/web`
- `npm run lint`
  - Exit code `0`
  - `next lint` reported no ESLint warnings or errors
  - Non-blocking warning: `next lint` is deprecated and will be removed in Next.js 16
- `npm run test`
  - Exit code `0`
  - `apps/web`: 53 passed, 3 skipped
  - `packages/contracts`: 1 passed
  - `packages/core`: 16 passed
  - `packages/db`: no tests yet
  - Non-blocking warning: React reported an invalid `action` prop on a `form` in `apps/web/src/modules/auth/components/login-screen.tsx`
- `cd apps/web && npm run build`
  - Exit code `0`
  - Compiled successfully and generated 37 of 37 static pages

## Manual lanes

- Live Supabase verification was not part of the default green lane and remains manual release-confidence coverage.
- Playwright browser E2E was not part of the default green lane and remains manual release-confidence coverage.

## Next exact action

- Start Engine 20 planning and implementation for the remaining dashboard analytics compatibility gaps:
  - normalized fatigue analytics
  - normalized capacity timeline analytics
  - normalized per-muscle weekly-volume analytics
