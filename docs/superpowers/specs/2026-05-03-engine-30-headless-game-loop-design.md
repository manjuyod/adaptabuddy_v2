# Engine 30: Headless Game Loop And Balance Harness Design

## Purpose

Engine 30 turns Adaptabuddy from an app-centered training planner into a headless, deterministic training game loop. The web app remains the renderer, controller, auth shell, and persistence owner. The Rust engine becomes the place where seasonal progression, rank, rewards, bounded difficulty changes, and next-cycle direction are decided.

The first target is **playable-headless-complete**: a CLI or test harness can create a player, run multiple chained macrocycles, evaluate each season, produce deterministic next-cycle requests, and prove the loop is replayable without the frontend, Supabase, or app APIs.

## Design Target

Macrocycles are treated as seasons.

The core loop is:

```text
initialize_cycle
  -> plan_session / complete_session loop
  -> advance_cycle
  -> initialize_cycle(nextCycleRequest)
  -> repeat
```

`initialize_cycle` remains the canonical macrocycle expander. The new `advance_cycle` operation is the season-transition brain: it evaluates the completed season, assigns rank, emits awards and bounded evolution, and returns a valid next-cycle request plus preview.

## Engine Boundary

Add a new public Rust engine operation:

```text
operation: "advance_cycle"
```

### Input

`advance_cycle` consumes normalized, deterministic snapshots:

- completed macrocycle identity and summary
- completed session outcomes
- progression and gamification state
- current class, program blend, and cycle identity
- injury and fatigue history
- policy snapshot for rank thresholds and tuning caps
- determinism block with seed, effectiveAt, referenceHash, and canonicalizationVersion

The operation must not read DB rows, app state, wall clock time, environment values, or random sources.

### Output

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

Boundary rule: `advance_cycle` decides why and how the next season should change. `initialize_cycle` still expands actual next-season sessions.

## Season Rank Model

Season rank is deterministic and structured, not a prose judgment.

Initial rank scale:

```text
S / A / B / C / D
```

Rank inputs:

- adherence: completed vs missed sessions
- completion quality: clean, compromised, partial, missed
- progression trend: improving, stalled, regressing, blocked
- fatigue management: whether the season stayed recoverable
- consistency: streaks and session spacing
- constraint context: injury-heavy or blocked seasons should be classified fairly

Rank output shape:

```text
seasonRank: "S" | "A" | "B" | "C" | "D"

rankBreakdown:
  adherenceScore
  qualityScore
  progressionScore
  recoveryScore
  consistencyScore
  constraintModifier
  finalScore
  rank
```

Awards:

- XP award
- season completion milestone
- rank badge
- streak continuation or break result
- unlock eligibility flags

Rank effects:

- `S` / `A`: small bounded difficulty or volume nudge, unlock eligibility
- `B`: maintain direction
- `C`: recovery buffer or simpler next cycle
- `D`: deload or rebuild bias, lower fatigue pressure
- injury-heavy season: constrained-season modifier dampens penalties

Engine 30 should avoid full perk/buildcraft implementation unless required by rank evidence. Unlock eligibility flags are enough for the first playable headless loop.

## Difficulty And Unlock Policy

Season rank affects both progression and balance:

- Progression signal: unlock eligibility, milestone awards, class/program direction
- Balance signal: bounded next-cycle tuning, such as difficulty, volume, recovery buffer, or progression aggressiveness

Caps are mandatory. A high rank must nudge the next season, not trigger runaway difficulty. A low rank must create a recovery or rebuild path, not punish the player with impossible sessions.

The policy snapshot owns thresholds and caps so deterministic balance changes can be tuned without app logic deciding game outcomes.

## Next-Cycle Request

`advance_cycle` returns a next-cycle request payload that is valid for `initialize_cycle`.

The request should include:

- class preset or resolved class trajectory input
- goal bias
- available days per week
- fatigue preference or recovery pressure adjustment
- injury muscle group slugs
- macrocycle weeks
- weighted selected programs
- bounded tuning directives needed by `initialize_cycle`

`nextCyclePreview` should summarize why the next request was chosen:

- rank effect applied
- program blend direction
- difficulty or recovery adjustment
- unlock eligibility
- constraint notes

The engine must include tests proving every fixture-produced `nextCycleRequest` can be passed into `initialize_cycle`.

## Headless Simulator

Engine 30 includes a CLI or test harness that runs multiple chained macrocycles offline.

Harness responsibilities:

- create deterministic player archetypes
- initialize the first cycle
- simulate session outcomes
- call `complete_session` for each session
- call `advance_cycle` at season end
- call `initialize_cycle(nextCycleRequest)`
- repeat for multiple macrocycles
- emit compact balance reports

Initial simulated archetypes:

- consistent beginner
- inconsistent beginner
- high-fatigue overreacher
- injury-constrained player
- strong adherent / high performer

Outcome scripts:

- clean completions
- compromised completions
- partial and missed sessions
- fatigue-heavy patterns
- constraint-heavy patterns

Balance report shape:

```text
playerArchetype
seasonCount
rankTimeline
xpTimeline
levelTimeline
difficultyTimeline
fatigueTimeline
programBlendTimeline
missedSessionCount
progressionTrendTimeline
awards
invariantFailures
replayReceiptHashes
```

## Invariants

The headless loop must prove:

- same seed produces the same multi-season report
- next-cycle request is valid for `initialize_cycle`
- no output references unknown IDs
- rank effects stay within configured caps
- low-rank recovery adjustments do not produce impossible or empty cycles
- high-rank scaling does not run away across seasons
- injury-heavy seasons are not collapsed into pure failure grades
- replay receipts are stable for equivalent canonical inputs
- engine state patches remain semantic and engine-owned

## Implementation Slices

### Slice 1: Contract And Fixtures

- Add `advance_cycle` to the Rust public operation set.
- Define typed request/result structs.
- Add deterministic fixtures for S, A, B, C, D, injury-constrained, and overreach seasons.
- Add public-boundary rejection tests for malformed `advance_cycle` input.

### Slice 2: Season Rank Engine

- Implement score breakdown and rank classification.
- Emit awards, rank badge, constrained-season modifier, and bounded tuning directives.
- Add golden tests for rank classification and edge cases.

### Slice 3: Next-Cycle Recommendation

- Emit `nextCycleRequest` plus `nextCyclePreview`.
- Reuse `initialize_cycle` for actual macrocycle expansion.
- Add tests proving every `nextCycleRequest` can be fed into `initialize_cycle`.

### Slice 4: Headless Balance Harness

- Add CLI/test harness for multi-season simulation.
- Run archetypes through chained cycles.
- Emit deterministic balance summaries.
- Add replay-stability and invariant tests.

## Verification Gates

Required:

```bash
cd packages/engine-rs && cargo test
```

Engine 30-specific gates:

- deterministic golden fixture tests
- simulator replay stability tests
- public API failure tests for `advance_cycle`
- next-cycle request compatibility tests against `initialize_cycle`
- multi-season invariant tests

Out of scope for Engine 30 MVP:

- React or UI changes
- Supabase dependency
- DB migration
- app API integration
- frontend visualization of ranks, awards, or next-season previews

## Open Questions

- Exact scoring weights for rank categories
- Whether `advance_cycle` should return unlock eligibility only or also concrete unlock grants
- Whether tuning directives should become part of `initialize_cycle` request or remain policy-derived metadata
- How many seasons each simulator archetype should run by default

