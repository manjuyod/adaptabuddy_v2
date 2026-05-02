# apps/web Observability Baseline

This document defines the minimum observability baseline for the deployed `apps/web` runtime. It is an operations document for the web shell, not a canonical engine architecture source.

## Goal

Establish minimum observability coverage so production issues in `apps/web` can be detected and triaged quickly during release operations.

## 1. Error Surface Inventory

The following runtime surfaces are the minimum required error inventory for the web shell.

| Surface | Location | Signal | First Check |
|------|------|------|------|
| Root UI runtime failures | `apps/web/app/error.tsx` | Client-side boundary render + console error (`Root error boundary triggered`) | Validate deploy health (`/api/health`) and confirm affected route load path |
| Game route runtime failures | `apps/web/app/(game)/error.tsx` | Client-side boundary render + console error (`Game route error boundary triggered`) | Validate auth/session state and route-level render availability |
| API route error responses | `apps/web/app/api/v0/**/route.ts` | Non-2xx JSON responses (`400/401/404/429/5xx`) and service error payloads | Identify endpoint + status mix, then trace auth/validation/rate-limit/service layers |
| Runtime dependency status | `apps/web/app/api/health/route.ts` | Health payload fields: `status`, `timestamp`, `supabase`, plus `x-request-id` and `Cache-Control: no-store` on the response | If `supabase=error`, the payload/headers are invalid, or non-200 occurs repeatedly, stop promotion and triage infra/dependency |

## 2. Structured Logging Baseline

Critical server actions in `apps/web` (`/api/v0/*` handlers and health probes) must emit structured logs with these fields:

| Field | Requirement | Example |
|------|------|------|
| `timestamp` | UTC ISO string | `2026-02-14T18:20:11.123Z` |
| `route` | Route identifier | `/api/v0/sessions/generate` |
| `action` | Service/action name | `handleGenerateSession` |
| `severity` | `info`, `warn`, or `error` | `error` |
| `userId` | User-scoped identifier when authenticated | `2a4...` |
| `requestId` | Request correlation identifier (from inbound header or generated at edge/proxy) | `2f9c1a...` |
| `statusCode` | HTTP result for request lifecycle events | `400` |
| `reason` | Stable classification for triage | `validation_failed` |

Severity rules:
- `info`: successful request lifecycle completion for critical actions
- `warn`: expected failures such as validation reject, unauthorized, or rate limiting
- `error`: unexpected exceptions, dependency failures, and 5xx responses

Deterministic correlation path:
1. Start from alert timestamp window and endpoint.
2. Filter logs by `route` and `severity`.
3. Correlate by `requestId`; if unavailable, use `timestamp + route + userId` fallback.
4. Follow the error surface mapping above to isolate dependency versus app-layer failure.

Health-probe contract note:
- `/api/health` must echo or generate `x-request-id` so release triage can correlate probe failures.
- `/api/health` must return `Cache-Control: no-store` so release smoke and monitoring probes are not satisfied by stale responses.
- `npm run verify:deploy:smoke` is the executable check for this contract during deploy/release verification.

## 3. Monitoring Baseline

Minimum release monitoring checks for `apps/web` (host + container runtime windows):

| Check | Baseline Target | Alert Trigger |
|------|------|------|
| Health endpoint success rate (`/api/health`) | `>= 99%` over rolling 15 minutes | `< 99%` or payload invalid for 5 consecutive checks |
| API 5xx ratio (`/api/v0/*`) | `< 1%` rolling 10 minutes | `>= 5%` for 10 minutes or `>= 20` 5xx in 5 minutes |
| API 4xx ratio (`/api/v0/*`) | Track baseline by endpoint; investigate sudden shifts | `>= 2x` normal baseline for 15 minutes |
| Auth failures (`401`/session bootstrap failures) | Stable baseline | Spike beyond `2x` rolling 15-minute baseline |
| Route-level availability (`/dashboard`, `/workout`, `/history`) | `>= 99%` route response/render availability | Any sustained availability drop below `99%` for 10 minutes |

## 4. Alert Routing and Runbook Linkage

Primary `apps/web` release docs:
- Deployment verification and rollback: `docs/operations/deployment_verification_checklist.md`
- Release operations runbook: `docs/operations/release_operations_runbook.md`
- This observability baseline: `docs/operations/observability_baseline.md`

Alert ownership and first response:

| Alert | Primary Owner | Backup Owner | First Response |
|------|------|------|------|
| Health degradation (`/api/health`) | Release owner | Environment owner | Execute rollback trigger checks, validate Supabase connectivity |
| 5xx spike on `/api/v0/*` | Release owner | Environment owner | Halt promotion, isolate endpoint, review recent deploy delta, roll back if threshold sustained |
| Auth failure spike (`401`/session failures) | Release owner | Environment owner | Validate Supabase auth health and cookie/session flow; run sign-in path smoke via `/login` (legacy `/auth/login` redirect is optional compatibility coverage) |
| Route availability drop (`/dashboard`/`/workout`/`/history`) | Release owner | Environment owner | Verify middleware/auth guard behavior and route rendering; capture failing path and rollback if sustained |

## Acceptance Criteria

- Observability expectations are documented and linked from the `apps/web` release docs.
- Critical errors can be correlated with a deterministic triage path.
- Alert ownership and first-response path are defined.
