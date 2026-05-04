# CLI-First Active Queue Design

## Goal

Move the roadmap into a CLI-first confidence sequence before additional product-shell expansion.

## Decision

The next active work should prove the Season Loop through deterministic local harnesses before live beta feedback or frontend polish become the primary signal. The active queue becomes:

1. `Wave 10: CLI Season Loop Harness` as the active implementation lane.
2. `Wave 11: Simulation Evidence And Balance Triage` as the next evidence lane.
3. `Wave 12: Product Shell Re-entry` as the later app-shell lane.

`Wave 7: Private Beta Operations And Learning Loop` remains valid as an operations lane, but it should not drive new engine or frontend scope until the CLI harness can produce repeatable local evidence.

## Architecture

Wave 10 stays in `packages/engine-rs` and repository scripts. It hardens the existing `season_loop_backtest` binary into a developer-facing confidence harness with deterministic JSON output, scenario selection, cycle count controls, invariant reporting, and replay receipt summaries.

Wave 11 consumes the Wave 10 reports and classifies issues with the Wave 7 taxonomy: `app-shell`, `adapter-contract`, `persistence-rls`, `telemetry-read-model`, `replay-debuggability`, `deterministic-engine-behavior`, `product-copy`, or `unknown`. Policy tuning and fixture gaps should be recorded as triage notes or follow-up types under those classifications, not as competing primary categories. Wave 11 produces evidence before any new engine-boundary spec is proposed.

Wave 12 re-enters `apps/web` only after the CLI reports are stable enough to justify user-facing Season Loop presentation and release gates.

## Data Flow

The CLI path remains headless:

```text
fixture scenario -> EngineInputV1 -> advance_cycle -> nextCycleRequest
  -> initialize_cycle compatibility check -> JSON report -> evidence docs
```

No Supabase, auth, browser, route, or app persistence dependency is introduced by Wave 10.

## Testing

Wave 10 starts test-first around `packages/engine-rs/tests/season_loop_backtest.rs`. Required checks are focused Rust tests for CLI output shape, scenario selection, invalid argument behavior, deterministic replay output, and non-empty invariant failure reporting when applicable.

The default verification command remains:

```bash
npm run test:engine
```

Wave 11 adds repeatable report generation and evidence review. Wave 12 resumes product-shell verification only after the CLI evidence gate is useful.

## Out Of Scope

- React or visual design changes.
- Supabase or RLS changes.
- DB migrations.
- New engine public envelope names.
- Live beta conclusions before local CLI evidence exists.
