# Engine 30: Headless Season Loop And Backtest Harness

## Goal

Build the deterministic engine surface needed for a complete local Season Loop before live beta testing resumes as a useful product signal.

The target loop is:

```text
initialize_cycle
  -> plan_session / complete_session until the macrocycle season ends
  -> advance_cycle
  -> initialize_cycle(nextCycleRequest)
  -> repeat
```

`initialize_cycle` remains the canonical macrocycle expander. Engine 30 adds `advance_cycle` as the season-transition operation that evaluates a completed macrocycle, assigns rank and awards, emits bounded evolution, and returns a valid next-cycle request for the next season.

## Status

- `State`: Active
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_08_initialize_cycle_boundary.md`
  - `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`
  - `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`
  - `docs/archive/specs/engine_28_cross_language_replay_certification.md`
  - `docs/specs/wave_8_new_game_engine_first_workflow.md`

## Boundary Decision

Engine 30 is an engine-boundary revision.

It adds one public Rust operation:

```text
operation: "advance_cycle"
```

The public envelope remains `EngineInputV1` / `EngineOutputV1`; the operation set expands to:

- `initialize_cycle`
- `plan_session`
- `complete_session`
- `advance_cycle`

The engine remains pure and deterministic. `advance_cycle` must not read DB rows, app state, wall clock time, environment values, or random sources.

## Input Shape

`advance_cycle` consumes normalized, deterministic snapshots assembled by the app or by the backtest harness:

- completed macrocycle identity and summary
- completed session outcomes
- current progression and gamification state
- current class, program blend, and cycle identity
- injury and fatigue history
- policy thresholds for rank, awards, tuning caps, and recovery buffers
- determinism block with seed, effective time, rule version, reference hash, and canonicalization version

The input must use stable engine identifiers and domain snapshots. It must not use Supabase row shape as the engine model.

## Output Shape

`advance_cycle` emits:

- `seasonSummary`
- `seasonRank`
- `rankBreakdown`
- `awards`
- `evolutionPatch`
- `nextCycleRequest`
- `nextCyclePreview`
- `statePatch`
- `decisionLog`
- `replayReceipt`

`nextCycleRequest` must be accepted by `initialize_cycle` without app-side interpretation of game outcomes. The app may validate and persist the request, but the engine owns why the next season changes.

## Season Rank Model

Season rank is deterministic and structured:

```text
S / A / B / C / D
```

Rank inputs:

- adherence: completed vs missed sessions
- completion quality: clean, compromised, partial, missed
- progression trend: improving, stalled, regressing, blocked
- recovery management: whether the season stayed recoverable
- consistency: streaks and session spacing
- constraint context: injury-heavy or blocked seasons should be classified fairly

`rankBreakdown` includes:

- `adherenceScore`
- `qualityScore`
- `progressionScore`
- `recoveryScore`
- `consistencyScore`
- `constraintModifier`
- `finalScore`
- `rank`

Rank effects:

- `S` / `A`: small bounded difficulty or volume nudge and unlock eligibility
- `B`: maintain direction
- `C`: recovery buffer or simpler next season
- `D`: deload or rebuild bias with lower fatigue pressure
- injury-heavy season: constrained-season modifier dampens penalties

Engine 30 does not implement a full inventory, perk, or buildcraft system. It emits unlock eligibility flags and award summaries only.

## Next-Cycle Request

`advance_cycle` returns a next-cycle request compatible with `initialize_cycle`.

The request includes:

- class preset or resolved class trajectory input
- goal bias
- available days per week
- fatigue preference or recovery pressure adjustment
- injury muscle group slugs
- macrocycle weeks
- weighted selected programs
- bounded tuning directives needed by `initialize_cycle`

`nextCyclePreview` summarizes:

- rank effect applied
- program blend direction
- difficulty or recovery adjustment
- unlock eligibility
- constraint notes

The engine tests must prove every fixture-produced `nextCycleRequest` can be passed into `initialize_cycle`.

## Headless Backtest Harness

Engine 30 includes a Rust CLI or test harness that runs chained macrocycle seasons offline.

Harness responsibilities:

- create deterministic player archetypes
- initialize the first cycle
- simulate session outcomes
- call `complete_session` for each session
- call `advance_cycle` at season end
- call `initialize_cycle(nextCycleRequest)`
- repeat for multiple macrocycle seasons
- emit compact balance reports

Initial archetypes:

- consistent beginner
- inconsistent beginner
- high-fatigue overreacher
- injury-constrained player
- strong adherent / high performer

Balance report fields:

- `playerArchetype`
- `seasonCount`
- `rankTimeline`
- `xpTimeline`
- `levelTimeline`
- `difficultyTimeline`
- `fatigueTimeline`
- `programBlendTimeline`
- `missedSessionCount`
- `progressionTrendTimeline`
- `awards`
- `invariantFailures`
- `replayReceiptHashes`

## Invariants

Engine 30 must prove:

- same seed produces the same multi-season report
- every emitted `nextCycleRequest` is valid for `initialize_cycle`
- no output references unknown IDs
- rank effects stay within configured caps
- low-rank recovery adjustments do not produce impossible or empty cycles
- high-rank scaling does not run away across seasons
- injury-heavy seasons are not collapsed into pure failure grades
- replay receipts are stable for equivalent canonical inputs
- state patches remain semantic and engine-owned

## Implementation Slices

1. Contract and fixtures
   - Add `advance_cycle` to the public operation set.
   - Define typed request/result parsing for `advance_cycle`.
   - Add fixtures for S, A, B, C, D, injury-constrained, and overreach seasons.
   - Add public-boundary rejection tests for malformed `advance_cycle` input.

2. Season rank engine
   - Implement score breakdown and rank classification.
   - Emit awards, rank badge, constrained-season modifier, and bounded tuning directives.
   - Add golden tests for rank classification and edge cases.

3. Next-cycle recommendation
   - Emit `nextCycleRequest` and `nextCyclePreview`.
   - Reuse `initialize_cycle` for actual macrocycle expansion.
   - Add tests proving every generated next-cycle request is accepted by `initialize_cycle`.

4. Headless balance harness
   - Add the multi-season simulator.
   - Run archetypes through chained seasons.
   - Emit deterministic balance summaries.
   - Add replay-stability and invariant tests.

## Verification

Required local gate:

```bash
cd packages/engine-rs && cargo test
```

Engine 30-specific gates:

- deterministic golden fixture tests
- simulator replay stability tests
- public API failure tests for `advance_cycle`
- next-cycle request compatibility tests against `initialize_cycle`
- multi-season invariant tests

## Out Of Scope

- React or UI changes
- Supabase dependency
- DB migrations
- app API integration
- frontend visualization of ranks, awards, or next-season previews

Those are Wave 9 product-shell concerns after the headless loop is deterministic and backtested.
