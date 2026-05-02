# Engine Spec 06: Isolated Engine Implementation

## Status

- `State`: Complete
- `Priority`: Done
- `Mode`: Ledger/support sequencing spec

## Goal

Define the implementation sequence for the isolated Rust engine using the live crate split as the current ordering ledger. This spec is sequencing/support only: it does not define a new implementation slice, and no additional `packages/engine-rs` implementation slice is currently blocking Wave 1.

## Dependencies

- `specs/engine_01_boundary_contracts.md`
- `specs/engine_02_snapshot_normalization.md` - locked input for this wave
- `specs/engine_03_candidate_pipeline_and_constraints.md` - locked input for this wave
- `specs/engine_04_scoring_selection_and_decision_logs.md` - green upstream contract for this wave; do not reopen from this note
- `specs/engine_05_testing_and_replay.md` - green implementation gate for this wave; do not reopen from this note

## In Scope

- Dependency order across the current Rust modules in `packages/engine-rs`
- Implementation sequencing across boundary, domain, helpers, constraints, progression, scoring, state update, gamification, logging, and adaptation
- Acceptance gates tied to `engine_05` replay and deterministic testing requirements
- Isolation rules that keep the engine pure and independent from app-shell infrastructure
- Controller/promotion support for the already-green `engine_04` and `engine_05` tracks

## Out of Scope

- App integration
- DB work
- Supabase wiring
- API route work
- Rust crate scaffolding, WASM, FFI, or transport integration
- Reopening `engine_02` or `engine_03` contract decisions

## Deliverables

- Sequenced isolated implementation plan for engine modules
- Ordering guidance that matches the actual split in `packages/engine-rs/src`
- Implementation acceptance gates tied directly to replay and deterministic testing requirements
- Explicit isolation rules so engine work remains independent of app-shell infrastructure

## Live Rust Baseline

The current crate split already matches the isolated-engine shape this spec needs to sequence:

- `src/boundary.rs` and `src/domain/*` define the typed envelope and canonical domain model.
- `src/rng.rs` and `src/derivations.rs` provide deterministic helper logic.
- `src/constraints.rs` owns hard blocking and candidate filtering.
- `src/progression.rs` and `src/scoring.rs` own progression and selection math.
- `src/state_update.rs` and `src/gamification.rs` own semantic state patching and reward updates.
- `src/logging.rs` owns structured trace material.
- `src/adaptation/*` and `src/lib.rs` expose the public facade.

The live test baseline already covers:

- baseline goldens for `plan_session` and `complete_session`
- replay stability and replay-hash drift for identical and materially changed inputs
- public API rejection paths for malformed requests and snapshots
- candidate blocking, fatigue-aware selection, class-bias limits, and seeded tie-break behavior
- completion classification, XP / level updates, and semantic state-patch boundaries
- state-update loop behavior that preserves unrelated engine-owned and app-owned fields

## Sequencing Order

Implement the isolated engine in this order:

1. Lock the canonical boundary and domain types first: `src/domain/*`, then `src/boundary.rs`.
2. Build deterministic helpers next: `src/rng.rs`, then `src/derivations.rs`.
3. Implement hard constraints and candidate filtering next: `src/constraints.rs`.
4. Implement progression and scoring next: `src/progression.rs`, then `src/scoring.rs`.
5. Implement completion state transitions and gamification next: `src/state_update.rs`, then `src/gamification.rs`.
6. Implement structured logging and replay trace material next: `src/logging.rs`.
7. Wire the adaptation entrypoints and public facade last: `src/adaptation/*`, then `src/lib.rs`.

This order is intentionally isolated. Each later step may consume earlier contracts, but it must not force reopening `engine_02` or `engine_03` to redefine input normalization or candidate-pipeline semantics.

## Implementation Gates

`engine_05` is the gate for this work, not a follow-up phase.

Before a slice is considered complete, the current code must continue to satisfy the replay-oriented baseline:

- identical canonical input plus identical seed, version metadata, and reference hash must replay to the same output
- the baseline goldens for `plan_session` and `complete_session` must remain stable
- malformed public requests must still fail at the boundary before engine execution
- semantic patches must only touch `progressionState`, `readinessState`, and `gamificationState`
- the engine must remain free of hidden IO, wall clock dependence, environment dependence, and app-owned persistence assumptions

## Acceptance Criteria

- The implementation sequence can be executed without app, DB, or UI dependencies.
- Testing requirements from `engine_05_testing_and_replay.md` are treated as implementation gates, not optional follow-up work.
- Isolation boundaries remain intact throughout implementation.
- The spec limits `engine_06` to sequencing, gating, controller support, and promotion support after `engine_04` and `engine_05` reached green status for this wave.
- No additional `packages/engine-rs` implementation slice is currently blocking Wave 1.
- The sequencing never reopens `engine_02` or `engine_03` to renegotiate canonicalization or candidate-pipeline order.

## Open Risks or Unresolved Items

- Whether the controller should later split this into smaller kernel, pipeline, or state-transition milestones.
- Whether logging should remain a separate pure module boundary if a future implementation shard wants to fold it into adaptation.
