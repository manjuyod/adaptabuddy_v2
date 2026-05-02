# Engine Parallel Status Matrix

## Controller Defaults

- Execution mode: mixed spec+code, milestone-based review
- Canonical handoff ledger: `specs/hippocampus`
- Normative addendum: `docs/archive/specs/engine_addendum_stateful_progression_gamification.md`
- Public envelope stays `EngineInputV1` / `EngineOutputV1` unless a spec explicitly revises it
- Track promotion gate: a track is only "green" when its relevant checks pass, its required review passes, and any stale spec or hippocampus status docs are aligned
- Review policy:
  - spec-only milestone: spec-compliance review
  - code milestone: spec-compliance review, then code-quality review

## Track Matrix

| Track | Owner files | Status | Next milestone | Review status |
|---|---|---|---|---|
| `engine_02` normalization/domain | `docs/archive/specs/engine_02_snapshot_normalization.md`, `specs/hippocampus/domain_model_notes.md` | complete for this wave | Reopen only if `engine_04` or `engine_05` exposes a direct contradiction in the normalized V1 boundary | accepted |
| `engine_03` candidates/constraints | `docs/archive/specs/engine_03_candidate_pipeline_and_constraints.md`, `specs/hippocampus/scoring_progression_notes.md` | complete for this wave | Reopen only if `engine_04` or `engine_05` exposes a direct contradiction in candidate pipeline or hard-block semantics | accepted |
| `engine_04` scoring/logging | `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md`, `specs/hippocampus/integration_notes.md` | green for this wave | Reopen only if later numeric-policy, canonical-serialization, or public trace-contract work exposes a direct contradiction in the closed V1 decision-log or replay-receipt semantics | accepted |
| `engine_05` testing/replay | `docs/archive/specs/engine_05_testing_and_replay.md`, `specs/hippocampus/test_strategy_notes.md` | green for this wave | Reopen only for deferred cross-language parity certification, canonical-serialization closure, numeric-policy closure, or broader future permutation coverage | accepted |
| `engine_06` implementation sequencing | `docs/archive/specs/engine_06_isolated_engine_implementation.md`, `specs/hippocampus/implementation_sequence_notes.md` | complete for this wave | Reopen only if a later Rust milestone split or isolation contradiction appears in the completed Wave 1 sequencing/support ledger | accepted |

## Current Baseline

- `engine_01` is complete and locked.
- `engine_02` is complete for Wave 1 normalization, and `engine_03` is complete for the current candidate-pipeline and hard-constraint contract.
- `engine_04` is green for Wave 1: the Rust baseline, spec, and hippocampus notes are aligned on public trace richness, `state_update`, and replay-receipt semantics.
- `engine_05` is green for Wave 1: the Rust baseline, spec, and hippocampus notes are aligned on replay, trace, bounded `recentCompletions`, level-threshold, and closed-loop coverage.
- `engine_06` is complete for this wave as a sequencing/support ledger, with no additional `packages/engine-rs` implementation slice currently blocking Wave 1.
- The Rust crate already implements typed boundary parsing, deterministic `initialize_cycle` / `plan_session` / `complete_session`, decision logs, replay receipts, and a meaningful replay test baseline.
- `stateSnapshot` already includes athlete profile, readiness, injury, performance, progression, gamification, active program, and bounded recent completions in the Rust boundary.
- Review prompts cannot rely on commit SHAs because the repository has no commits yet.

## Controller Rules

- Workers get only their own writable files and the minimum Rust/source context needed.
- If a worker nears context limits, it must update its hippocampus file with:
  - `Current Baseline`
  - `Decisions Made`
  - `Open Questions`
  - `Next Handoff`
  - pending review findings if any
- Successor workers start from the updated hippocampus note, not prior worker history.
- No worker may edit another track's files.
