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

## Proposed Decision: 2026-05-04

- Decision: `open_engine_spec`
- Proposed spec number: Engine 32
- Proposed title: Personalized Next-Cycle Blend Evolution
- Decision owner: `user`
- Evidence status: `sufficient`
- Summary: Initial-cycle blending is now implemented and locally rehearsed, but `advance_cycle` still builds a generic next-cycle request that can drop the user's actual selected blend. Feedback `FDB-20260504-003` is an actionable deterministic-engine behavior gap because the season transition should preserve and evolve engine-owned program blend, baselines, fatigue, injuries, and adherence signals in a replayable way.

### Evidence Links

| Source | ID | Classification | Severity | Request ID | Replay reference | Route evidence | Owner/status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| feedback | `FDB-20260504-003` | `deterministic-engine-behavior` | `medium` | `n/a` | `pending advance_cycle blended fixture` | `packages/engine-rs/src/adaptation/advance_cycle.rs` | `codex-agent/actionable` |
| rehearsal | `rc-8e79ef3-20260504` | `deterministic-engine-behavior` | `medium` | `n/a` | `cargo test --manifest-path packages/engine-rs/Cargo.toml --test initialize_cycle initialize_cycle_` | local beta rehearsal | `user/ready_for_remote_deploy` |

### Boundary Analysis

- Why this is not app-shell work: the app can pass current-cycle context, but deciding how a blended cycle evolves after a season is deterministic training-engine behavior.
- Why this is not adapter-contract work: schemas can validate the additional context fields, but they cannot decide blend retention, weight changes, fatigue carry-forward, or baseline preservation.
- Why this is not persistence-rls work: persisted cycle rows are reference input only; storage must not define the evolution rules.
- Why this is not telemetry-read-model work: read models can present the next-season preview only after the engine emits structured next-cycle direction.
- Why this is not replay-debuggability work: replay receipts already exist; the missing piece is the replayable rule set for personalized next-cycle evolution.
- Why this is not product-copy work: the output must be a valid `initialize_cycle` request, not explanatory text.
- Why the current Rust public engine envelopes are insufficient: `advance_cycle` currently accepts season signals but not enough current-cycle context to preserve actual selected program blend, baselines, injuries, and fatigue intent.

### Candidate Engine Scope

- Engine operation(s): `advance_cycle`, with compatibility checks through `initialize_cycle`
- Proposed invariant or deterministic fixture: powerlifting + bench + 100 push-ups, squat/deadlift 225, bench 100, push-up max 20, knee/quads issue, high fatigue, then season advancement.
- Replay expectation: identical current-cycle context and season signals produce identical rank, awards, next-cycle request, decision log, and replay hashes.
- Public envelope impact: `possible`; prefer optional `advance_cycle` request context fields over an envelope version change.
- App integration impact: `apps/web` cycle service must pass normalized current-cycle context into Rust and persist the returned preview without treating DB rows as engine-native types.

### Decision

- Final decision: `open_engine_spec`
- Decider: `user`
- Date (UTC): `2026-05-04`
- Follow-up: `docs/superpowers/plans/2026-05-04-next-cycle-blend-evolution.md`

## Historical Decision: Engine 30

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
