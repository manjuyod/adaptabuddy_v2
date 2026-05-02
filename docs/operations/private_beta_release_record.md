# Private Beta Release Record

This is the latest candidate record. Use `docs/operations/private_beta_release_evidence_pack.md` as the fillable template for the next private beta release candidate.

## Candidate

- Release lane: `Production Beta Readiness`
- Evidence timestamp (UTC): `2026-05-02T16:46:22Z`
- Release candidate ID: `unavailable`
- Commit SHA: `unavailable`
- Short SHA: `unavailable`
- Release owner: `unassigned`
- Environment owner: `unassigned`
- Rollback owner: `unassigned`
- Target host: `http://127.0.0.1:3001`
- Target Supabase project: `vezfyhbrrpokheqipepa`
- Final decision: `HOLD`

Release-confidence evidence is complete for the local container, deployment smoke, live Supabase E2E, Playwright E2E, authenticated analytics probe, and live DB migration/security posture. Promotion remains blocked because the candidate has no immutable git commit metadata and owner/audit signoff is still unavailable.

## Gate Results

| Gate | Result | Evidence |
| --- | --- | --- |
| Candidate metadata | `FAIL` | Git HEAD was unavailable/no commits, so release candidate ID, commit SHA, and short SHA remain `unavailable` |
| Dependency install | `PASS_WITH_ACCEPTED_RISK` | Previous baseline `npm ci` exited 0; npm reported high-severity advisories that still need owner/audit disposition before promotion |
| Typecheck | `PASS` | Previous baseline `npm run typecheck` exited 0 |
| Lint | `PASS` | Previous baseline `npm run lint` exited 0 |
| Workspace tests | `PASS` | Previous baseline `npm run test` exited 0 |
| Web production build | `PASS` | Previous baseline `npm run build --workspace apps/web` exited 0 |
| Docker runtime availability | `PASS` | Docker version/context check passed with `desktop-linux` on `linux/amd64` |
| Docker build | `PASS` | `docker build --secret id=build_env,src=.env -t adaptabuddy-web:engine-27-smoke .` exited 0 |
| Docker runtime smoke | `PASS` | Candidate container ran on port `3001` |
| Local deploy smoke | `PASS` | `npm run verify:deploy:smoke -- http://127.0.0.1:3001` exited 0 |
| Live Supabase E2E | `PASS` | `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts` passed `1/1` after live DB migrations |
| Playwright browser E2E | `PASS` | `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passed `7/7` after Engine 29 hardening |
| Authenticated analytics evidence | `PASS` | Signed-in browser `GET /api/v0/reporting/analytics` returned HTTP `200`, body `status:"success"`, `availability:"unavailable"`, `analyticsPresent:false`, `Cache-Control: no-store`, and `x-request-id` present |
| Migration parity | `PASS` | Supabase migration list now includes numbered migrations `017_engine_15_session_traces` and `018_engine_24_replay_debug_input_material`, plus live parity repair/hardening migrations `engine_session_trace_live_parity` and `restrict_complete_session_atomic_execute` |
| Live DB security posture | `PASS` | Deoxys confirmed `engine_session_traces.input_material` exists; authenticated has SELECT only on `engine_session_traces`; `complete_session_atomic` execute grants are `anon=false`, `authenticated=false`, `service_role=true` |

## Route-Level Smoke Evidence

| Route | Method | Expected result | Current evidence |
| --- | --- | --- | --- |
| `/offline` | `GET` | `200` | Covered by `npm run verify:deploy:smoke -- http://127.0.0.1:3001`; command exited 0 |
| `/api/health` | `GET` | `200` plus `status`, `timestamp`, `supabase`, `x-request-id`, and `Cache-Control: no-store` | Covered by `npm run verify:deploy:smoke -- http://127.0.0.1:3001`; command exited 0 |
| `/api/v0/sessions/generate` | `GET` smoke probe; `POST` authenticated flow | `405` for smoke method-boundary probe; authenticated success via live Supabase E2E | Covered by deploy smoke and live Supabase E2E; both passed |
| `/api/v0/sessions/complete` | `GET` smoke probe; `POST` authenticated flow | `405` for smoke method-boundary probe; authenticated success via live Supabase E2E | Covered by deploy smoke and live Supabase E2E; both passed |
| `/api/v0/reporting/analytics` | `POST` smoke probe; `GET` authenticated flow | `405` for smoke method-boundary probe; authenticated analytics where credentials/env allow | Smoke probe passed; signed-in browser GET returned HTTP `200`, `status:"success"`, `availability:"unavailable"`, `analyticsPresent:false`, `Cache-Control: no-store`, and `x-request-id` present |

