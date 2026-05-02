# Private Beta Release Evidence Pack

Use this evidence pack for every private beta release candidate. It turns the release runbook into a fillable decision record: every gate must have an owner, command, result, timestamp, and evidence pointer.

This document is operations evidence only. It does not redefine engine boundaries or roadmap scope.

## Candidate Metadata

| Field | Value |
| --- | --- |
| Release lane | `Production Beta Readiness` |
| Release candidate ID | `rc-<short-sha>-<YYYYMMDD>` |
| Commit SHA | `<full commit SHA>` |
| Short SHA | `<git rev-parse --short HEAD>` |
| Commit summary | `<git log -1 --pretty=format:"%h %ad %s" --date=iso>` |
| Evidence pack started at (UTC) | `<YYYY-MM-DDTHH:MM:SSZ>` |
| Target host | `<local, staging, or production URL>` |
| Target Supabase project | `vezfyhbrrpokheqipepa` |
| Release owner | `<name>` |
| Environment owner | `<name>` |
| Rollback owner | `<name>` |
| Final decision | `PENDING` / `PROMOTE` / `HOLD` / `ROLLBACK` |

Promotion is blocked until the commit SHA, release candidate ID, all required owners, and final decision are filled.

## Required Evidence Sequence

Run the evidence gates in this order so later failures can be attributed to a known candidate artifact.

| Order | Gate | Command or action | Required for promotion |
| --- | --- | --- | --- |
| 1 | Candidate metadata | `git rev-parse HEAD`; `git log -1 --pretty=format:"%h %ad %s" --date=iso` | Yes |
| 2 | Dependency install | `npm ci` | Yes |
| 3 | Typecheck | `npm run typecheck` | Yes |
| 4 | Lint | `npm run lint` | Yes |
| 5 | Test suite | `npm run test` | Yes |
| 6 | Production web build | `npm run build --workspace apps/web` | Yes |
| 7 | Local deploy smoke | Terminal A: `cd apps/web && npm run build && npm run start`; Terminal B: `npm run verify:deploy:smoke` | Yes |
| 8 | Docker build | `docker version`; `docker context ls`; `docker build --secret id=build_env,src=.env -t adaptabuddy-web:<release-candidate-id> .` | Yes |
| 9 | Docker runtime smoke | `docker run --rm -d --name adaptabuddy-web-smoke -p 3001:3000 --env-file .env adaptabuddy-web:<release-candidate-id>`; `docker ps --filter name=adaptabuddy-web-smoke --filter status=running`; `npm run verify:deploy:smoke -- http://127.0.0.1:3001`; `docker stop adaptabuddy-web-smoke` | Yes |
| 10 | Environment readiness | Complete the environment checklist below | Yes |
| 11 | Migration parity | Compare latest local migration with target `supabase_migrations.schema_migrations` | Yes |
| 12 | Live Supabase E2E | `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts` | Yes, manual/gated |
| 13 | Authenticated analytics evidence | Credentialed `GET /api/v0/reporting/analytics` against the candidate host, or live/manual evidence proving the deterministic analytics route returns `status:"success"` with `availability` | Yes, manual/gated |
| 14 | Playwright browser breaker suite | `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` | Yes, pre-beta required |
| 15 | Owner signoff | Complete owner signoff and final decision | Yes |

Allowed result values: `PENDING`, `PASS`, `FAIL`, `NOT_RUN`, `BLOCKED`, `PASS_WITH_ACCEPTED_RISK`.

## Gate Results

| Gate | Result | Started at (UTC) | Finished at (UTC) | Owner | Evidence pointer |
| --- | --- | --- | --- | --- | --- |
| Candidate metadata | `PENDING` |  |  | Release owner |  |
| Dependency install | `PENDING` |  |  | Release owner |  |
| Typecheck | `PENDING` |  |  | Release owner |  |
| Lint | `PENDING` |  |  | Release owner |  |
| Test suite | `PENDING` |  |  | Release owner |  |
| Production web build | `PENDING` |  |  | Release owner |  |
| Local deploy smoke | `PENDING` |  |  | Release owner |  |
| Docker build | `PENDING` |  |  | Release owner |  |
| Docker runtime smoke | `PENDING` |  |  | Release owner |  |
| Environment readiness | `PENDING` |  |  | Environment owner |  |
| Migration parity | `PENDING` |  |  | Environment owner |  |
| Live Supabase E2E manual gate | `PENDING` |  |  | Environment owner |  |
| Authenticated analytics manual gate | `PENDING` |  |  | Environment owner |  |
| Playwright pre-beta gate | `PENDING` |  |  | Release owner |  |

## Route-Level Smoke Evidence

`npm run verify:deploy:smoke` is the executable route smoke gate for local and Docker runtimes. Capture the command output for both runs.

