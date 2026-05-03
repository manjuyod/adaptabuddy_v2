# Wave 7 Learning Loop Status

This file is durable handoff memory for Wave 7 private beta operations and learning-loop status.

## Current State

- Wave: `Wave 7: Private Beta Operations And Learning Loop`
- Status: `active`
- Latest promoted candidate: `rc-3db65a2-20260502`
- Candidate evidence: `docs/operations/private_beta_release_record.md`
- Feedback log: `docs/operations/wave_7_beta_feedback_log.md`
- Incident runbook: `docs/operations/beta_incident_runbook.md`
- Next engine-spec gate: `docs/operations/next_engine_spec_decision_memo.md`

## Boundary Notes

- Feedback is app-owned beta operations data, not engine state.
- Incident records are app-owned beta operations data, not engine state.
- Wave 7 does not imply Rust engine envelope changes.
- Wave 7 does not imply a numbered Engine 30 spec.
- A future numbered engine spec requires beta evidence that points to engine-boundary work rather than app-shell, adapter, persistence, telemetry, replay tooling, or copy follow-up.

## Classification Taxonomy

Use the same classification list across feedback, incidents, and the next-spec decision memo:

- `app-shell`
- `adapter-contract`
- `persistence-rls`
- `telemetry-read-model`
- `replay-debuggability`
- `deterministic-engine-behavior`
- `product-copy`
- `unknown`

## Current Evidence Summary

| Area | Status | Notes |
| --- | --- | --- |
| Feedback entries | `none_logged` | Start in `docs/operations/wave_7_beta_feedback_log.md`. |
| Incidents | `none_logged` | Use `docs/operations/beta_incident_runbook.md` for S0/S1 or rollback-relevant issues. |
| Engine-boundary evidence | `none_yet` | No beta evidence currently justifies Engine 30. |
| App-shell follow-ups | `none_yet` | Classify separately from engine-boundary proposals. |
| Rollback decisions | `none_yet` | Tie every incident rollback decision to owner, status, request IDs, replay references, and route evidence. |

## Learning Loop

1. Log beta feedback or incidents with request IDs, replay references, route evidence, severity, owner, and status.
2. Classify each item with one primary classification.
3. Separate app-shell, adapter, persistence-rls, telemetry-read-model, replay-debuggability, and product-copy follow-ups from deterministic-engine-behavior.
4. Promote recurring evidence into the next-spec decision memo only when the evidence shows a boundary-level engine issue.
5. Open no new numbered engine spec until the memo states why beta evidence requires engine-boundary work.

## Open Questions

- Which beta issues repeat across users or sessions?
- Which issues are blocked by missing request/replay/route evidence?
- Which items are app operations work rather than engine-boundary work?
- Is there any replayable deterministic engine behavior that cannot be addressed without changing the Rust public engine envelopes?
