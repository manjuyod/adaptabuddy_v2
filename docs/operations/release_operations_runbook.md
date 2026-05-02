# Release Operations Runbook (apps/web)

Use this runbook for every `apps/web` launch-candidate release before production promotion.

## Scope

- Scope: this runbook applies to the `apps/web` deployment pipeline only.
- It is a web-shell operations document, not a canonical engine architecture source.
- Target web app: `apps/web` (Next.js standalone deployment artifact)
- Target Supabase project: `vezfyhbrrpokheqipepa`
- Required dependency docs:
  - `docs/archive/specs/engine_16_operational_release_hardening.md`
  - `.github/workflows/ci-quality-gates.yml`
  - `docs/operations/deployment_verification_checklist.md`
  - `docs/operations/private_beta_release_evidence_pack.md`
  - `docs/operations/observability_baseline.md`

## Ownership Matrix

| Release Activity | Responsible Owner | Accountable Owner | Backup Owner |
|------|------|------|------|
| Required quality gates (`typecheck`, `lint`, `test`, `build`) | Change author | Release owner | Environment owner |
| Migration state verification | Environment owner | Environment owner | Release owner |
| Candidate deploy execution | Release owner | Release owner | Environment owner |
| Promotion approval decision | Release owner + environment owner (joint sign-off) | Release owner | Environment owner |
| Incident response + rollback execution | Release owner on-call | Release owner | Environment owner |

## Stage 1: Candidate Creation

1. Capture immutable candidate metadata:
   - `git rev-parse HEAD`
   - `git rev-parse --short HEAD`
   - `git log -1 --pretty=format:"%h %ad %s" --date=iso`
2. Confirm dependency lockfile install succeeds:
   - `npm ci`
3. Record candidate identifier in release ticket:
   - `release_candidate=rc-<short_sha>-<YYYYMMDD>`
   - `commit_sha=<full_sha>`
   - `release_date_utc=<ISO timestamp>`
4. Open a candidate evidence record from `docs/operations/private_beta_release_evidence_pack.md`.

Promotion is blocked if candidate metadata, release candidate ID, or owner assignments are missing.

## Stage 2: Verification Execution

For the private beta lane, run the sequence in this order:

1. Local clean-room quality gates.
2. Local production runtime smoke.
3. Docker build, Docker runtime smoke, and container cleanup.
4. Environment readiness and migration parity.
5. Live Supabase endpoint verification.
6. Authenticated analytics evidence.
7. Required Playwright browser verification.

This ordering is the current launch path for the private beta. Engine 22 canonical replay implementation is complete and is not a separate promotion blocker.

### 2.1 Required Quality Gates

Run from repo root:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build --workspace apps/web`

All required checks must pass for promotion eligibility.

### 2.2 Deployment Verification

- Follow `docs/operations/deployment_verification_checklist.md` Sections 1-4
- For local production runtime verification:
  - Terminal A: `cd apps/web && npm run build && npm run start`
  - Terminal B: `npm run verify:deploy:smoke`
- For Docker runtime verification:
  - `docker version`
  - `docker context ls`
  - On Windows, confirm Docker Desktop is running the Linux/WSL2 engine and the active context is `desktop-linux`.
  - `docker build --secret id=build_env,src=.env -t adaptabuddy-web:<candidate> .`
  - Stop the local host runtime from Section 2.2, or keep it on a different port.
  - `docker run --rm -d --name adaptabuddy-web-smoke -p 3001:3000 --env-file .env adaptabuddy-web:<candidate>`
  - `docker ps --filter name=adaptabuddy-web-smoke --filter status=running`
  - `npm run verify:deploy:smoke -- http://127.0.0.1:3001`
  - `docker stop adaptabuddy-web-smoke`
- Required command:
  - `npm run verify:deploy:smoke`
- This verifier is release/deploy evidence, not optional documentation-only guidance.
- Pass means:
  - `/offline` responds successfully
  - `/api/health` responds successfully
  - health payload includes `status`, `timestamp`, and `supabase`
  - `/api/health` includes `x-request-id`
  - `/api/health` includes `Cache-Control: no-store`
  - `GET /api/v0/sessions/generate` returns `405` as a non-mutating method-boundary probe
  - `GET /api/v0/sessions/complete` returns `405` as a non-mutating method-boundary probe
  - `POST /api/v0/reporting/analytics` returns `405` as a non-mutating method-boundary probe
  - authenticated generate, complete, and analytics evidence is linked from live Supabase E2E or a manual credentialed check when credentials and environment allow

### 2.3 Live Supabase Endpoint Verification

Manual pre-release live verification command:

- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`

This validates live generate/complete/history endpoint flow against the target project.
This lane is manual and gated. It is required release-confidence evidence for promotion, but it is not part of the default CI/green lane.

Record the live gate in the evidence pack as `PASS`, `FAIL`, or `BLOCKED`. If blocked, capture the missing dependency, such as DNS, Supabase credentials, target migrations, or release test-user setup.

Also record authenticated analytics evidence for the candidate:

- Credentialed check: `GET /api/v0/reporting/analytics`
- Pass: response is `200`, `status` is `success`, `availability` is recorded, and any `analytics:null` response is classified as either expected empty normalized data or a release blocker.
- If the credentialed analytics check cannot run, record `BLOCKED` with the missing credential, environment, or data dependency. Promotion remains blocked unless the final decision is `HOLD`.

### 2.4 Required Playwright Browser Verification

Required pre-beta browser confidence command:

- `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright`

This lane remains manual and outside the default CI green lane, but it is a hard pre-beta promotion gate. Capture `PASS`, `FAIL`, or `BLOCKED` in the release record. Promotion remains blocked while this gate is `NOT_RUN`, `FAIL`, or `BLOCKED`.

For private beta, the Playwright suite records browser-visible evidence for:

- auth/session boundaries and cookie persistence
- onboarding validation and profile persistence
- settings persistence
- workout route recovery, generation, completion, dashboard, and history
- guardrail warning/blocker paths
- authenticated analytics with `Cache-Control: no-store`
- Chromium desktop and Chromium mobile workout coverage

## Stage 3: Environment Readiness Checklist

Run before approval:

1. Confirm required release env keys exist:
   - `node -e "const required=['SUPABASE_URL','SUPABASE_ANON_KEY','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'];const missing=required.filter((k)=>!process.env[k]);const hasServiceRole=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_TARGET_SERVICE_ROLE_KEY;if(!hasServiceRole)missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_TARGET_SERVICE_ROLE_KEY');if(missing.length){console.error('Missing env keys:',missing.join(', '));process.exit(1);}console.log('PASS env keys present');"`
2. Confirm Supabase target project URL matches release target:
   - `node -e "const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'';if(!url.includes('vezfyhbrrpokheqipepa.supabase.co')){console.error('Unexpected Supabase URL:',url);process.exit(1);}console.log('PASS target project URL:',url);"`
3. Confirm migration parity:
   - Local latest migration file:
     - `node -e "const fs=require('fs');const files=fs.readdirSync('packages/db/sql').filter((f)=>f.endsWith('.sql')).sort();console.log('Local latest migration:',files[files.length-1]);"`
   - Target DB query (Supabase SQL Editor):
     - `select version, name from supabase_migrations.schema_migrations order by version desc limit 5;`
   - Pass criteria: no pending local migration beyond target release scope
4. Confirm release flags/policy:
   - `RUN_SUPABASE_E2E_VERIFICATION=1` for pre-release live verification run
   - `RUN_PLAYWRIGHT_E2E=1` for required pre-beta Playwright browser verification

## Stage 4: Promotion Decision and Sign-Off

Promotion is allowed only if all gates below are `PASS` or explicitly approved `PASS_WITH_ACCEPTED_RISK` in the evidence pack:

- Candidate metadata includes commit SHA and release candidate ID
- Quality gates complete
- Deployment verification checklist complete
- Docker runtime smoke complete
- Environment readiness checklist complete
- Migration parity confirmed
- Live Supabase endpoint verification complete
- Authenticated analytics evidence complete
- Playwright browser E2E complete
- Engine 23 replay invocation alignment status recorded
- Engine 24 beta debug evidence status recorded
- Engine 25 `stats_json` compatibility status recorded
- Engine 26 orchestration reliability status recorded
- Blockers and accepted risks recorded
- Rollback owner assignment confirmed

Required joint sign-off:

- Release owner: `APPROVE` / `HOLD` / `ROLLBACK`
- Environment owner: `APPROVE` / `HOLD` / `ROLLBACK`

If either owner selects `HOLD` or `ROLLBACK`, promotion is blocked.

## Stage 5: Immediate Post-Release Validation

Execute within 15 minutes of deploy:

1. Health endpoint:
   - `npm run verify:deploy:smoke -- https://<release-host>`
   - Pass: `/offline` and `/api/health` checks return `PASS`, and the verifier accepts the health payload plus `x-request-id` / `Cache-Control: no-store` contract
2. Auth sign-in path:
   - Browser check: `/login` -> sign in with release test user -> redirected to `/dashboard`
   - Legacy compatibility check is optional: `/auth/login` should still redirect to `/login`
   - Pass: no login error and authenticated route renders
3. Onboarding start path:
   - Browser check: `/title/start` -> select `New Game` -> route reaches `/onboarding`
   - Pass: onboarding first step renders without runtime error boundary
4. Workout generate/complete path:
   - Browser check: `/workout` -> generate session -> `/workout/log` -> submit completion
   - Pass: completion success state appears and no 5xx responses occur
5. History route availability:
   - Browser check: `/history` and latest workout detail route
   - Pass: list loads and latest detail page renders

Any failure triggers rollback evaluation using the deployment checklist thresholds.

## Rollback Path

Use rollback triggers and actions defined in:

- `docs/operations/deployment_verification_checklist.md`
- `docs/operations/observability_baseline.md`

Minimum rollback action sequence:

1. Halt promotion immediately.
2. Roll back deployment to last known stable artifact in hosting platform.
3. Re-run `npm run verify:deploy:smoke -- https://<rolled-back-host>`.
4. Open incident record with trigger, timestamp (UTC), and owner assignment.

## Release Record Template

- Release candidate:
- Commit SHA:
- Date (UTC):
- Release owner:
- Environment owner:
- Rollback owner:
- Target host:
- Target Supabase project:
- Quality gates result:
- Production build result:
- Deployment verification result:
- Docker build result:
- Docker runtime smoke result:
- Env readiness result:
- Migration parity result:
- Live Supabase verification result:
- Authenticated analytics evidence:
- Playwright browser E2E result (required pre-beta):
- Engine 23 status:
- Engine 24 status:
- Engine 25 status:
- Engine 26 status:
- Blockers:
- Accepted risks:
- Post-release validation result:
- Final decision (`promote` / `hold` / `rollback`):
- Notes and incident links:
