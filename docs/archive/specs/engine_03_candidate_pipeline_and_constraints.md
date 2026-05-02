# Engine Spec 03: Candidate Pipeline and Constraints

## Status

- `State`: Complete
- `Priority`: Done

## Goal

Lock the deterministic pipeline that turns normalized engine input into the post-filter candidate set that is handed to scoring and final selection.

This spec is normative for stage order, hard-constraint behavior, rejection typing, candidate ordering, and candidate metadata retention. It intentionally does not freeze scoring weights or final selection math; those stay in `engine_04`.

## Dependencies

- `specs/engine_01_boundary_contracts.md`
- `specs/engine_02_snapshot_normalization.md`
- `specs/engine_addendum_stateful_progression_gamification.md`
- `docs/architecture/engine_first_architecture.md`
- `packages/engine-rs/src/constraints.rs`
- `packages/engine-rs/src/scoring.rs`
- `packages/engine-rs/src/progression.rs`
- `packages/engine-rs/src/adaptation/plan_session.rs`

## In Scope

- Ordered candidate-generation stages from normalized snapshots to the post-filter candidate set
- Hard-constraint categories and blocker semantics
- Rejection semantics for internal traces and deterministic rejection outputs
- Deterministic ordering guarantees before scoring
- Candidate metadata retention required for downstream scoring, logging, and replay
- Stateful progression and gamification interactions that affect candidate eligibility boundaries

## Out of Scope

- Soft-score formulas, weights, or tie-band constants
- Weighted or seeded final selection rules beyond what candidate metadata must preserve
- UI wording or app persistence mappings
- DB query shape or transport behavior

## Closed Decisions

### 1. Candidate Unit

- The pipeline operates on a typed candidate unit created from normalized snapshots.
- For Wave 1 `plan_session`, the current Rust evidence is exercise-level candidate generation from `referenceSnapshot.exercises`.
- The same stage order must hold for future program, template, session, or block candidates. Only `candidateType`, `candidateId`, and `sourcePath` change.
- A candidate does not exist until it has:
  - a stable string `candidateId`
  - a `candidateType`
  - a deterministic `referenceOrder`
  - enough source metadata to evaluate constraints without consulting app state

### 2. Ordered Pipeline Stages

The engine must execute the candidate pipeline in this order:

1. `ResolveOperationScope`
- Read the normalized request, active program state, policy, and determinism inputs.
- Determine the target candidate domain for the operation, such as session focus, program block, or substitution scope.
- Resolve any operation-scoped boundaries already present in the normalized input before enumerating candidates. Explicit locks remain future boundary work under Section 3.4.

2. `EnumerateReferenceCandidates`
- Enumerate only candidates that are in the operation's reference scope.
- Enumeration must be deterministic and must not depend on hash-map iteration.
- Assign each enumerated candidate a stable `referenceOrder`.
- Current Rust alignment: `plan_session` iterates `referenceSnapshot.exercises` in snapshot order.

3. `ProjectCandidateDescriptors`
- Convert each enumerated item into a typed descriptor with immutable metadata used by later stages.
- This is the first point at which candidate IDs, source descriptors, movement tags, equipment tags, and progression keys are frozen.

4. `AttachStatefulContext`
- Attach relevant state-derived metadata without mutating eligibility yet.
- Required context includes:
  - injury and limitation context
  - readiness and fatigue context
  - active-program context
  - progression record lookup for the exact exercise `exerciseId`
  - class archetype key
  - optional descriptive tags carried forward from `referenceSnapshot`
  - novelty budget key and deterministic novelty seed scope
- Class bias and novelty are retained here as metadata only. They are not filter criteria.

5. `EvaluateHardConstraints`
- Evaluate every candidate against the hard-constraint categories in Section 3.
- A candidate may accumulate multiple hard-block reasons.
- Hard-constraint evaluation must happen before any soft scoring or seeded tie logic.
- Rejected candidates are removed from the survivor set but must retain internal hard-block evidence for logging and replay.

