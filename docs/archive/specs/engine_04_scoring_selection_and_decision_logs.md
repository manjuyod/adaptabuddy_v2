# Engine Spec 04: Scoring, Selection, and Decision Logs

## Status

- `State`: Complete
- `Priority`: Done

## Goal

Lock the post-filter scoring model, deterministic seeded selection policy, public V1 decision-log serialization, and replay-receipt semantics for the engine-first MVP.

This spec is the scoring-and-observability companion to `engine_03` and the public-trace companion to `engine_02` and `engine_05`. It freezes rule hierarchy and replay-relevant meaning without over-freezing tuning constants, byte serialization, or cross-language hash details.

## Dependencies

- `specs/engine_01_boundary_contracts.md`
- `specs/engine_02_snapshot_normalization.md`
- `specs/engine_03_candidate_pipeline_and_constraints.md`
- `specs/engine_05_testing_and_replay.md`
- `specs/engine_addendum_stateful_progression_gamification.md`
- `specs/hippocampus/scoring_progression_notes.md`
- `packages/engine-rs/src/scoring.rs`
- `packages/engine-rs/src/logging.rs`
- `packages/engine-rs/src/adaptation/plan_session.rs`
- `packages/engine-rs/src/adaptation/complete_session.rs`
- `packages/engine-rs/src/domain/progression.rs`

## In Scope

- Closed V1 soft-score categories and their relative rule hierarchy
- Deterministic candidate ranking and seeded top-band selection
- Public V1 decision-log entry schema and required trace content
- Public V1 replay-receipt schema and field meanings
- Integration of progression need, fatigue and recovery compatibility, class bias, novelty, and stateful update trace requirements
- Explicit separation between the closed public contract and the current Rust Wave 1 baseline

## Out of Scope

- Exact tuning weights, penalties, caps, or decimal precision across rule families
- Canonical byte serialization and final replay-hash algorithm
- Cross-language replay certification
- App-facing prose explanations or persistence layout
- DB storage, transport wrappers, or API-route behavior outside the engine envelope

## Closed Decisions

### 1. Scoring starts only after `engine_03` produces the post-filter set

`engine_04` operates on the deterministic survivor set emitted by `engine_03` after:

1. scope resolution
2. reference enumeration
3. state attachment
4. hard-constraint evaluation
5. permitted widening
6. post-filter candidate materialization

Rules:

- Hard constraints, widening, and rejection collapse are complete before soft scoring begins.
- Scoring must not revive a hard-blocked candidate or re-open scope decisions already settled by `engine_03`.
- The scoring stage receives the retained candidate metadata required by `engine_03`, including progression lookup context, readiness context, novelty seed scope, class-archetype context, and deterministic reference order.
- If `engine_03` yields a deterministic rejection, the engine skips scoring and still emits a public `decisionLog` and `replayReceipt` consistent with this spec.

### 2. Closed V1 public soft-score categories

Closed V1 freezes exactly four public soft-score categories for `plan_session` result and decision-log serialization:

- `progressionNeed`
- `fatigueCompatibility`
- `classBias`
- `novelty`

These are the only public V1 score-breakdown fields. A future rule family may change formulas or add internal sub-signals, but it may not add a new public category without a spec revision.

#### 2.1 `progressionNeed`

Meaning:

- Measures how appropriate it is to keep advancing or preserving this candidate’s progression line within the current state.

Required input sources:

- `stateSnapshot.progressionState.records[]` for the exact `exerciseId`
- candidate `exerciseId`
- progression trend
- progression current action
- prior performance reference when present
- deterministic missing-record defaults

Rules:

- Exact-exercise records take precedence over generic defaults.
- Missing progression records must still produce a deterministic value.
- `progressionNeed` is a primary category and must materially influence ranking.
- Progression state that already caused an exact-exercise `swap` hard exclusion in `engine_03` does not reappear here; excluded candidates never reach scoring.

#### 2.2 `fatigueCompatibility`

Meaning:

- The aggregate recovery-and-fatigue compatibility score for attempting this candidate in the current cycle.

Required input sources:

