# Private Beta Release Record

This is the latest local beta rehearsal candidate record. Use `docs/operations/private_beta_release_evidence_pack.md` as the fillable template for a formal hosted promotion packet.

## Candidate

- Release lane: `Wave 7: Private Beta Operations And Learning Loop`
- Evidence timestamp (UTC): `2026-05-04T23:29:30Z`
- Release candidate ID: `rc-8e79ef3-20260504`
- Commit SHA: `8e79ef34d5345273d98feb64fdbb61bae5b7d473`
- Short SHA: `8e79ef3`
- Commit summary: `8e79ef3 2026-05-04T16:15:09-07:00 ignore inspo`
- Release owner: `user`
- Environment owner: `user`
- Rollback owner: `user`
- Target host: `http://127.0.0.1:3018`
- Target Supabase project: `vezfyhbrrpokheqipepa`
- Final decision: `READY_FOR_REMOTE_DEPLOY`

The merged `main` candidate includes true program blending, strength baseline intake, and injury-aware onboarding/cycle initialization. The local rehearsal covered live Supabase initialization/persistence, full browser beta flows, targeted Rust initialize-cycle behavior for the new blend logic, production build, and standalone deploy smoke. Remote hosted deployment smoke remains the next operational gate after pushing the candidate.

## Gate Results

| Gate | Result | Evidence |
| --- | --- | --- |
| Candidate metadata | `PASS` | `git rev-parse HEAD` returned `8e79ef34d5345273d98feb64fdbb61bae5b7d473`; `git rev-parse --short HEAD` returned `8e79ef3` |
| Merged-main quality gate | `PASS` | `npm run ci:quality` passed after the feature branch was fast-forward merged into `main`; app typecheck, lint, workspace tests, web build, and Rust engine tests completed successfully |
| Live Supabase E2E | `PASS` | `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts` passed `1/1` |
| Playwright browser E2E | `PASS` | `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passed `7/7` across desktop and mobile projects |
| Rust initialize-cycle targeted tests | `PASS` | `cargo test --manifest-path packages/engine-rs/Cargo.toml --test initialize_cycle initialize_cycle_` passed `16/16`, including true blending, knee swap, high-fatigue cap, challenge preservation, and replay stability coverage |
| Web production build | `PASS` | `npm run build --workspace apps/web` exited 0 on Next `15.5.15` |
| Standalone deploy smoke | `PASS` | Built standalone app served on `http://127.0.0.1:3018`; `node apps/web/scripts/verify-deploy-smoke.mjs http://127.0.0.1:3018` exited 0 |
| Feedback log | `PASS_WITH_RESOLVED_NOTE` | `FDB-20260504-005` logged and closed a Windows rehearsal harness issue around quoting the standalone server path |
| Remote hosted deploy smoke | `PENDING` | Run after pushing/deploying the candidate to the target host |
| Docker runtime smoke | `NOT_RERUN_FOR_THIS_CANDIDATE` | Previous promoted candidate had Docker evidence; current rehearsal used the standalone build artifact instead |

## Route-Level Smoke Evidence

| Route | Method | Expected result | Current evidence |
| --- | --- | --- | --- |
| `/offline` | `GET` | `200` | Standalone deploy smoke passed on `http://127.0.0.1:3018` |
| `/api/health` | `GET` | `200` plus `status`, `timestamp`, `supabase`, `x-request-id`, and `Cache-Control: no-store` | Standalone deploy smoke passed with `supabase:"connected"` |
| `/api/v0/sessions/generate` | `GET` smoke probe; `POST` authenticated flow | `405` for smoke method-boundary probe; authenticated success through live flow coverage | Standalone smoke returned expected `405`; Playwright generated live workouts successfully |
| `/api/v0/sessions/complete` | `GET` smoke probe; `POST` authenticated flow | `405` for smoke method-boundary probe; authenticated success through live flow coverage | Standalone smoke returned expected `405`; Playwright completed live workouts successfully |
| `/api/v0/reporting/analytics` | `POST` smoke probe; `GET` authenticated flow | `405` for smoke method-boundary probe; authenticated analytics where credentials/env allow | Standalone smoke returned expected `405`; Playwright authenticated analytics assertions passed |

## Environment Readiness

| Check | Result | Evidence |
| --- | --- | --- |
| Required Supabase env keys | `PASS` | Live Supabase E2E and Playwright suites authenticated and persisted data against the configured target |
| Target Supabase project | `PASS` | Configured target URL matches `vezfyhbrrpokheqipepa.supabase.co` |
| Live Supabase connectivity | `PASS` | Live Supabase E2E passed `1/1`; Playwright passed `7/7`; deploy smoke health payload reported `supabase:"connected"` |
| Release test user available | `PASS` | Playwright authenticated with configured test credentials and reset live test state |
| Audit/security exceptions reviewed | `UNCHANGED_FROM_PRIOR_CANDIDATE` | No dependency update was part of this rehearsal; prior high-severity audit remediation remains the latest audit record |

## Engine 30-31 And Wave 7 Status

| Area | Candidate status | Evidence |
| --- | --- | --- |
| Engine 30 headless season loop and backtest harness | `REVALIDATED` | Merged-main `ci:quality` and targeted Rust initialize-cycle tests passed |
| Engine 31 adaptive program families | `REVALIDATED` | True program blending and adaptive challenge preservation passed targeted Rust coverage |
| Wave 7 beta operations and learning loop | `ACTIVE` | Feedback items `FDB-20260504-001`, `FDB-20260504-002`, `FDB-20260504-004`, and `FDB-20260504-005` are closed; `FDB-20260504-003` remains actionable for next-cycle blend evolution |

## Promotion Blockers

Remote hosted deploy smoke is pending because this record captures the local rehearsal. No local app, engine, build, live Supabase, Playwright, or standalone smoke blocker is open.

## Accepted Risks

| Risk | Status | Notes |
| --- | --- | --- |
| Remote hosted deployment not yet smoked for this candidate | `PENDING_OPERATIONAL_GATE` | Push/deploy the candidate, then run `npm run verify:deploy:smoke -- <hosted-url>` |
| Next-cycle personalization remains generic | `TRACKED_FOR_NEXT_ENGINE_SPEC` | Feedback `FDB-20260504-003` tracks personalized `advance_cycle` blend evolution |
| Docker runtime not rerun for this candidate | `ACCEPTED_FOR_LOCAL_REHEARSAL` | The current rehearsal used the built standalone artifact; rerun Docker evidence if Docker becomes a required hosted-promotion gate |

## Owner Signoff

| Owner | Decision | Name | Timestamp (UTC) | Notes |
| --- | --- | --- | --- | --- |
| Release owner | `READY_FOR_REMOTE_DEPLOY` | `user` | `2026-05-04T23:29:30Z` | Local rehearsal gates passed; hosted smoke remains pending after push/deploy |
| Environment owner | `READY_FOR_REMOTE_DEPLOY` | `user` | `2026-05-04T23:29:30Z` | Live Supabase and local standalone health checks passed |
| Rollback owner | `READY` | `user` | `2026-05-04T23:29:30Z` | Rollback owner assigned; no local release blocker open |

## Non-Blocking Notes

- The browser suite covers catalog-driven onboarding, active cycle persistence, guardrails, workout completion, dashboard/history, authenticated analytics, and mobile navigation.
- The exact powerlifting + bench + push-up blend is covered in targeted Rust initialize-cycle tests rather than a fixed browser fixture, because the browser journey intentionally follows the live catalog order.
- Local Windows deploy rehearsal should launch `npm` as `npm.cmd` and quote standalone server paths when the workspace path contains spaces.