6. `ApplyPermittedWidening`
- In closed V1, widening authority comes only from normalized `request.sessionFocus` interpreted through the current focus-to-movement-family mapping.
- If survivors exist whose `movementPattern` matches that preferred family, keep the decision inside that family.
- If the preferred-family survivor bucket is empty, widen deterministically to cross-family fallback across the remaining survivors from the same enumerated reference scope.
- Scope pruning during widening is a semantic trace event, not a hard-block rejection.
- Widening never revives a hard-blocked candidate.
- No request flag, policy flag, lock input, or archetype-alignment input widens or narrows candidate scope in V1.
- Current Rust evidence: `plan_session` prefers focus-family matches, then widens to cross-family fallback only if the preferred set is empty.

7. `MaterializePostFilterSet`
- Emit the surviving candidates in deterministic pre-score order.
- Persist the retained metadata defined in Section 6.
- If no survivors remain after permitted widening, emit a deterministic rejection outcome using Section 5.

No other stage may insert, remove, or reshuffle candidates between `MaterializePostFilterSet` and the start of scoring except deterministic score annotation performed in `engine_04`.

### 3. Hard-Constraint Categories

Wave 1 freezes only the hard-constraint families that are implementable against `engine_02` and evidenced by the current `plan_session` boundary.

#### 3.1 Injury Safety

Hard blocker when:
- the candidate matches a blocked movement pattern
- the current V1 active-limitation shortcut blocks that candidate's `movementPattern`

Non-blocking signal when:
- injury state exists but does not match `blockedMovementPatterns`
- an `activeLimitation` is present but the current V1 shortcut does not block that candidate
- broader injury-to-region mapping would be useful but is not closed by the V1 boundary yet

Current Rust alignment:
- `blockedMovementPatterns`
- active limitation shortcuts that currently block push candidates for `shoulder`, `elbow`, or `back`

#### 3.2 Fatigue Safety

Hard blocker when:
- `stateSnapshot.readinessState.systemicFatigue` reaches the active `policySnapshot.fatigueBlockThreshold` in a way that the current V1 rule family explicitly maps to candidate blocking
- Current Rust evidence for that mapping is: `systemicFatigue = severe` plus a non-`none` threshold can block push candidates

Non-blocking signal when:
- fatigue is below block threshold and is only a compatibility penalty
- `muscleFatigue` is present but no V1 rule maps that bucket deterministically to a hard block for the candidate yet
- recovery-policy-style unsafe markers would be useful but are not present in the closed V1 boundary

Current Rust alignment:
- severe systemic fatigue can block push candidates when `fatigueBlockThreshold` is active
- lower fatigue states remain soft-score inputs
- generic local-fatigue demand-profile blocking remains future work until V1 names a canonical mapping from `muscleFatigue` bucket IDs to candidate blocking rules

#### 3.3 Explicit Disqualifiers

Hard blocker when:
- `stateSnapshot.progressionState.records[]` contains the exact candidate `exerciseId` with `currentAction = swap`, and the candidate is that same exact exercise match

Non-blocking signal when:
- progression indicates `maintain`, `regress`, or `overload` but does not require exclusion
- a `swap` record exists for some other exercise
- novelty budget is exhausted but the candidate remains otherwise valid

Wave 1 decision:
- explicit disqualifier is a valid internal hard-block category only for the exact-exercise `swap` case above
- the stable internal hard-block `code` is `explicit_disqualifier`
- request or policy exclusion lists, generic safety deny-lists, and source-lineage exclusions are deferred until a future boundary revision adds canonical inputs for them
- they do not add a new public `DeterministicRejectionCode` in the current MVP `plan_session` envelope
- if they exhaust the pool without a universal injury or fatigue family, the public result is `no_valid_candidates`

#### 3.4 Deferred Families Under the Current Boundary

The following families remain architecturally valid but are not active Wave 1 `plan_session` hard blockers because `engine_02` does not normalize the required canonical inputs yet:

- equipment availability
- lock requirements

