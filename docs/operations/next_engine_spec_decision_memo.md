# Next Engine Spec Decision Memo

Use this memo before opening any new numbered engine spec after Engine 30.

## Decision Rule

Do not open any new numbered engine spec after Engine 30 until local backtest evidence, replay evidence, or live beta evidence demonstrates a boundary-level engine problem or opportunity.

The previous Wave 7-only gate has been demoted because live beta evidence is not useful enough while the product lacks a complete repeatable Season Loop. Engine 30 is opened to create the local headless loop and backtest harness that can produce deterministic evidence before further live testing.

## Required Evidence

Before proposing a new numbered engine spec, collect:

- linked local backtest reports or invariant failures from the Engine 30 harness;
- linked replay receipts or replay bundles for affected engine paths;
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

Only `deterministic-engine-behavior` evidence, local backtest failures, replay failures, or repeated cross-classification evidence that exposes an engine-boundary gap should proceed toward a numbered engine spec after Engine 30.

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

- Decision: `open_engine_spec`
- Proposed spec number: Engine 30
- Proposed title: Headless Season Loop And Backtest Harness
- Evidence status: `sufficient_for_local_build_first`
- Summary: Live beta evidence is currently insufficient because the product loop is incomplete. The next useful evidence source is a local deterministic Season Loop that can run, rank, award, recommend the next season, and backtest chained macrocycles before additional live validation.

### Boundary Analysis

- Why this is not app-shell work: the missing decision is season evaluation and bounded next-cycle direction, which should be deterministic and replayable outside `apps/web`.
- Why this is not adapter-contract work: TypeScript schemas can validate a future route, but they cannot decide rank, awards, or next-season tuning.
- Why this is not persistence-rls work: DB tables can record season transitions, but storage shape must not define the engine boundary.
- Why this is not telemetry-read-model work: read models can present outcomes only after the engine produces canonical outcomes.
- Why this is not replay-debuggability work: replay tooling exists for current operations; the gap is a missing operation and simulator loop.
- Why this is not product-copy work: rank, awards, and next-season direction must be structured engine output, not copy.
- Why the current Rust public engine envelopes are insufficient: the operation set has no season-transition operation after a macrocycle completes.

### Candidate Engine Scope

- Engine operation(s): `advance_cycle`
- Proposed invariant or deterministic fixture: S/A/B/C/D, injury-constrained, and overreach season fixtures plus multi-season replay stability.
- Replay expectation: same canonical chained inputs and seeds produce identical rank, awards, next-cycle request, and replay hashes.
- Public envelope impact: `required` operation-set expansion inside `EngineInputV1` / `EngineOutputV1`
- App integration impact: Wave 9 will add `POST /api/v0/cycles/advance` only after Engine 30 is backtested.