- `stateSnapshot.readinessState.systemicFatigue`
- candidate-matched `stateSnapshot.readinessState.muscleFatigue`
- candidate movement or demand bucket
- deterministic derived recovery-budget or recovery-headroom class if the rule family computes one

Rules:

- Recovery budgeting is part of `fatigueCompatibility` in V1, not a separate public category.
- `fatigueCompatibility` is a primary category and must materially influence ranking.
- If an implementation derives a recovery-budget class from canonical state, that derived class must feed this category rather than bypassing it.
- Closed V1 does not add a separate public `injuryCompatibility` category. Injury remains:
  - a hard-block family when `engine_03` says it is blocking
  - otherwise a deferred soft-compatibility refinement until a later spec adds a distinct public category or richer normalized injury inputs

#### 2.3 `classBias`

Meaning:

- A bounded motivational or archetype-alignment preference.

Required input sources:

- `stateSnapshot.athleteProfile.classArchetype`
- `policySnapshot.classArchetypeBias`
- candidate metadata retained from `engine_03`

Rules:

- `classBias` is always a secondary bounded influence.
- `classBias` must never create, remove, or revive a candidate.
- `classBias` must remain materially weaker than either primary category.
- `classBias` must never overturn a materially better recovery-compatible or progression-appropriate candidate outside the allowed top band.

#### 2.4 `novelty`

Meaning:

- A bounded deterministic variation signal used only to introduce small diversity within safe and otherwise-competitive choices.

Required input sources:

- `policySnapshot.noveltyBudget`
- `determinism.seed`
- explicit cycle input, currently `request.microcycleIndex` for `plan_session`
- candidate stable `id`

Rules:

- `novelty` is the lowest-priority score category in closed V1.
- `novelty` must remain smaller than the maximum allowed `classBias` effect.
- `novelty` must be deterministic and seeded; it must not use wall-clock time or hidden randomness.
- `novelty` cannot override hard constraints, widening decisions, or primary recovery and progression preferences.

#### 2.5 Deferred soft-score families

The addendum names several architecturally valid soft-score ideas. Closed V1 does not make them separate public score categories:

- movement balance across the week or microcycle
- goal-bias match
- mastery or competence fit
- recent adherence or completion trend as its own public score field
- non-blocking injury compatibility as its own public score field

Reason:

- The current V1 boundary and public result shape do not expose enough dedicated normalized inputs or public score fields to freeze these independently without reopening `engine_02` or `engine_01`.

Policy:

- They remain future scoring families.
- They must not silently appear as new public V1 score-breakdown keys.

### 3. Relative rule hierarchy is closed even though constants stay versioned

Closed V1 rule hierarchy:

1. Hard constraints and rejection collapse from `engine_03`
2. Scope narrowing or widening from `engine_03`
3. Primary soft scoring:
   - `progressionNeed`
   - `fatigueCompatibility`
4. Secondary bounded preference:
   - `classBias`
5. Tertiary bounded variation:
   - `novelty`
6. Seeded top-band selection
7. Stable ID ordering fallback where this spec requires it

Meaning:

- `progressionNeed` and `fatigueCompatibility` are co-primary; this spec does not freeze a strict order between them.
- `classBias` may break near-equals but must not dominate clearly better primary-category candidates.
- `novelty` may break near-equals inside the allowed competitive band but must not dominate `classBias`, `progressionNeed`, or `fatigueCompatibility`.
- Recovery budgeting semantics are subordinate to hard blocking when the state is severe enough to block in `engine_03`, and otherwise subordinate only to the scoring hierarchy above.

Not frozen here:

- exact weights
- exact penalty curves
- exact caps
- exact rounding precision

Those may evolve by `determinism.ruleVersion`, but the hierarchy above may not silently change.

### 4. Numeric policy and score observability

Rules:

- Public score fields are finite JSON numbers.
- The engine must use the same computed numeric values for ranking, top-band eligibility, and logged score outputs within a given `ruleVersion`.
- `PlanSessionResult.scoreBreakdown` contains only the selected candidate’s public breakdown, not the full scored-candidate inventory.
- `decisionLog` must carry enough scored-candidate detail to explain why the selected candidate won without requiring access to hidden internal state.