Boundary reason:
- `referenceSnapshot.exercises[].equipment[]` is descriptive reference metadata, not a canonical availability snapshot.
- `stateSnapshot` and `request` do not currently carry an engine-facing equipment-availability set, facility-capability set, locked-candidate set, or locked-slot boundary that could be evaluated deterministically.

Current Rust evidence:
- `packages/engine-rs/src/constraints.rs` defines `equipment_blocked` and `lock_required` string constants.
- The current typed `DeterministicRejectionCode` used by the Rust boundary does not expose those codes, and current `plan_session` behavior does not emit them end-to-end.
- Those constants are downstream alignment placeholders, not proof that the current `plan_session` boundary already implements equipment or lock blocking.

### 4. Hard Blockers Versus Non-Blocking Signals

The following are never hard blockers in Wave 1:

- class archetype bias
- novelty budget or novelty preference
- adherence streak
- mastery preference
- goal bias
- movement balance
- bounded uncertainty in readiness that does not reach a policy block threshold

The following may produce hard blockers only through the categories above:

- injury state
- systemic fatigue state under the closed V1 threshold rule
- explicit disqualifiers, limited to exact-exercise `swap` exclusions

Deferred for a later boundary revision:

- equipment state
- explicit locks
- recovery-policy unsafe markers
- generic local-fatigue demand-profile blockers
- request or policy exclusion lists
- source-lineage exclusions

Stateful progression rule:
- progression trend and current action are usually scoring inputs
- they become hard exclusions only when the exact candidate exercise has a progression record with `currentAction = swap`
- in closed V1, preserving movement intent during widening is limited to the focus-family-first rule in Section 2:
  - keep survivors whose `movementPattern` matches the family derived from normalized `request.sessionFocus`
  - if that survivor bucket is empty, fall back to any remaining survivors from the enumerated reference scope
- class or archetype alignment remains, at most, a downstream scoring preference
- same regional focus, slot intent, and lock semantics remain downstream scoring or future-boundary work unless `engine_01` and `engine_02` add canonical lock inputs

### 5. Rejection Semantics

Wave 1 freezes two layers of rejection semantics: internal candidate-level hard-block evidence and operation-level deterministic rejection summaries.

#### 5.1 Internal Candidate-Level Hard-Block Evidence

Each rejected candidate must retain internal semantic evidence equivalent to:

```text
CandidateHardBlockSemanticRecord
- candidateId
- candidateType
- stage: EvaluateHardConstraints
- category: injury_safety | fatigue_safety | explicit_disqualifier
- code
- detailCode optional
- blocking: hard
- inputsUsed
```

Wave 1 `code` values that are frozen now:
- `injury_blocked`
- `fatigue_blocked`
- `explicit_disqualifier`

Wave 1 `detailCode` examples that may appear in logs or equivalent internal traces without changing the public boundary:
- `blocked_movement_pattern`
- `active_limitation_push_shortcut`
- `systemic_fatigue_threshold`
- `progression_swap_required_exact_exercise`

Rules:
- internal traces may contain more than one hard-block record for the same candidate
- internal traces must preserve all hard reasons even if the public deterministic rejection collapses to one summary code
- `detailCode` is for replay/logging fidelity and is not a public envelope contract by itself
- the engine must preserve which canonical inputs were consulted, using stable source-path or stable-ID references internally
- exact public `decisionLog` serialization for those references is deferred to `engine_04`; this spec does not add a new public structured input-reference envelope type

Current Rust evidence:
- the current Rust decision-log structs still serialize `inputsUsed` as `Vec<String>`
- richer source-path trace structure remains downstream alignment work

#### 5.2 Internal Widening Trace Semantics

Candidates removed only because a narrower bucket won during `ApplyPermittedWidening` are not rejected. The engine must preserve semantic trace evidence equivalent to:

```text
WideningTraceSemanticRecord
- stage: ApplyPermittedWidening
- fromScopeBucket
- toScopeBucket optional
- transitionReason: preferred_scope_satisfied | preferred_scope_exhausted
- droppedCandidateIds
- survivingCandidateIds
```

