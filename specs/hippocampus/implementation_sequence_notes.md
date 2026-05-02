# Engine 06 Implementation Sequence Notes

## Current Baseline

- `docs/archive/specs/engine_01_boundary_contracts.md` is closed for this wave.
- `docs/archive/specs/engine_02_snapshot_normalization.md` and `docs/archive/specs/engine_03_candidate_pipeline_and_constraints.md` are locked inputs for this wave.
- `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md` and `docs/archive/specs/engine_05_testing_and_replay.md` are green upstream inputs for this wave; this note consumes their current contracts and does not reopen them.
- No additional `packages/engine-rs` implementation slice is currently blocking Wave 1.
- `packages/engine-rs/src/lib.rs` currently exposes the public facade and wires `boundary`, `constraints`, `derivations`, `domain`, `gamification`, `logging`, `progression`, `rng`, `scoring`, and `state_update`.
- The live crate split is:
  - boundary and domain: `src/boundary.rs`, `src/domain/*`
  - deterministic helpers: `src/rng.rs`, `src/derivations.rs`
  - constraints: `src/constraints.rs`
  - progression and scoring: `src/progression.rs`, `src/scoring.rs`
  - state update and gamification: `src/state_update.rs`, `src/gamification.rs`
  - logging: `src/logging.rs`
  - adaptation and public facade: `src/adaptation/*`, `src/lib.rs`
- The current Rust test baseline already covers:
  - full JSON goldens for `plan_session` and `complete_session`
  - replay stability and replay-hash drift for identical and materially changed inputs
  - malformed public request and snapshot rejection paths
  - candidate blocking, fatigue-aware selection, class-bias limits, and seeded tie-break behavior
  - completion classification, XP / level updates, and semantic state-patch boundaries
  - state-update loop behavior that preserves unrelated engine-owned and app-owned fields

## Decisions Made

- `engine_06` stays isolated from app transport, persistence, DB, UI, and Supabase work now that the 04/05 tracks are green for this wave.
- The implementation order is fixed to the live module split and must stay in this sequence:
  1. boundary and domain
  2. deterministic helpers
  3. constraints
  4. progression and scoring
  5. state update and gamification
  6. logging
  7. adaptation and public facade
- `engine_05` is an implementation gate, not a follow-up cleanup phase.
- The docs must not reopen `engine_02` or `engine_03`; their contracts are locked inputs to sequencing.
- `engine_04` and `engine_05` remain green controls on the sequencing ledger, not topics for renegotiation here.
- `engine_06` is controller/promotion support for the already-green `engine_04` and `engine_05` tracks.
- The live engine must keep the semantic state patch limited to `progressionState`, `readinessState`, and `gamificationState`.
- Determinism requirements remain strict: identical canonical input plus identical seed, version metadata, and reference hash must replay to the same output.

## Open Questions

- Should the controller later split this into smaller kernel, pipeline, or state-transition milestones?
- Should logging remain a separate pure module boundary if a future shard wants to fold it into adaptation?

## Next Handoff

- Use `docs/archive/specs/engine_06_isolated_engine_implementation.md` as the controller-ready sequencing spec.
- Keep the implementation order aligned to the live Rust split above, and treat `engine_06` as sequencing, ledger, and promotion support after `engine_04` and `engine_05` reached green status for this wave.
- No additional `packages/engine-rs` implementation slice is currently blocking Wave 1.
- Treat "green" as a controller gate meaning the relevant checks pass, the required review passes, and stale spec plus hippocampus docs are aligned.
- Keep `engine_05` as the gate for replay and deterministic testing before any implementation slice is considered done.
- Do not reopen `engine_02` or `engine_03`; if a contradiction appears later, it needs a separate decision rather than an implied note update.

## Pending Review Findings

- None.