Open items that remain intentionally open:

- fixed-point versus floating-point representation across implementations
- canonical decimal precision across languages
- exact quantization or rounding policy before serialization

Interpretation rule:

- Same canonical input plus same `seed`, `effectiveAt`, `ruleVersion`, `referenceHash`, and `canonicalizationVersion` must yield the same numeric results within a given implementation and rule family.
- Cross-language numeric equivalence remains blocked on later numeric-policy closure.

### 5. Candidate ranking and seeded selection are now closed

Closed V1 `plan_session` selection flow:

1. Score every post-filter survivor.
2. Compute one total score per candidate from the four public categories under the current `ruleVersion`.
3. Sort all scored candidates by:
   - total score descending
   - stable string `candidateId` ascending as the deterministic ranking fallback
4. Let `topScore` be the first candidate’s total score.
5. Read `policySnapshot.seededTieBreakBand` as the non-negative top-band width.
6. Build the eligible top band as every candidate whose total score is within `seededTieBreakBand` of `topScore`.
7. If exactly one candidate is eligible, select it directly.
8. If more than one candidate is eligible:
   - sort the eligible candidates by stable string `candidateId` ascending
   - derive the tie-break draw deterministically from:
     - top-level `determinism.seed`
     - the tie-break stage scope
     - the explicit cycle input, currently `request.microcycleIndex`
     - the candidate selection subject
     - the eligible count
   - choose the deterministic index produced by that seeded draw
9. Emit the selected candidate as the final winner and preserve the full ranked order in trace data.

Selection invariants:

- Seed changes may change the winner only inside the eligible top band.
- Candidates outside the top band must never be selected.
- Stable `candidateId` ordering is the final deterministic fallback for:
  - full ranked order when scores tie
  - eligible-band order before the seeded index draw
- Preferred-family survivors and widened survivors remain subject to `engine_03` ordering rules before scoring; scoring does not merge or reshuffle pre-score buckets except through score ranking.

Alignment note:

- This spec intentionally matches the current Rust top-band approach in `packages/engine-rs/src/scoring.rs`.
- The Rust crate’s current helper names and exact seed-derivation string format are implementation details, not the canonical public schema.
- However, any future implementation must preserve the same outcome semantics for a given `ruleVersion`.

### 6. Public V1 `decisionLog` schema is closed

The public envelope still carries `decisionLog` as an array. This spec now closes the V1 entry serialization.

#### 6.1 Common entry shape

Every public V1 decision-log entry must serialize as:

```text
DecisionLogEntryV1
- stepType
- ruleId
- outcome
- inputsUsed[]
- candidateId optional
- computedValue optional
- details optional
```

Field meanings:

- `stepType`: stable snake_case discriminator
- `ruleId`: stable snake_case rule identifier for the decision stage
- `outcome`: stable snake_case stage result
- `inputsUsed[]`: array of structured input references
- `candidateId`: single candidate or exercise ID when the step is candidate-specific
- `computedValue`: primary numeric result for the step when one numeric value is the headline output
- `details`: step-specific structured payload defined below

#### 6.2 `inputsUsed[]` is structured in public V1

Public V1 input references are no longer raw strings. Each item must serialize as:

```text
DecisionInputRefV1
- path
- stableId optional
```

Rules:

- `path` is a canonical source path into `EngineInputV1`, derived state, or retained candidate metadata.
- `stableId` is used when the path points into a keyed collection and a stable entity ID is needed to disambiguate the reference.
- `inputsUsed[]` must point at canonical inputs or deterministic derived state, not prose labels.
- Current Rust already emits structured `DecisionInputRefV1` references in the Wave 1 baseline.

Example:

```json
{
  "path": "stateSnapshot.progressionState.records",
  "stableId": "bench-press"
}
```

#### 6.3 Allowed `stepType` values in V1

Closed V1 `stepType` values:

- `scope`
- `filter`
- `score`
- `tie_break`
- `final_selection`
- `classify`
- `state_update`
- `award_xp`

Operation expectations:

