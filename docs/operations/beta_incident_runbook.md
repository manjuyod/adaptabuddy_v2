# Beta Incident Runbook

Use this runbook for private beta issues that need coordinated response, rollback evaluation, or durable incident tracking.

## Scope

- This is an `apps/web` beta operations document, not a canonical engine architecture source.
- Feedback and incident records are app-owned beta operations data, not engine state.
- Wave 7 does not imply Rust engine envelope changes or a numbered Engine 30 spec.
- Engine-boundary work requires beta evidence and a completed decision memo before any new numbered engine spec is opened.

Related docs:
- Release operations: `docs/operations/release_operations_runbook.md`
- Deployment rollback triggers: `docs/operations/deployment_verification_checklist.md`
- Observability baseline: `docs/operations/observability_baseline.md`
- Feedback log: `docs/operations/wave_7_beta_feedback_log.md`
- Next engine-spec decision memo: `docs/operations/next_engine_spec_decision_memo.md`

## Severity

Incident severity is separate from the user feedback severity stored by
`public.beta_feedback_reports` (`low`, `medium`, `high`, `critical`). Use `S0`-`S3`
only when an issue needs coordinated incident response.

| Severity | Meaning | Default response |
| --- | --- | --- |
| `S0` | Private beta is broadly unavailable, data integrity is at risk, or auth/security boundaries appear broken. | Halt promotion or active rollout, evaluate rollback immediately, assign release and environment owners. |
| `S1` | Beta-critical workflow is failing for one or more users, including generate, complete, onboarding, login, or analytics evidence needed for support. | Assign owner, collect request/replay/route evidence, decide rollback or hotfix path. |
| `S2` | User-visible defect has a workaround or limited impact. | Track in feedback log or incident record, schedule fix after evidence review. |
| `S3` | Minor copy, confusion, or support observation. | Track in feedback log unless it becomes recurring. |

## Classification

Use one primary classification:

- `app-shell`
- `adapter-contract`
- `persistence-rls`
- `telemetry-read-model`
- `replay-debuggability`
- `deterministic-engine-behavior`
- `product-copy`
- `unknown`

## First Response Checklist

1. Assign an incident owner and status.
2. Capture the release candidate, environment, route or screen, and timestamp window.
3. Record request IDs from logs, response headers, or user-provided evidence.
4. Record replay references for engine-invoking paths:
   - replay receipt
   - trace row or support read-model reference
   - operation name: `initialize_cycle`, `plan_session`, or `complete_session`
5. Capture route evidence:
   - endpoint or page
   - HTTP method and status code
   - response shape or browser-visible failure
   - screenshot, video, log excerpt, or smoke-test output
6. Set severity and primary classification.
7. Make an explicit rollback decision: `not_evaluated`, `not_required`, `evaluate`, `rollback`, or `hold`.
8. Update owner and status after every material decision.

## Rollback Decision Rules

Use the rollback thresholds in `docs/operations/deployment_verification_checklist.md` and `docs/operations/observability_baseline.md`.

Rollback is the default recommendation for:
- S0 incidents;
- sustained health endpoint degradation;
- critical auth/session regression;
- elevated 5xx rate above the deployment checklist threshold;
- evidence that writes are corrupting app persistence or bypassing RLS enforcement.

Rollback is not automatic for:
- deterministic engine behavior questions with valid replay evidence and no data integrity risk;
- copy or explanation confusion;
- isolated beta reports with no route, request ID, replay, or telemetry evidence yet.

## Incident Record Template

Copy one block per incident.

```md
### INC-YYYYMMDD-###

- Status: `open` / `monitoring` / `mitigated` / `resolved` / `closed`
- Severity: `S0` / `S1` / `S2` / `S3`
- Primary classification:
- Secondary classifications:
- Opened at (UTC):
- Last updated at (UTC):
- Incident owner:
- Release owner:
- Environment owner:
- Rollback owner:
- Release candidate:
- Commit SHA:
- Environment:
- User impact:
- Affected route evidence:
  - Route or screen:
  - Method:
  - Status code:
  - Browser-visible result:
  - Smoke/test/log reference:
- Correlation evidence:
  - Request ID(s):
  - User-scoped identifier, if safe to record:
  - Timestamp window:
- Replay evidence:
  - Operation:
  - Replay receipt:
  - Trace/read-model reference:
  - Reproduction status: `not_applicable` / `pending` / `reproduced` / `not_reproduced`
- Rollback decision:
  - Decision: `not_evaluated` / `not_required` / `evaluate` / `rollback` / `hold`
  - Decider:
  - Decision timestamp (UTC):
  - Reason:
- Timeline:
  - `YYYY-MM-DDTHH:MM:SSZ` -
- Mitigation:
- Root cause:
- Follow-up:
- Closure evidence:
```

## Active Incidents

No Wave 7 beta incidents have been logged yet.