## Environment Readiness

| Check | Result | Evidence |
| --- | --- | --- |
| Required Supabase env keys | `PASS` | `.env` supplied the Docker build secret and live verification credentials |
| Target Supabase project | `PASS` | Configured target is `vezfyhbrrpokheqipepa` |
| Live Supabase connectivity | `PASS` | Live Supabase E2E passed `1/1` |
| Docker runtime availability | `PASS` | Docker context/version check passed for `desktop-linux` on `linux/amd64` |
| Release owners assigned | `FAIL` | Release, environment, and rollback owners are `unassigned` |
| Audit/security exception review | `BLOCKED` | High-severity npm audit findings still need triage or explicit accepted-risk approval before promotion |

## Engine 23-29 Status

| Engine spec | Candidate status | Evidence |
| --- | --- | --- |
| Engine 23 app replay invocation alignment | `REVALIDATED` | Completed spec is archived; live Supabase E2E, deploy smoke, and Playwright evidence passed |
| Engine 24 replay bundle and beta debug evidence | `REVALIDATED` | Completed spec is archived; live migrations include replay debug input material and trace parity hardening |
| Engine 25 `stats_json` compatibility sunset map | `REVALIDATED` | Completed spec is archived; live migration parity and beta flows passed |
| Engine 26 cycle/session orchestration reliability | `REVALIDATED` | Completed spec is archived; live generate/complete flows passed through Supabase E2E and Playwright |
| Engine 27 private beta release evidence pack | `COMPLETE` | Evidence pack is filled with release-confidence evidence, explicit final decision, blockers, and owner signoff status |
| Engine 28 cross-language replay certification | `COMPLETE` | Completed spec is archived; certification manifest and independent TypeScript verifier are checked in and verified |
| Engine 29 pre-beta Playwright E2E hardening | `COMPLETE` | Completed spec is archived; `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passed `7/7` with required Chromium desktop/mobile coverage |

## Promotion Blockers

1. Create a real release candidate commit so `git rev-parse --short HEAD` and `git log -1` can identify the artifact.
2. Assign release, environment, and rollback owners before promotion.
3. Triage `npm audit --audit-level=high`, or record explicit owner-approved accepted risk.
4. Capture owner signoff against the immutable candidate commit and final deployment target.

## Accepted Risks

No accepted risks are approved for promotion. The current candidate remains `HOLD`.

| Risk | Status | Notes |
| --- | --- | --- |
| Missing immutable candidate metadata | `NOT_ACCEPTED_FOR_PROMOTION` | Local-working-tree evidence supports Engine 27 implementation acceptance but cannot promote a release without commit metadata |
| Release, environment, and rollback owners unassigned | `NOT_ACCEPTED_FOR_PROMOTION` | Owner approval is required for promotion |
| High-severity npm audit findings | `NOT_ACCEPTED_FOR_PROMOTION` | Requires owner review before any promote decision |

## Owner Signoff

| Owner | Decision | Name | Timestamp (UTC) | Notes |
| --- | --- | --- | --- | --- |
| Release owner | `HOLD` | `unassigned` | `2026-05-02T06:12:04Z` | Release-confidence gates passed, but immutable candidate metadata, owner assignment, and audit disposition remain blockers |
| Environment owner | `HOLD` | `unassigned` | `2026-05-02T06:12:04Z` | Live Supabase and Docker evidence passed; owner signoff still unavailable |
| Rollback owner | `NOT_READY` | `unassigned` | `2026-05-02T06:12:04Z` | No rollback owner assigned |

## Non-Blocking Notes

- Engine 27 implementation acceptance is complete and the spec is archived.
- The candidate should not be promoted until the blockers above are resolved against an immutable commit.
- Engine 28 cross-language replay certification is complete and archived.
- Engine 29 pre-beta Playwright E2E hardening is complete and archived.