- `plan_session` always uses `scope` and `filter`.
- `plan_session` uses `score`, `tie_break`, and `final_selection` only when at least one survivor reaches scoring.
- `complete_session` uses `classify`, `state_update`, and `award_xp`.

Current Rust baseline:

- The crate currently emits:
  - `scope`, `filter`, `score`, `tie_break`, `final_selection` for `plan_session`
  - `classify`, `state_update`, `award_xp` for `complete_session`
- The current crate therefore matches the closed Wave 1 public step vocabulary for the engine trace envelope.

#### 6.4 `scope` entry

Required for `plan_session` before filter results are logged.

Required fields:

- `stepType = "scope"`
- `ruleId = "candidate_scope"`
- `details.resolvedFocus`
- `details.preferredScopeBucket`
- `details.enumeratedCandidateIds[]`
- `details.wideningApplied`
- `details.survivingScopeBucket`

Rules:

- `enumeratedCandidateIds[]` must preserve pre-filter reference order from `engine_03`.
- If widening occurs, `details.survivingScopeBucket` must reflect the widened bucket; otherwise it matches the preferred bucket.
- If no widening occurs, `wideningApplied` is `false`.

#### 6.5 `filter` entry

Required for `plan_session`. Public V1 may emit one aggregate filter entry or multiple rule-specific entries, but the full candidate-level evidence below must be present in the union of emitted entries.

Required details:

```text
FilterDetailsV1
- evaluatedCandidateIds[]
- blocked[]
- survivingCandidateIds[]
```

Each `blocked[]` item must serialize as:

```text
BlockedCandidateRecordV1
- candidateId
- category
- code
- detailCode optional
```

Closed V1 `category` values:

- `injury_safety`
- `fatigue_safety`
- `explicit_disqualifier`

Rules:

- `blocked[]` must preserve every hard-block reason required by `engine_03`, even when the final public rejection collapses them to one `rejectionCode`.
- Candidates removed only by widening are not `blocked[]`.
- `survivingCandidateIds[]` must reflect the deterministic post-filter order handed to scoring.

Current Rust baseline:

- The crate already emits the public `scope` and `filter` trace pair, preserves reference order in both entries, and serializes candidate-level hard-block records in the filter details.
- Widening semantics are reflected in the scope trace and in the deterministic rejection path when no survivors remain.

#### 6.6 `score` entry

Required for every scored candidate in `plan_session`.

Required fields:

- `candidateId`
- `computedValue` equal to that candidate’s total score
- `details.breakdown`
- `details.rankPosition`
- `details.eligibleForTopBand`

`details.breakdown` uses the closed public score keys:

```text
ScoreBreakdownV1
- progressionNeed
- fatigueCompatibility
- classBias
- novelty
```

Rules:

- Every scored survivor must have exactly one public `score` entry.
- `computedValue` must be the same total used for ranking and top-band inclusion.
- `eligibleForTopBand` must reflect the final band decision, not a speculative pre-band estimate.
- If a rule family derives internal sub-signals such as recovery-budget class, they may appear inside `details`, but the public `breakdown` must still roll up to the four closed V1 categories.

#### 6.7 `tie_break` entry

Required for `plan_session`, even when the band contains only one candidate.

Required details:

```text
TieBreakDetailsV1
- topScore
- bandWidth
- eligibleCandidateIds[]
- selectedIndex optional
- selectedCandidateId
```

Rules:

- `eligibleCandidateIds[]` must be stable-ID sorted because that is the deterministic order used before the seeded draw.
- `selectedIndex` is omitted only when the band size is one.
- `outcome` is:
  - `not_needed` when the band size is one
  - `selected` when the seeded draw chose among multiple eligible candidates

Current Rust baseline:

- The crate already emits `not_needed` versus `selected`.
- The crate already exposes `topScore`, `bandWidth`, the stable-ID-sorted eligible candidate list, and `selectedIndex` when the band contains more than one candidate.

#### 6.8 `final_selection` entry

Required for `plan_session`.

Required details:

```text
FinalSelectionDetailsV1
- selectedCandidateId
- rankedCandidateIds[]
```

Rules:

- `rankedCandidateIds[]` must preserve the final ranked order after scoring and stable-ID tie fallback.
- `selectedCandidateId` must match the public result payload.

