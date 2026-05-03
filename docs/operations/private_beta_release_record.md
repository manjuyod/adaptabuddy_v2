# Private Beta Release Record

This is the latest candidate record. Use `docs/operations/private_beta_release_evidence_pack.md` as the fillable template for the next private beta release candidate.

## Candidate

- Release lane: `Production Beta Readiness`
- Evidence timestamp (UTC): `2026-05-03T05:03:02Z`
- Release candidate ID: `rc-3db65a2-20260502`
- Commit SHA: `3db65a2f56c5a7a92cf0c6b72d3ab1d0496e1ba2`
- Short SHA: `3db65a2`
- Commit summary: `3db65a2 2026-05-02 10:11:29 -0700 chore: prepare wave 6 beta closure candidate`
- Release owner: `user`
- Environment owner: `user`
- Rollback owner: `user`
- Target host: `http://127.0.0.1:3000`
- Target Supabase project: `vezfyhbrrpokheqipepa`
- Final decision: `PROMOTE`

Wave 6 remediated the high-severity npm audit blocker without a semver-major framework, auth, or test-tool upgrade. `next` and `eslint-config-next` are aligned at `15.5.15`; the lockfile now resolves prior high-severity transitive findings for `flatted`, `minimatch`, `picomatch`, and `rollup` to fixed versions. Docker Desktop's Linux engine became available on `desktop-linux`, and the exact `3db65a2` candidate was rebuilt and smoked successfully as `adaptabuddy-web:rc-3db65a2-20260502`.

## Gate Results

| Gate | Result | Evidence |
| --- | --- | --- |
| Candidate metadata | `PASS` | `git rev-parse HEAD` returned `3db65a2f56c5a7a92cf0c6b72d3ab1d0496e1ba2`; `git rev-parse --short HEAD` returned `3db65a2` |
| Dependency install | `PASS_WITH_ACCEPTED_RISK` | `npm ci` exited 0; npm reported 2 low and 6 moderate advisories whose automatic fixes require breaking upgrades |
| High-severity audit | `PASS` | `npm audit --audit-level=high` exited 0 after remediation; remaining advisories are low/moderate only |
| Typecheck | `PASS` | `npm run typecheck` exited 0 |
| Lint | `PASS` | `npm run lint` exited 0 with no ESLint warnings or errors; Next reported the existing `next lint` deprecation notice |
| Workspace tests | `PASS` | `npm run test` exited 0; app, contracts, and core tests passed, with opt-in live smoke tests skipped by unset flags |
| Web production build | `PASS` | `npm run build --workspace apps/web` exited 0 on Next `15.5.15` |
| Local deploy smoke | `PASS` | Built app served on `http://127.0.0.1:3000`; `npm run verify:deploy:smoke` exited 0 |
| Docker runtime availability | `PASS` | `docker version` exited 0 on active context `desktop-linux`; Docker Desktop `4.43.1`, Engine `28.3.0`, `linux/amd64` |
| Docker build | `PASS` | `docker build --secret "id=build_env,src=C:\Users\17026\Documents\Code stuff\Adaptabuddy_v2\.env" -t adaptabuddy-web:rc-3db65a2-20260502 .` exited 0 from a detached exact-candidate worktree at `3db65a2`; image ID `sha256:d6222dd798c6d6f949e7e7f0cdbd54a6e1d2e560280238bb6db535359140878c` |
| Docker runtime smoke | `PASS` | Container `adaptabuddy-web-smoke` ran healthy on `http://127.0.0.1:3001`; `npm run verify:deploy:smoke -- http://127.0.0.1:3001` exited 0 |
| Environment readiness | `PASS` | `.env` contains required Supabase keys; target URL matches `vezfyhbrrpokheqipepa`; Docker runtime is available on `desktop-linux` |
| Migration parity | `PASS_WITH_ACCEPTED_RISK` | No DB migrations changed in candidate; local latest migration file remains `verification_checklist.sql`; live Supabase E2E and Playwright passed against target project |
| Live Supabase E2E | `PASS` | `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts` passed `1/1` |
| Playwright browser E2E | `PASS` | `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passed `7/7` |
| Authenticated analytics evidence | `PASS` | Passing Playwright suite includes authenticated `GET /api/v0/reporting/analytics` assertions for HTTP `200`, `status:"success"`, and `Cache-Control: no-store` |
| Owner signoff | `PASS` | User is assigned as release, environment, and rollback owner; final decision is `PROMOTE` after Docker blocker resolution |

## Route-Level Smoke Evidence

| Route | Method | Expected result | Current evidence |
| --- | --- | --- | --- |
| `/offline` | `GET` | `200` | Covered by local deploy smoke and Docker runtime smoke; Docker `npm run verify:deploy:smoke -- http://127.0.0.1:3001` exited 0 |
| `/api/health` | `GET` | `200` plus `status`, `timestamp`, `supabase`, `x-request-id`, and `Cache-Control: no-store` | Covered by local deploy smoke and Docker runtime smoke; Docker smoke exited 0 with `supabase:"connected"` |
| `/api/v0/sessions/generate` | `GET` smoke probe; `POST` authenticated flow | `405` for smoke method-boundary probe; authenticated success via live Supabase E2E | Covered by deploy smoke and live Supabase E2E; both passed |
| `/api/v0/sessions/complete` | `GET` smoke probe; `POST` authenticated flow | `405` for smoke method-boundary probe; authenticated success via live Supabase E2E | Covered by deploy smoke and live Supabase E2E; both passed |
| `/api/v0/reporting/analytics` | `POST` smoke probe; `GET` authenticated flow | `405` for smoke method-boundary probe; authenticated analytics where credentials/env allow | Local and Docker smoke probes passed; authenticated analytics covered by Playwright E2E |

