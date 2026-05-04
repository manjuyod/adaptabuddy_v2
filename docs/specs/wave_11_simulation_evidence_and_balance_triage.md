# Wave 11: Simulation Evidence And Balance Triage

## Goal

Use the Wave 10 CLI harness to produce repeatable local evidence about Season Loop balance, rank outcomes, awards, progression drift, and next-cycle recommendations.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/specs/wave_10_cli_season_loop_harness.md`

## Primary Work

- Run the CLI harness across supported archetypes and cycle counts.
- Store or summarize deterministic report evidence in operations or hippocampus docs.
- Classify findings as `deterministic-engine-behavior`, `replay-debuggability`, `telemetry-read-model`, `app-shell`, `product-copy`, `adapter-contract`, `persistence-rls`, or `unknown`.
- Record policy tuning and fixture gaps as triage notes or follow-up types under the primary classification, not as competing primary categories.
- Separate policy tuning from engine-boundary defects.
- Update `docs/operations/next_engine_spec_decision_memo.md` only when evidence justifies new engine-boundary work.

## Exit Criteria

- At least one local evidence pass exists for all supported scenarios.
- Balance concerns are classified with owner/status.
- No new numbered engine spec is proposed without replayable evidence or a local invariant failure.
- Wave 12 has a clear list of product-shell work that is backed by local CLI evidence.

## Completion Evidence

- Evidence record: `docs/operations/wave_11_cli_simulation_evidence.md`
- Result: all supported rank scenarios emitted expected rank timelines, replay summaries, and zero invariant failures.
- Decision: no new engine-boundary spec is needed from this initial evidence pass.

## Out Of Scope

- React/UI implementation.
- Live beta conclusions.
- Supabase schema changes.
- Engine public envelope expansion without a decision memo.