#### 6.9 `classify` entry

Required for `complete_session`.

Required details:

```text
ClassificationDetailsV1
- sessionOutcomeClassification
- primaryExerciseId
- progressionActionBefore
- progressionTrendBefore
```

Rules:

- `inputsUsed[]` must reference the canonical completion inputs actually used for classification, such as `overallRpe`, performed sets, current trend, and systemic fatigue when applicable.
- `outcome` must equal the emitted `sessionOutcomeClassification`.

Current Rust baseline:

- The crate already emits structured completion inputs and the pre-update progression details required by the closed public contract.

#### 6.10 `state_update` entry

Required for `complete_session` after classification and before XP accounting.

Required details:

```text
StateUpdateDetailsV1
- touchedBuckets[]
- progressionUpdates[]
- readinessUpdate optional
- recentCompletionUpdate optional
- gamificationUpdate optional
```

Each `progressionUpdates[]` item must include:

- `exerciseId`
- `actionBefore`
- `actionAfter`
- `trendBefore`
- `trendAfter`

Rules:

- `touchedBuckets[]` must list public `statePatch` buckets affected by the operation.
- If `recentCompletions` changes, the entry must record enough summary detail to confirm the `engine_02` bounded-window rule was applied.
- If readiness or recovery state changes, the update must record the deterministic before and after values actually patched.
- This entry is the public V1 home for stateful update trace expectations from the addendum.

Current Rust baseline:

- The crate already emits a `state_update` entry and surfaces `recentCompletions` patch behavior in the public output for `complete_session`.

#### 6.11 `award_xp` entry

Required for `complete_session`.

Required fields:

- `computedValue` equal to `xpDelta`
- `details.streakDelta`
- `details.levelBefore`
- `details.levelAfter`
- `details.levelUp`

Rules:

- `outcome` is `applied`.
- This entry must align with the public result’s XP summary and level-up indicator.
- If a session is missed and the streak is preserved, `streakDelta` must show `0`.

Current Rust baseline:

- The crate already emits `computedValue` for XP delta and includes the full level-before, level-after, and `levelUp` detail in the public decision log.

### 7. Decision-log ordering is closed

Closed public ordering:

- successful `plan_session`:
  1. `scope`
  2. `filter`
  3. one `score` entry per scored candidate in ranked order
  4. `tie_break`
  5. `final_selection`
- deterministically rejected `plan_session`:
  1. `scope`
  2. `filter`
- `complete_session`:
  1. `classify`
  2. `state_update`
  3. `award_xp`

Rules:

- Entry order is replay-relevant because `outputHash` covers the public output material excluding `replayReceipt`.
- If a future rule family adds more trace richness, it must preserve the relative stage order above unless a spec revision says otherwise.
- Human-readable summaries remain derived views only; the structured ordered log is authoritative.

Current Rust baseline:

- The crate already preserves the closed public order for successful and rejected `plan_session` outputs and for `complete_session`.

### 8. Public replay-receipt schema is closed

The public `replayReceipt` object remains in `EngineOutputV1` and now has closed V1 meaning:

```text
ReplayReceiptV1
- inputHash
- outputHash
- seedUsed
- effectiveAt
- implementationVersion
- policyVersion
- referenceHash
```

Field meanings:

- `inputHash`: hash of the authoritative canonicalized input material whose field membership was closed by `engine_02`
- `outputHash`: hash of the authoritative canonicalized public output material excluding the `replayReceipt` object itself
- `seedUsed`: the top-level seed actually used for the operation’s deterministic randomness
- `effectiveAt`: the authoritative decision-time input used for the operation
- `implementationVersion`: stable emitter identity for the implementation that produced this output
- `policyVersion`: stable label for the policy bundle actually applied by the implementation
- `referenceHash`: must equal `determinism.referenceHash`

#### 8.1 Closed membership expectations

Already closed by `engine_02` and reaffirmed here:

- `inputHash` covers canonicalized:
  - `schemaVersion`
  - `operation`
  - `determinism`
  - `referenceSnapshot`
  - `stateSnapshot`
  - `policySnapshot`
  - `request`