Rules:
- `droppedCandidateIds` from widening are not hard-blocked candidates
- widening traces must preserve deterministic candidate ordering within each recorded ID list
- if all permitted scopes are exhausted, the public rejection summary is derived only from hard-block evidence plus the empty or mixed-exhausted rules in Section 5.3
- exact public `decisionLog` serialization for widening traces is deferred to `engine_04`; this spec does not add a new public widening-record envelope type

#### 5.3 Operation-Level Deterministic Rejection Summary

The current public deterministic rejection envelope stays:

```text
DeterministicRejection
- status = deterministic_rejection
- rejectionCode
- blockedCandidateIds
```

Reachable Wave 1 `rejectionCode` values for the current MVP `plan_session` boundary:
- `injury_blocked`
- `fatigue_blocked`
- `no_valid_candidates`

Meaning:
- `injury_blocked`: the operation was deterministically blocked by injury safety constraints
- `fatigue_blocked`: the operation was deterministically blocked by the closed V1 systemic-fatigue safety rule
- `no_valid_candidates`: the candidate pool was empty, or all permitted scopes were exhausted without a universal injury or fatigue blocker family

Reserved for a future boundary revision, but not currently reachable in the typed Rust MVP `plan_session` envelope:
- `equipment_blocked`
- `lock_required`

Wave 1 public precedence when one summary code must be emitted:

1. Emit `no_valid_candidates` when the enumerated permitted-scope pool is empty before hard filtering.
2. Otherwise, collect hard-block records for every candidate considered across all permitted scopes.
3. Emit `fatigue_blocked` when every hard-blocked candidate in that exhausted permitted-scope pool has at least one `fatigue_blocked` record.
4. Else emit `injury_blocked` when every hard-blocked candidate in that exhausted permitted-scope pool has at least one `injury_blocked` record.
5. Else emit `no_valid_candidates`.

`blockedCandidateIds` rules:
- IDs are deduplicated and sorted ascending by stable string `candidateId`
- when the public `rejectionCode` is `fatigue_blocked` or `injury_blocked`, include only candidates carrying that emitted family
- when the public `rejectionCode` is `no_valid_candidates` because the pool was empty, emit `[]`
- when the public `rejectionCode` is `no_valid_candidates` because the pool was mixed-exhausted or exhausted by explicit disqualifiers, include all hard-blocked candidate IDs from the exhausted permitted scopes

Alignment note:
- current Rust public boundary evidences only `injury_blocked`, `fatigue_blocked`, and `no_valid_candidates`
- `packages/engine-rs/src/constraints.rs` also defines `equipment_blocked` and `lock_required` string constants, but current `DeterministicRejectionCode` and `plan_session` do not make those codes reachable
- current `plan_session` rejection collapse logic is simpler than the family-universality rule above; aligning implementation to this spec remains downstream work

### 6. Candidate Metadata Retention

The engine must retain enough metadata for scoring, decision logging, and replay after hard filtering.

Every surviving candidate in the post-filter set must retain:

- `candidateId`
- `candidateType`
- `referenceOrder`
- `sourcePath`
- `scopeBucket`
- `requestedFocus` or equivalent operation scope tag
- `movementPattern` and movement-family fallback key if applicable
- relevant equipment tags
- active-program context actually used by the pipeline
- optional descriptive tags used only for downstream scoring or logging
- progression lookup key
- current progression summary:
  - current action
  - trend
  - whether exact-match swap exclusion applied
- readiness and injury context references actually used by constraints
- deterministic novelty seed scope key
- class archetype key

Every rejected candidate must retain at least:

- `candidateId`
- `candidateType`
- `referenceOrder`
- `sourcePath`
- its full internal hard-block evidence list

Retention rules:
- metadata must be typed or enum-like, not freeform prose
- metadata retention must not depend on UI needs
- scoring may append derived score data later, but it must not discard the retained pre-score metadata

### 7. Deterministic Ordering Rules

Wave 1 freezes pre-score candidate ordering as follows:

