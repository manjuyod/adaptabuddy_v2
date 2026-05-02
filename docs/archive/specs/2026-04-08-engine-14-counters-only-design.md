# Engine 14 Counters-Only Engine Design

## Goal

Define the first implementation slice for `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md` as an engine-only, counters-only expansion that increases deterministic state ownership in Rust without changing the public engine envelope or app/contracts surfaces.

## Scope

This design covers:
- Rust engine domain type expansion in `packages/engine-rs`
- deterministic `complete_session` state updates for richer progression and adherence counters
- replay-safe tests, fixtures, and state-loop verification

This design does not cover:
- milestone ledgers or badge history
- TypeScript contract changes in `packages/contracts`
- app read-model or `users.stats_json` migration work
- new `plan_session` heuristics driven by the richer counters
- promotion of `recentCompletions` into a public patch bucket

## Approach Options

### Recommended: balanced engine-only extension

Extend the existing Rust domain/state patch structs, factor deterministic counter-update helpers, update `complete_session`, and expand replay/state-loop tests. `plan_session` remains behaviorally stable for this pass and only needs to tolerate the richer typed state.

Why this is the recommended option:
- aligns with the engine-first workflow by settling engine meaning before adapter changes
- keeps the implementation slice small enough to test thoroughly
- avoids embedding all richer-state math inline inside `complete_session`
- avoids turning engine_14 into a larger scoring or storage refactor

### Alternative: minimal extension

Add the new fields directly to the current structs and update them inline inside `complete_session`.

Tradeoff:
- fastest initial patch
- weaker separation between domain math and operation orchestration
- harder to extend or test in isolation

### Alternative: broader progression refactor

Use engine_14 to reshape progression storage and planning/scoring consumption across the Rust engine.

Tradeoff:
- potentially cleaner long term
- higher churn than the active spec slice requires
- more likely to block on secondary design questions

## State Shape

The top-level engine-owned state buckets stay unchanged:
- `progressionState`
- `readinessState`
- `gamificationState`

No new top-level `adherenceState` or `milestoneState` bucket is introduced.

### Progression State

`progressionState.records[*]` keeps the current durable fields:
- `exerciseId`
- `previousPerformanceReference`
- `trend`
- `currentAction`

It gains the following richer engine-owned counters and provenance:
- `consecutiveSuccessfulCompletions`
- `consecutiveStallOrRegressionCount`
- `swapRecommendationCount`
- `lastSessionOutcomeClassification`
- `lastCompletedAt`

Notes:
- records remain keyed by stable engine-facing exercise identity
- `previousPerformanceReference` remains the durable successful load anchor for this slice
- `lastSessionOutcomeClassification` uses the same closed completion outcomes already used by `complete_session`
- `lastCompletedAt` is caller-supplied provenance, not an engine wall-clock read

### Gamification State

`gamificationState` keeps the current canonical fields:
- `xp`
- `level`
- `adherenceStreak`

It gains the following richer counters and provenance:
- `completedSessionCount`
- `missedSessionCount`
- `lastAdherenceOutcomeClassification`
- `lastAwardedAt`

Notes:
- milestone or badge representations are explicitly out of scope for this pass
- `lastAwardedAt` records deterministic reward-evaluation provenance, even when the awarded XP delta is zero

### State Patch Ownership

The public envelope stays unchanged, but richer fields become part of the existing semantic patch buckets:
- richer exercise counters live under `statePatch.progressionState`
- richer adherence and reward counters live under `statePatch.gamificationState`
- `statePatch.readinessState` remains unchanged except for normal recovery-related updates
- `recentCompletions` remains replay input and decision-log context only

## Deterministic Update Rules

### Provenance Rule

For touched exercise and reward updates, timestamp provenance is resolved deterministically:
1. use `request.session.completedAt` when present
2. otherwise use `determinism.effectiveAt`

The engine never reads wall-clock time.

### Progression Record Rules

For the touched primary exercise in `complete_session`:
- always update `lastSessionOutcomeClassification`
- always update `lastCompletedAt` using the deterministic provenance rule above

On `complete_clean` or `complete_compromised`:
- increment `consecutiveSuccessfulCompletions`
- reset `consecutiveStallOrRegressionCount` to `0`
- leave `swapRecommendationCount` unchanged unless the computed action is explicitly `swap`
- update `previousPerformanceReference` to the durable successful load anchor

On `partial`:
- reset `consecutiveSuccessfulCompletions` to `0`
- increment `consecutiveStallOrRegressionCount`
- leave `swapRecommendationCount` unchanged
- keep `previousPerformanceReference` unchanged

