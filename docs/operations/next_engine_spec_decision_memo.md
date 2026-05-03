# Next Engine Spec Decision Memo

Use this memo before opening any new numbered engine spec after Wave 7 beta operations begin.

## Decision Rule

Do not open Engine 30, or any other new numbered engine spec, until beta evidence demonstrates a boundary-level engine problem or opportunity.

Wave 7 does not imply Rust engine envelope changes. Wave 7 does not imply a numbered Engine 30 spec. Feedback and incidents are app-owned beta operations data, not engine state.

## Required Evidence

Before proposing a new numbered engine spec, collect:

- linked feedback entries from `docs/operations/wave_7_beta_feedback_log.md`;
- linked incident records from `docs/operations/beta_incident_runbook.md`, when applicable;
- request IDs for affected runtime paths;
- replay references for engine-invoking paths;
- route evidence for the app/API/UI behavior that exposed the issue;
- severity and user impact;
- owner and status for each source item;
- a clear explanation of why the issue is not adequately addressed as app-shell, adapter-contract, persistence-rls, telemetry-read-model, replay-debuggability, or product-copy work.

## Classification

Use one primary classification for each evidence item:

- `app-shell`
- `adapter-contract`
- `persistence-rls`
- `telemetry-read-model`
- `replay-debuggability`
- `deterministic-engine-behavior`
- `product-copy`
- `unknown`

Only `deterministic-engine-behavior` evidence, or repeated cross-classification evidence that exposes an engine-boundary gap, should proceed toward a numbered engine spec.

## Memo Template

```md
## Proposed Decision: YYYY-MM-DD

- Decision: `no_engine_spec` / `open_engine_spec` / `defer_pending_evidence`
- Proposed spec number:
- Proposed title:
- Decision owner:
- Evidence status: `insufficient` / `sufficient`
- Summary:

### Evidence Links

| Source | ID | Classification | Severity | Request ID | Replay reference | Route evidence | Owner/status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| feedback / incident |  |  |  |  |  |  |  |

### Boundary Analysis

- Why this is not app-shell work:
- Why this is not adapter-contract work:
- Why this is not persistence-rls work:
- Why this is not telemetry-read-model work:
- Why this is not replay-debuggability work:
- Why this is not product-copy work:
- Why the current Rust public engine envelopes are insufficient:

### Candidate Engine Scope

- Engine operation(s):
- Proposed invariant or deterministic fixture:
- Replay expectation:
- Public envelope impact: `none` / `possible` / `required`
- App integration impact:

### Decision

- Final decision:
- Decider:
- Date (UTC):
- Follow-up:
```

## Current Decision

- Decision: `defer_pending_evidence`
- Proposed spec number: none
- Evidence status: `insufficient`
- Summary: No Wave 7 beta feedback or incidents have been logged yet. No beta evidence currently justifies Rust engine envelope changes or a numbered Engine 30 spec.
