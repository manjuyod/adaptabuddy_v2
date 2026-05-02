# Deployment Verification Checklist (apps/web)

Use this checklist for every `apps/web` launch-candidate deployment before promotion.

## Scope and Ownership

- Scope: this document applies to the deployed `apps/web` runtime only.
- It is an operations doc for the web shell, not a canonical engine architecture document.
- Release owner: executes this checklist and records pass/fail.
- Environment owner: confirms environment parity and migration state.
- Rollback owner: release owner on-call (backup: environment owner).
- Target Supabase project: `vezfyhbrrpokheqipepa`.

## Observability References

- Canonical numbered boundary: `docs/archive/specs/engine_16_operational_release_hardening.md`
- Observability baseline and triage path: `docs/operations/observability_baseline.md`
- Use the observability alert thresholds together with rollback triggers in Section 5 below.

## 1. Build Artifact Verification

- [ ] Install dependencies from lockfile:
  - `npm ci`
- [ ] Verify production web build succeeds:
  - `npm run build --workspace apps/web`
- [ ] Verify Docker Desktop / Docker Engine is available:
  - `docker version`
  - `docker context ls`
  - On Windows, active context should be `desktop-linux` and `docker version` must show a Linux server engine.
- [ ] Verify container build succeeds:
  - `docker build --secret id=build_env,src=.env -t adaptabuddy-web:<release-candidate-id> .`

## 2. Runtime Smoke Verification (Host Runtime)

- [ ] Start production runtime:
  - Terminal A: `cd apps/web && npm run build && npm run start`
- [ ] Run smoke verifier from repo root:
  - Terminal B: `npm run verify:deploy:smoke`
- [ ] Confirm smoke output includes `PASS`.
- [ ] The verifier must accept the `/api/health` response contract:
  - payload fields `status`, `timestamp`, `supabase`
  - `x-request-id` response header
  - `Cache-Control: no-store`
- [ ] The verifier must prove beta-critical routes are present without causing authenticated route side effects:
  - `GET /api/v0/sessions/generate` returns `405`
  - `GET /api/v0/sessions/complete` returns `405`
  - `POST /api/v0/reporting/analytics` returns `405`

## 3. Runtime Smoke Verification (Container Runtime)

- [ ] Start candidate container (supply release env vars):
  - Stop any host runtime listening on the smoke URL, or use the distinct Docker smoke port below.
  - `docker run --rm -d --name adaptabuddy-web-smoke -p 3001:3000 --env-file .env adaptabuddy-web:<release-candidate-id>`
- [ ] Confirm the candidate container is running:
  - `docker ps --filter name=adaptabuddy-web-smoke --filter status=running`
- [ ] Run smoke verifier:
  - `npm run verify:deploy:smoke -- http://127.0.0.1:3001`
- [ ] Cleanup smoke container:
  - `docker stop adaptabuddy-web-smoke`

## 4. Pre-Release Checklist

- [ ] Candidate metadata: commit SHA and release candidate ID are recorded in `docs/operations/private_beta_release_evidence_pack.md` or the release ticket.
- [ ] Env parity: required keys match target environment (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_TARGET_SERVICE_ROLE_KEY`).
- [ ] Migration audit: latest migration in `packages/db/sql/` is applied to target project and no pending schema drift remains.
- [ ] Smoke run completion: host and container smoke both pass.
- [ ] Live Supabase verification status is recorded in the release runbook; it remains manual/gated and outside the default green lane.
- [ ] Authenticated analytics evidence for `GET /api/v0/reporting/analytics` is recorded as `PASS`, `FAIL`, or `BLOCKED`.
- [ ] Playwright browser verification is recorded as `PASS`, `FAIL`, or `BLOCKED`; pre-beta promotion cannot proceed while it is `NOT_RUN`.
- [ ] Engine 23 replay invocation alignment, Engine 24 beta debug evidence, Engine 25 `stats_json` compatibility, and Engine 26 orchestration reliability statuses are recorded with any open exceptions.
- [ ] Blockers and accepted risks are recorded. Required gate failures remain promotion blockers unless the final decision is `HOLD`.
- [ ] Rollback owner and backup owner are explicitly assigned for this release window.

## 5. Rollback Triggers and Actions

| Trigger | Threshold | Action | Owner |
|------|------|------|------|
| Startup failure | App does not serve `/offline` and `/api/health` within 5 minutes | Stop promotion and rollback immediately to previous stable deployment | Release owner |
| Health endpoint degradation | `/api/health` non-200, invalid payload shape, missing `x-request-id`, missing `Cache-Control: no-store`, or `supabase=error` for 5 consecutive checks (1-minute interval) | Roll back and open incident channel | Release owner |
| Critical auth/session regression | Login/session bootstrap failure on core flow (`/login` -> `/dashboard`; legacy `/auth/login` redirect may still be exercised) | Roll back and notify environment owner | Release owner |
| Elevated 5xx rate | `>=5%` 5xx for 10 minutes or `>=20` 5xx in 5 minutes on web/API | Roll back and begin incident triage | Release owner + environment owner |

## 6. Verification Record

- Release candidate:
- Commit SHA:
- Date (UTC):
- Release owner:
- Environment owner:
- Rollback owner:
- Build verification result:
- Host smoke result:
- Container smoke result:
- Migration audit result:
- Live Supabase E2E result:
- Authenticated analytics evidence:
- Playwright result (required pre-beta):
- Engine 23 status:
- Engine 24 status:
- Engine 25 status:
- Engine 26 status:
- Blockers:
- Accepted risks:
- Final decision (promote / hold / rollback):

### Historical Recorded Sign-Off (2026-02-14 UTC)

This record predates the Engine 27 private beta evidence pack and is retained only as historical release evidence. Use `docs/operations/private_beta_release_record.md` and `docs/operations/private_beta_release_evidence_pack.md` for the current private beta decision source.

- Release candidate: `local-working-tree` (no git commit available in current workspace)
- Date (UTC): `2026-02-14T12:08:28Z`
- Release owner: `codex-agent`
- Environment owner: `codex-agent`
- Rollback owner: `codex-agent`
- Build verification result: `PASS` (`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build --workspace apps/web`)
- Live Supabase verification result: `PASS` (`RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`)
- Playwright browser E2E result (historical pre-Engine 29 manual gate): `PASS` (`npm run test:e2e:playwright`)
- Host smoke result: `PASS` (`npm run verify:deploy:smoke`)
- Container smoke result: `NOT RUN` (outside strict backend hardening gate requested for pre-art sign-off)
- Migration audit result: `PASS` (target Supabase now includes `010_sessions_complete_atomic_rpc` and `011_distributed_rate_limit`)
- Final decision (promote / hold / rollback): `HISTORICAL_PROMOTE_ELIGIBLE_FOR_ART_PHASE_START (strict backend hardening gate passed)`