## Environment Readiness

| Check | Result | Evidence |
| --- | --- | --- |
| Required Supabase env keys | `PASS` | `.env` contains `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and a service-role key |
| Target Supabase project | `PASS` | Configured target URL matches `vezfyhbrrpokheqipepa.supabase.co` |
| Live Supabase connectivity | `PASS` | Live Supabase E2E passed `1/1`; Playwright passed `7/7` |
| Release test user available | `PASS` | Live Supabase E2E and Playwright authenticated with configured test credentials |
| Docker runtime available | `PASS` | `docker version` exited 0 on active `desktop-linux`; Docker build and runtime smoke passed |
| Audit/security exceptions reviewed | `PASS_WITH_ACCEPTED_RISK` | High-severity findings are remediated; remaining low/moderate findings require breaking upgrades and are accepted for private beta promotion |

## Engine 23-29 Status

| Engine spec | Candidate status | Evidence |
| --- | --- | --- |
| Engine 23 app replay invocation alignment | `REVALIDATED` | Completed spec is archived; live Supabase E2E, deploy smoke, and Playwright evidence passed |
| Engine 24 replay bundle and beta debug evidence | `REVALIDATED` | Completed spec is archived; live generate/complete flows passed against target Supabase |
| Engine 25 `stats_json` compatibility sunset map | `REVALIDATED` | Completed spec is archived; normalized/read-model flows passed through unit, live E2E, and browser coverage |
| Engine 26 cycle/session orchestration reliability | `REVALIDATED` | Completed spec is archived; generate/complete/idempotency/browser paths passed through release gates |
| Engine 27 private beta release evidence pack | `COMPLETE` | Evidence pack is updated for immutable candidate `3db65a2`; Docker build/runtime smoke passed and final decision is `PROMOTE` |
| Engine 28 cross-language replay certification | `COMPLETE` | Completed spec is archived; no engine boundary changes in this candidate |
| Engine 29 pre-beta Playwright E2E hardening | `COMPLETE` | `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passed `7/7` |

## Promotion Blockers

None open.

Resolved:
- Docker Desktop Linux engine became available on `desktop-linux`.
- `adaptabuddy-web:rc-3db65a2-20260502` was rebuilt from an exact detached `3db65a2` worktree.
- Docker runtime smoke on `http://127.0.0.1:3001` passed and the smoke container was stopped.

## Accepted Risks

No unresolved required-gate failures remain. The current candidate is approved for private beta promotion.

| Risk | Status | Notes |
| --- | --- | --- |
| Docker runtime unavailable | `RESOLVED` | Docker build/runtime smoke passed on `desktop-linux` |
| Remaining low/moderate npm advisories | `ACCEPTED_FOR_PROMOTION` | `@supabase/ssr`, `vitest`, and nested `next`/`postcss` audit fixes require breaking or inappropriate major changes; high-severity audit gate passes |

## Owner Signoff

| Owner | Decision | Name | Timestamp (UTC) | Notes |
| --- | --- | --- | --- | --- |
| Release owner | `APPROVE` | `user` | `2026-05-03T05:03:02Z` | Quality, live Supabase, Playwright, local smoke, Docker build, and Docker runtime smoke gates passed |
| Environment owner | `APPROVE` | `user` | `2026-05-03T05:03:02Z` | Supabase target checks passed; Docker Desktop Linux engine is available on `desktop-linux` |
| Rollback owner | `READY` | `user` | `2026-05-03T05:03:02Z` | Rollback owner assigned; candidate is approved for private beta promotion |

## Non-Blocking Notes

- No engine public API, Rust engine behavior, or DB schema changes were made for Wave 6.
- Docker evidence was rerun from a detached exact-candidate worktree at `3db65a2` because the primary checkout had later release-record documentation commits.
- Context7 was not required because remediation avoided semver-major framework, auth, and test-tool upgrades.
- A direct ad hoc signed-in analytics probe under `next start` was attempted but not used for evidence because the browser saw an empty rendered body; the managed Playwright release suite did validate authenticated analytics successfully.