| Route | Method | Expected unauthenticated result | Evidence source |
| --- | --- | --- | --- |
| `/offline` | `GET` | `200` | `npm run verify:deploy:smoke` |
| `/api/health` | `GET` | `200`; payload has `status`, `timestamp`, `supabase`; response has `x-request-id` and `Cache-Control: no-store` | `npm run verify:deploy:smoke` |
| `/api/v0/sessions/generate` | `GET` smoke probe; `POST` live/manual flow | `405` for smoke method-boundary probe without credentials or DB writes; successful generation covered by live Supabase E2E when credentials/env allow | `npm run verify:deploy:smoke`; live Supabase E2E |
| `/api/v0/sessions/complete` | `GET` smoke probe; `POST` live/manual flow | `405` for smoke method-boundary probe without credentials or DB writes; successful completion covered by live Supabase E2E when credentials/env allow | `npm run verify:deploy:smoke`; live Supabase E2E |
| `/api/v0/reporting/analytics` | `POST` smoke probe; `GET` authenticated flow | `405` for smoke method-boundary probe without credentials or DB writes; authenticated analytics read must be proven by API/reporting tests plus live/manual candidate evidence where credentials/env allow | `npm run verify:deploy:smoke`; authenticated analytics manual gate |

If an authenticated route check cannot run because credentials, test users, or live env access are unavailable, record `BLOCKED` with the missing dependency. Do not convert it to an informal note.

## Environment Readiness

| Check | Command or source | Result | Evidence pointer |
| --- | --- | --- | --- |
| Required Supabase env keys present | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_TARGET_SERVICE_ROLE_KEY` | `PENDING` |  |
| Target project matches release target | Supabase URL includes `vezfyhbrrpokheqipepa.supabase.co` | `PENDING` |  |
| Live Supabase DNS/connectivity works | live E2E setup can reach target host | `PENDING` |  |
| Release test user available | Supabase Auth test user exists or setup succeeds | `PENDING` |  |
| Docker runtime available | Docker Linux engine can build and run the candidate image | `PENDING` |  |
| Audit/security exceptions reviewed | `npm audit --audit-level=high` or accepted exception reference | `PENDING` |  |

## Migration Parity

| Check | Evidence |
| --- | --- |
| Local latest migration | `node -e "const fs=require('fs');const files=fs.readdirSync('packages/db/sql').filter((f)=>f.endsWith('.sql')).sort();console.log(files[files.length-1]);"` |
| Target latest migrations | Supabase SQL Editor: `select version, name from supabase_migrations.schema_migrations order by version desc limit 5;` |
| Parity decision | `PASS` / `FAIL` / `BLOCKED` |
| Notes | Record pending migrations, out-of-band migrations, or why target DB could not be reached. |

## Engine 23-26 Release Status

| Engine spec | Status for this candidate | Evidence to capture |
| --- | --- | --- |
| Engine 23 app replay invocation alignment | `PENDING` | Confirm app-built `initialize_cycle`, `plan_session`, and `complete_session` inputs use replay-compliant hashes and `canon-replay-v1`; cite test output or exception. |
| Engine 24 replay bundle and beta debug evidence | `PENDING` | Confirm plan/completion trace evidence is retrievable, redacted, and classifiable for beta support; cite test output or exception. |
| Engine 25 `stats_json` compatibility sunset map | `PENDING` | Confirm normalized/read-model sources remain authoritative and any compatibility projection exceptions are documented. |
| Engine 26 cycle/session orchestration reliability | `PENDING` | Confirm generate/complete/idempotency/retry/rollback behavior is covered by tests and live E2E where available. |

Any open exception in Engine 23-26 must appear in either `Blockers` or `Accepted Risks` before signoff.

## Blockers

| ID | Blocker | Owner | Required resolution | Status |
| --- | --- | --- | --- | --- |
| `B-001` |  |  |  | `OPEN` |

## Accepted Risks

Accepted risks require release-owner and environment-owner approval. A failed required gate cannot be accepted unless the final decision remains `HOLD`.

| ID | Risk | Impact | Mitigation | Approved by | Status |
| --- | --- | --- | --- | --- | --- |
| `R-001` |  |  |  |  | `PENDING` |

## Owner Signoff

| Owner | Decision | Name | Timestamp (UTC) | Notes |
| --- | --- | --- | --- | --- |
| Release owner | `PENDING` / `APPROVE` / `HOLD` / `ROLLBACK` |  |  |  |
| Environment owner | `PENDING` / `APPROVE` / `HOLD` / `ROLLBACK` |  |  |  |
| Rollback owner | `PENDING` / `READY` / `NOT_READY` |  |  |  |

Final decision rules:

- `PROMOTE`: all required gates are `PASS` or explicitly approved `PASS_WITH_ACCEPTED_RISK`; live Supabase E2E passed; authenticated analytics evidence passed; owners approve.
- `HOLD`: any required gate is `FAIL`, `BLOCKED`, or `NOT_RUN`.
- `ROLLBACK`: candidate was deployed and a rollback trigger from the deployment checklist fired.