- `inputHash` excludes:
  - `metadata`
  - request free-text fields marked non-decision by `engine_02`, currently:
    - `request.session.notes`
    - `request.session.exercises[].sets[].notes`
- `outputHash` covers canonicalized public output material excluding `replayReceipt` itself, including:
  - `schemaVersion`
  - `operation`
  - `result`
  - `statePatch`
  - `events`
  - `decisionLog`

Implication:

- Public decision-log content is replay-hash relevant.
- Public replay-receipt metadata is not self-hashed into `outputHash`.

#### 8.2 Closed versus open replay-receipt semantics

Closed now:

- field names
- field presence
- high-level meanings
- `referenceHash` equality with input `determinism.referenceHash`
- `seedUsed` as the authoritative operation seed
- `effectiveAt` as the authoritative explicit time input
- `inputHash` and `outputHash` field-set membership at the semantic level

Still open:

- canonical byte serialization format
- final hash algorithm
- cross-language canonical equivalence
- whether future implementations share one universal `implementationVersion` namespace or version within implementation families

Interpretation rule:

- Until serialization and hash algorithm are closed, replay-receipt strings are implementation-stable evidence, not final cross-language certification.

#### 8.3 `policyVersion` meaning is closed without reopening `policySnapshot`

Rules:

- `policyVersion` is receipt metadata, not a new public `policySnapshot` field.
- `policyVersion` must identify the policy bundle the implementation actually applied.
- `policyVersion` does not replace `determinism.ruleVersion`; both may coexist because they answer different questions:
  - `ruleVersion`: caller-selected rule family input
  - `policyVersion`: implementation-reported policy bundle identity

### 9. Result and trace interplay is closed

Rules:

- The selected `scoreBreakdown` in `PlanSessionResult` must match the `score` and `final_selection` log entries for the selected candidate.
- `CompleteSessionResult.sessionOutcomeClassification`, updated progression summary, awarded XP summary, and level-up indicator must align with `classify`, `state_update`, and `award_xp` log entries.
- `statePatch` and `decisionLog` must tell the same story. Public logs are not allowed to describe updates that the patch does not make, or omit public patch buckets that materially changed.
- `events` remain optional and separate from `decisionLog`; no part of this spec requires typed domain events for V1.

### 10. Rust baseline versus downstream alignment is explicit

Current Rust baseline versus downstream alignment is explicit:

- four public score categories in the result
- deterministic ranking by score then stable ID
- seeded top-band selection
- public `scope`, `filter`, `score`, `tie_break`, and `final_selection` entries for `plan_session`
- public `classify`, `state_update`, and `award_xp` entries for `complete_session`
- replay-receipt field names and semantics are already present in the public envelope

Remaining downstream work is now limited to architectural questions outside the Wave 1 trace contract:

- cross-language numeric representation
- canonical byte serialization and final replay-hash algorithm
- whether future scoring families should become new public score categories

## Acceptance Criteria Check

- Public V1 score categories are now closed to `progressionNeed`, `fatigueCompatibility`, `classBias`, and `novelty`.
- Relative rule hierarchy is fixed without freezing tuning constants or numeric precision policy.
- Deterministic candidate ranking and seeded top-band selection are explicit and Rust-aligned.
- Public V1 `decisionLog` serialization is explicit, including required step ordering, structured `inputsUsed[]`, candidate hard-block evidence, tie-band details, and state-update trace expectations.
- Public V1 `replayReceipt` schema and field meanings are explicit and reconciled with the field-set closure already made in `engine_02` and the replay policy in `engine_05`.
- Recovery budgeting is folded into `fatigueCompatibility`, and the addendum-driven stateful loop is reflected in score inputs and `complete_session` trace requirements.
- The spec clearly distinguishes closed public-contract decisions from the current Rust Wave 1 baseline.

## Remaining Open Questions

- Cross-language numeric representation is still not frozen, so score equality across implementations remains an architecture-level risk.
- Canonical byte serialization and the final replay-hash algorithm are still open, so replay receipts remain implementation-local evidence rather than full cross-language certification.
- Whether future scoring families should become new public score categories.
