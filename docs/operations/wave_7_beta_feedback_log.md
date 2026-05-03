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

No Wave 7 beta feedback has been logged yet.

## Rollup

| Classification | Count | Notes |
| --- | ---: | --- |
| `app-shell` | 0 |  |
| `adapter-contract` | 0 |  |
| `persistence-rls` | 0 |  |
| `telemetry-read-model` | 0 |  |
| `replay-debuggability` | 0 |  |
| `deterministic-engine-behavior` | 0 |  |
| `product-copy` | 0 |  |
| `unknown` | 0 |  |

## Engine-Spec Gate

Do not open Engine 30 from a single anecdote. Before proposing a new numbered engine spec, link the relevant feedback items into `docs/operations/next_engine_spec_decision_memo.md` and show:

- repeated beta evidence, or one severe replayable defect;
- request IDs and replay references where applicable;
- why the issue is not app-shell, adapter, persistence, telemetry, or copy work;
- why the current Rust public engine envelopes are insufficient.