1. Candidate enumeration assigns `referenceOrder` from the normalized reference scope.
2. Hard filtering preserves enumeration order among survivors.
3. Preferred-scope survivors are never interleaved with widened-fallback survivors.
4. If widening is required, the widened survivor set is ordered by original `referenceOrder`.
5. If two candidates would otherwise share the same deterministic position because the source scope came from a keyed container, the app must have canonicalized that source in `engine_02`; the engine then falls back to ascending stable string `candidateId`.

Current Rust alignment:
- candidate filtering preserves reference iteration order
- current `constraints.rs` sorts `blockedCandidateIds` ascending by stable string ID
- score ranking later uses total score descending and stable `candidateId` fallback
- seeded tie-breaking is deferred to scoring/selection and does not affect the post-filter set order

### 8. Stateful Progression, Fatigue, Injury, Class Bias, and Novelty

Wave 1 candidate-pipeline decisions for stateful behavior are:

- Injury safety and the closed V1 systemic-fatigue rule can both act as hard blockers.
- For closed V1 `plan_session`, the only evidenced hard fatigue rule is systemic-fatigue thresholding against candidate `movementPattern`; `muscleFatigue` remains available state but not a closed generic hard-block rule.
- Progression trend, current action, class bias, and novelty are attached before filtering so later stages can score them deterministically.
- Class bias is always a bounded soft preference. It never creates, removes, or revives a candidate.
- Novelty is always bounded and policy-capped. It never overrides current safety blockers and would not override future equipment or lock blockers if those families are later activated.
- Repeated regressions or explicit `swap` state can exclude only the exact candidate `exerciseId` when the corresponding progression record sets `currentAction = swap`.
- In closed V1, widening after that exact-exercise exclusion is still limited to preferred-family-first and then cross-family fallback from normalized `sessionFocus`.
- Fatigue below block threshold remains a scoring signal, not a candidate rejection.
- Injury state below explicit block threshold remains a compatibility signal, not a candidate rejection.

This preserves the addendum rule that safety and recovery outrank motivational bias while allowing stateful progression to influence which candidate lineage survives to scoring.

### 9. Decision-Log Requirements for the Pipeline

The candidate pipeline must preserve enough semantic trace data to replay, whether that data is surfaced directly in the current public `decisionLog` entries or kept as equivalent internal evidence until `engine_04` settles exact serialization:

- the resolved operation scope
- the enumerated candidate IDs in pre-filter order
- every rejected candidate with its hard-block evidence
- every widening decision with the recorded scope change and dropped or surviving candidate IDs
- whether widening occurred and which scope transition was taken
- the final post-filter candidate IDs in deterministic order

The trace must use structured fields derived from retained metadata, not UI-facing prose summaries. Where input references are preserved, they should point at canonical source paths and stable IDs or enums rather than freeform labels. Exact public `decisionLog` field structure remains an `engine_04` decision.

## Acceptance Criteria Check

- The pre-score pipeline is now locked from normalized input through post-filter candidate materialization.
- Hard constraints are explicitly separated from non-blocking stateful signals, and non-implementable equipment or lock assumptions are deferred under the current boundary.
- The rejection semantics include the currently reachable public codes plus internal exact-exercise explicit-disqualifier evidence for replay, without expanding the public V1 envelope.
- Deterministic ordering and metadata retention rules are explicit.
- Widening authority is closed to focus-family-first and cross-family fallback from normalized `sessionFocus`; no broader policy-controlled widening is implied by V1.
- Stateful progression, fatigue, injury, class bias, and bounded novelty are integrated without leaking scoring formulas into this spec.

Result:
- `engine_03` is decision-complete for Wave 1 and is ready for downstream review and `engine_04` handoff.

## Remaining Open Risks

- Equipment availability and lock requirements remain future boundary work until `engine_01` and `engine_02` add canonical inputs for them.
- Exact public `decisionLog` serialization for candidate hard-block evidence, widening traces, and richer input references is deferred to `engine_04`.
- Rust `plan_session` still needs downstream alignment if we want those richer internal traces emitted consistently.
- Cross-language canonical serialization and numeric policy remain architecture-level risks outside this spec.