On `missed`:
- reset `consecutiveSuccessfulCompletions` to `0`
- increment `consecutiveStallOrRegressionCount`
- increment `swapRecommendationCount` when the computed action is `swap`
- keep `previousPerformanceReference` unchanged

### Gamification Rules

On `complete_clean`, `complete_compromised`, or `partial`:
- increment `completedSessionCount`
- leave `missedSessionCount` unchanged
- increment `adherenceStreak`
- update `lastAdherenceOutcomeClassification`
- update `lastAwardedAt` using the deterministic provenance rule above

On `missed`:
- leave `completedSessionCount` unchanged
- increment `missedSessionCount`
- reset `adherenceStreak` to `0`
- update `lastAdherenceOutcomeClassification` to `missed`
- update `lastAwardedAt` using the deterministic provenance rule above

Why streak resets on missed:
- it makes `adherenceStreak` coherent with `missedSessionCount`
- it gives the richer counters non-overlapping meaning
- it avoids carrying forward the current MVP behavior where a miss preserves the streak

### Planning Behavior Guard

This slice does not add new `plan_session` heuristics based on the new counters. Planning code may parse and carry the richer typed state, but scoring and recommendation behavior remain unchanged unless required to keep tests compiling or parsing safely.

## Components And File Responsibilities

### Domain types

Files:
- `packages/engine-rs/src/domain/progression.rs`
- `packages/engine-rs/src/domain/gamification.rs`
- `packages/engine-rs/src/domain/state.rs`

Responsibilities:
- define the richer canonical typed fields
- preserve strict serialization and unknown-field rejection
- keep the public envelope shape stable while expanding nested meaning

### Completion update math

Files:
- `packages/engine-rs/src/adaptation/complete_session.rs`
- optionally a small helper in `packages/engine-rs/src/gamification.rs` or `packages/engine-rs/src/progression.rs` if extracting counter math improves testability

Responsibilities:
- compute next progression and gamification counters deterministically
- apply the provenance fallback rule
- emit richer semantic patch entries and decision-log details

### Replay and patch application tests

Files:
- `packages/engine-rs/tests/complete_session.rs`
- `packages/engine-rs/tests/complete_session_properties.rs`
- `packages/engine-rs/tests/state_update_loop.rs`
- `packages/engine-rs/tests/support/fixtures.rs`
- `packages/engine-rs/tests/goldens/complete_session_baseline.json`

Responsibilities:
- verify richer counters land in the correct patch buckets
- verify missed-session streak reset behavior
- verify provenance fallback behavior
- verify deterministic replay and next-state application remain stable

## Error Handling And Compatibility Rules

- malformed richer nested state must continue to fail at the typed Rust boundary
- unknown nested fields must continue to be rejected
- absent richer fields in legacy fixtures may be temporarily tolerated only if implementation explicitly chooses a deterministic defaulting path during the engine-only migration
- the end state for this slice should prefer fully populated fixtures and snapshots so the richer state is explicit and replayable

## Testing Strategy

### Domain boundary tests

Add or update tests that:
- round-trip richer progression records through typed serde conversion
- round-trip richer gamification state through typed serde conversion
- reject malformed or unknown richer fields

### Complete-session deterministic tests

Add or update tests that cover:
- repeated successful completions incrementing `consecutiveSuccessfulCompletions`
- `partial` resetting success counters and incrementing stall/regression counters
- `missed` incrementing `missedSessionCount`, incrementing `swapRecommendationCount` when applicable, and resetting `adherenceStreak`
- reward provenance using `completedAt`
- reward provenance falling back to `effectiveAt` when `completedAt` is absent

### Golden and replay tests

Update the completion golden and replay assertions so they verify:
- richer counters appear only in `progressionState` and `gamificationState`
- decision-log structure remains stable
- same canonical input still produces the same output hashes and deterministic output

### State-loop tests

Expand state-loop verification so applying the richer semantic patch:
- preserves unrelated planning context
- merges new progression and gamification counters without deleting unrelated fields
- produces identical next planning snapshots for identical inputs

## Non-Goals

This counters-only pass explicitly does not do the following:
- add milestone ledgers, badge history, or milestone-progress state
- widen `EngineInputV1`, `EngineOutputV1`, or the public Rust operation set
- move `recentCompletions` into the public patch surface
- introduce app persistence migrations
- change TypeScript contracts
- tune planning heuristics to exploit the richer counters

## Implementation Readiness

This design is ready for a writing-plans handoff once the written spec is user-reviewed. The implementation should proceed engine-first in Rust, with deterministic tests added alongside the type and completion-state updates before any downstream adapter work is considered.
