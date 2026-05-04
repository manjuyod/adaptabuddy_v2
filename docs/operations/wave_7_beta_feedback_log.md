# Wave 7 Beta Feedback Log

Use this log for private beta feedback, support reports, and lightweight triage notes that do not require a full incident record.

## Scope

- Feedback is app-owned beta operations data, not engine state.
- Wave 7 does not imply Rust engine envelope changes.
- Wave 7 does not imply a numbered Engine 30 spec.
- Feedback can inform a future numbered engine spec only after the evidence shows a recurring boundary-level engine problem or opportunity.

Canonical references:
- Roadmap: `specs/overall_plan.md`
- Latest promoted candidate: `docs/operations/private_beta_release_record.md`
- Incident runbook: `docs/operations/beta_incident_runbook.md`
- Next engine-spec gate: `docs/operations/next_engine_spec_decision_memo.md`

## Classification

Use exactly one primary classification for each item:

| Classification | Use when |
| --- | --- |
| `app-shell` | Auth, routing, UI state, product shell orchestration, rate limiting, or user-visible app behavior is the likely source. |
| `adapter-contract` | App-edge validation, TypeScript contract mapping, unit conversion, or engine input/output adapter behavior is the likely source. |
| `persistence-rls` | Supabase rows, migrations, ownership checks, RPC behavior, or RLS enforcement are involved. |
| `telemetry-read-model` | Analytics, reporting, trace retrieval, observability, or support read models are missing or confusing. |
| `replay-debuggability` | The issue cannot be reproduced, replayed, correlated, or explained from available request/replay evidence. |
| `deterministic-engine-behavior` | A replayable engine decision appears deterministic but wrong, incomplete, or poorly specified. |
| `product-copy` | Wording, labels, expectations, or user-facing explanation text caused confusion. |
| `unknown` | Evidence is not sufficient to classify yet. |

## Entry Template

Copy one block per feedback item.

```md
### FDB-YYYYMMDD-###

- Status: `new` / `triaging` / `waiting_for_evidence` / `actionable` / `closed`
- Date opened (UTC):
- Reporter:
- Owner:
- Source: beta user / support report / telemetry review / internal test / other
- Release candidate:
- Environment:
- Route or screen:
- Primary classification:
- Secondary classifications:
- Severity: `low` / `medium` / `high` / `critical`
- User impact:
- Summary:
- Evidence:
  - Request ID:
  - Replay reference:
  - Route evidence:
  - Screenshot/video/log link:
- Triage notes:
- Decision:
- Follow-up link:
- Date closed (UTC):
```

## Active Feedback

### FDB-20260504-001

- Status: `closed`
- Date opened (UTC): `2026-05-04T21:33:10Z`
- Reporter: `internal test`
- Owner: `codex-agent`
- Source: internal test
- Release candidate: `local-working-tree`
- Environment: `local Windows PowerShell beta CLI flow`
- Route or screen: host production smoke setup
- Primary classification: `unknown`
- Secondary classifications: `app-shell`
- Severity: `low`
- User impact: Host smoke verification could not start the local production runtime from the first attempted command wrapper.
- Summary: The beta host smoke orchestration attempted to start `npm` directly through PowerShell `Start-Process`, and Windows rejected the npm shim with `%1 is not a valid Win32 application`.
- Evidence:
  - Request ID: `n/a`
  - Replay reference: `n/a`
  - Route evidence: host runtime did not start before route checks
  - Screenshot/video/log link: `.tmp/next-start.err.log`
- Triage notes: Used the Windows command shim `npm.cmd` for background `Start-Process` execution, then reran the host smoke gate.
- Decision: `closed_after_host_smoke_passed`
- Follow-up link:
- Date closed (UTC): `2026-05-04T21:34:00Z`

### FDB-20260504-002

- Status: `closed`
- Date opened (UTC): `2026-05-04T21:38:56Z`
- Reporter: `internal test`
- Owner: `codex-agent`
- Source: internal test
- Release candidate: `local-working-tree`
- Environment: `local Playwright live Supabase beta gate`
- Route or screen: `/onboarding`
- Primary classification: `app-shell`
- Secondary classifications: `persistence-rls`
- Severity: `high`
- User impact: A desktop user may be unable to complete first-run onboarding in the pre-beta browser flow.
- Summary: `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` failed in the desktop onboarding test because `onboarding-step-confirmation` did not become visible after filling the first program input and clicking Next.
- Evidence:
  - Request ID: `n/a`
  - Replay reference: `n/a`
  - Route evidence: Playwright failure in `tests/e2e/playwright/user-journey.spec.ts`
  - Screenshot/video/log link: `apps/web/test-results/user-journey-Pre-beta-live-ca46e-es-a-first-training-profile-chromium-desktop/trace.zip`
- Triage notes: Root cause was an outdated Playwright journey after live program ordering began selecting a challenge-progression template first. The product UI correctly required a max-rep baseline before allowing confirmation. Updated the browser journey to fill the visible challenge baseline input before continuing.
- Decision: `closed_after_playwright_passed`
- Follow-up link: `apps/web/tests/e2e/playwright/user-journey.spec.ts`
- Date closed (UTC): `2026-05-04T21:41:21Z`

### FDB-20260504-003

- Status: `actionable`
- Date opened (UTC): `2026-05-04T22:27:00Z`
- Reporter: `internal test`
- Owner: `codex-agent`
- Source: internal test
- Release candidate: `local-working-tree`
- Environment: `local engine/app integration planning`
- Route or screen: cycle transition / next season preview
- Primary classification: `deterministic-engine-behavior`
- Secondary classifications: `adapter-contract`
- Severity: `medium`
- User impact: A user whose first cycle blends powerlifting, bench specialization, and challenge work may not see that exact blend intelligently evolved in the next-cycle request after season advancement.
- Summary: True initial-cycle blending now aggregates selected program work, but next-season personalization remains generic and should become a separate replay-backed engine spec once beta evidence confirms the transition behavior users expect.
- Evidence:
  - Request ID: `n/a`
  - Replay reference: `pending future advance_cycle replay evidence`
  - Route evidence: `packages/engine-rs/src/adaptation/advance_cycle.rs`
  - Screenshot/video/log link:
- Triage notes: Keep this out of the current onboarding/initialize-cycle slice. The current implementation preserves compatibility by leaving `advance_cycle` next-cycle generation unchanged.
- Decision: `track_for_future_engine_spec`
- Follow-up link: `docs/operations/next_engine_spec_decision_memo.md`
- Date closed (UTC):

## Rollup

| Classification | Count | Notes |
| --- | ---: | --- |
| `app-shell` | 1 | `FDB-20260504-002` |
| `adapter-contract` | 0 | secondary on `FDB-20260504-003` |
| `persistence-rls` | 0 |  |
| `telemetry-read-model` | 0 |  |
| `replay-debuggability` | 0 |  |
| `deterministic-engine-behavior` | 1 | `FDB-20260504-003` |
| `product-copy` | 0 |  |
| `unknown` | 1 | `FDB-20260504-001` |

## Engine-Spec Gate

Do not open Engine 30 from a single anecdote. Before proposing a new numbered engine spec, link the relevant feedback items into `docs/operations/next_engine_spec_decision_memo.md` and show:

- repeated beta evidence, or one severe replayable defect;
- request IDs and replay references where applicable;
- why the issue is not app-shell, adapter, persistence, telemetry, or copy work;
- why the current Rust public engine envelopes are insufficient.
