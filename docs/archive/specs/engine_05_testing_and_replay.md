# Engine Spec 05: Testing and Replay

## Status

- `State`: Green for this wave
- `Priority`: Accepted

## Goal

Define the normative test and replay strategy for the standalone engine as a deterministic, replayable decision system, using the current Rust reference crate as the baseline evidence source.

This spec is policy-complete, and the Wave 1 Rust baseline already satisfies the replay, trace, recent-completion window, level-threshold, and closed-loop coverage described below.

## Dependencies

- `specs/engine_01_boundary_contracts.md`
- `specs/engine_02_snapshot_normalization.md`
- `specs/engine_03_candidate_pipeline_and_constraints.md`
- `specs/engine_04_scoring_selection_and_decision_logs.md`
- `specs/engine_addendum_stateful_progression_gamification.md`

## In Scope

- Fixture classes and their intended assertions
- Full-golden versus partial-assertion policy
- Replay matrix for `plan_session`, `complete_session`, and the closed stateful loop
- Invariants and lightweight property-style coverage
- Regression policy for contract changes versus heuristic changes
- Explicit accounting for the addendum-driven progression and gamification loop
- Clear separation between what the Rust baseline already proves and what remains deferred

## Out of Scope

- DB integration tests
- API route tests outside the engine crate public boundary
- UI or browser tests
- Supabase verification
- Cross-language parity certification until canonical serialization and numeric policy are closed

## Current Rust Baseline

The Rust reference crate already provides the Wave 1 evidence base for this policy-complete spec:

- Module tests cover `boundary`, `constraints`, `progression`, `scoring`, `gamification`, `rng`, and `logging`.
- Integration tests cover `plan_session`, `complete_session`, `state_update_loop`, `replay_hashes`, `public_api_failures`, `plan_session_properties`, `complete_session_properties`, and `replay_chain`.
- Full JSON goldens already exist for one named `plan_session` baseline and one named `complete_session` baseline, and those baselines now pin the derived replay hashes for the named fixtures.
- Replay stability is already checked for identical inputs, seed changes, canonicalization-version changes, classification-input changes, and closed-loop `complete -> patch -> next plan` flows.
- The replay-hash implementation now derives receipts from canonicalized public material: `inputHash` reflects sanitized public input material, `outputHash` reflects public output material without `replayReceipt`, `metadata` is excluded on derived-path replay tests, `complete_session` request/session note fields are excluded on derived-path replay tests, `complete_session` falls back to `determinism.effectiveAt` for retained-completion trace entries when `request.session.completedAt` is absent in internal fallback coverage, and canonically equivalent `recentCompletions` ordering is normalized for replay-hash stability.
- Public-boundary tests already reject malformed request and snapshot shapes and accept the canonical nullable `complete_session` request shape.

This spec turns that baseline into explicit policy. Wave 1 already demonstrates the replay, trace, recent-completion window, level-threshold, and closed-loop scenarios in the Rust crate; the remaining policy work is to preserve those guarantees and defer only cross-language parity, canonical serialization closure, numeric policy closure, and broader future permutations.

## Closed Decisions

### 1. Fixture Classes

Wave 1 uses named deterministic fixtures. Each fixture class exists to lock a specific contract surface:

| Fixture class | Purpose | Rust baseline status |
|---|---|---|
| Baseline decision fixtures | Prove one stable end-to-end public envelope for `plan_session` and one for `complete_session` | already covered |
| Hard-constraint and rejection fixtures | Prove hard blockers win before soft scoring and produce typed deterministic rejection envelopes | already covered |
| Stateful outcome fixtures | Prove `complete_clean`, `complete_compromised`, `partial`, and `missed` completion branches and their resulting progression actions | already covered |
| Threshold fixtures | Prove behavior near fatigue, progression, streak, XP, level, and bounded-history edges, including the required public `complete_session` level-up path | already covered |
| Non-material variant fixtures | Prove irrelevant metadata, plan reference ordering, and `complete_session` free-text notes do not change outputs or authoritative replay hashes | already covered |
| Material replay variant fixtures | Prove seed, `effectiveAt`, `ruleVersion`, microcycle, canonicalization-version, and completion-classification changes affect replay-relevant outputs | already covered |
| Replay-chain fixtures | Prove the next `plan_session` can be reconstructed deterministically from the completion input snapshot plus semantic state patch | already covered |
| Public-boundary validation fixtures | Prove malformed request or snapshot shapes fail before engine logic runs | already covered |

Naming policy:

- Fixture names must describe the branch or invariant they lock, not the implementation detail they happen to exercise.
- Baseline fixtures are the only fixtures that should anchor full public-envelope goldens by default.
- Threshold fixtures should stay small and focused on one boundary at a time.

### 2. Golden-Output Policy

Wave 1 locks exactly two full public-envelope goldens as normative baselines:

- one `plan_session` baseline golden
- one `complete_session` baseline golden

These goldens may assert the full JSON output currently emitted by the Rust crate:

- `schemaVersion`
- `operation`
- `result`
- `statePatch`
- `events`
- `decisionLog`
- `replayReceipt`

Policy decisions:

- Full goldens are reserved for stable public-envelope scenarios with high regression value and low fixture ambiguity.
- New scenarios should not default to full goldens. They should start as partial-assertion tests unless the scenario is intended to become a new canonical baseline.
- Goldens must stay human-reviewable. If a scenario becomes too large or too tuning-sensitive, it should be converted to partial assertions instead of freezing incidental detail.
- Goldens are contract tests, not snapshot spam. Updating them requires an explicit explanation of the contract or intended behavior change.

### 3. Partial-Assertion Policy

Partial assertions are the default for everything that is important but not fully contract-frozen.

Wave 1 partial assertions must cover:

- rejection status and typed rejection codes
- public rejection-summary precedence, including `no_valid_candidates` versus the `engine_03` family-universality rule for `fatigue_blocked` and `injury_blocked`
- selected IDs being unique and reference-backed
- decision-log step ordering
- allowed top-level `statePatch` buckets
- hard constraints outranking class bias or other soft scoring
- fatigue- or progression-driven branch changes
- metadata-only variants producing identical outputs
- `complete_session` note-only variants producing identical outputs and identical authoritative replay-hash behavior for `request.session.notes` and `request.session.exercises[].sets[].notes`
- reference-order variants producing identical outputs where ordering should be canonical or semantically irrelevant
- candidate-pipeline trace coverage required by `engine_03`, including enumerated candidate order, candidate-level rejection records, and widening-transition logging when widening occurs
- monotonic or preserved gamification counters as required by the contract
- bounded `recentCompletions` window and deterministic ordering behavior when completion history is part of the asserted state or replay setup
- closed-loop replay stability for `plan -> complete -> patch -> next plan`

Wave 1 partial assertions must avoid freezing:

- incidental heuristic scores outside the fields already intentionally exposed in the baseline goldens
- human-readable explanation wording beyond the existing baseline public envelope
- entire scored-candidate inventories
- hash bytes or serialization byte layout beyond the current Rust implementation behavior

### 4. Replay Matrix

Replayability is a first-class engine contract. The following matrix is normative for Wave 1.

| Scenario | Expected result | Rust baseline status |
|---|---|---|
| Identical `plan_session` input run twice | identical output and identical replay-receipt fields | already covered |
| Identical `complete_session` input run twice | identical output and identical replay-receipt fields | already covered |
| Metadata-only input change | identical output; metadata must not perturb replay-relevant behavior | already covered |
| `request.session.notes` change only | identical output; authoritative replay hashes do not change | already covered |
| `request.session.exercises[].sets[].notes` change only | identical output; authoritative replay hashes do not change | already covered |
| Reference exercise order change with identical semantics | identical `plan_session` output | already covered |
| Seed change | `seedUsed` changes; replay hashes change; output may change only in bounded seeded stages | already covered |
| `effectiveAt` change | replay hashes change; output may change only where explicit time input is materially used by the contract | already covered |
| `ruleVersion` change | replay hashes change; output may change only where rule-family behavior differs | already covered |
| Microcycle or explicit cycle-index change | replay hashes change; output may change when the cycle is a real input | already covered |
| Canonicalization-version change | replay hashes change | already covered for `plan_session` |
| Completion classification input change | replay hashes change; resulting classification- and patch-sensitive outputs may change | already covered |
| `complete_session` patch applied to next planning input | next `plan_session` is replay-stable for the reconstructed snapshot | already covered |
| Non-material metadata change on reconstructed next plan | no output or replay-hash change | already covered |
| Reconstructed next plan with canonically equivalent `recentCompletions` ordering | no output or replay-hash change once the `engine_02` ordering rules are respected | already covered |
| `recentCompletions` window boundary crossed on `complete_session` | retained-completion trace behavior preserves only the most recent three entries per `exerciseId`, ordered by `exerciseId`, `completedAt`, `quality`; next-plan replay remains stable for canonically equivalent `recentCompletions` input | already covered |
| Malformed public request or unknown fields | deterministic invalid-input rejection before engine execution | already covered |
| Cross-language replay of the same canonical bytes | identical hashes and outputs across implementations | deferred |

Interpretation rules:

- The engine must never rely on hidden clock time, locale, environment variables, or unordered iteration.
- Week-to-week or microcycle variation is allowed only when it comes from explicit canonical inputs.
- Replay certification in Wave 1 is implementation-local to the Rust baseline. Cross-language parity certification is intentionally deferred until canonical serialization and numeric policy are closed.

### 5. Invariants and Property-Test Scope

Wave 1 uses lightweight deterministic scenario-property tests, not broad fuzzing. The goal is to assert invariants that survive heuristic tuning.

Mandatory invariant coverage:

- selected exercise IDs are unique
- selected exercise IDs come from the reference snapshot
- hard constraints run before soft scoring and motivational bias
- decision-log step ordering is stable for the current operation contract
- candidate-pipeline trace data required by `engine_03` is preserved when relevant: enumerated candidate order, typed candidate rejection records, widening-transition record, and final post-filter order
- semantic state patches touch only engine-owned buckets
- applying a semantic state patch preserves unrelated planning context and unrelated engine-owned subfields
- same canonical input plus same seed and version metadata yields the same output
- metadata-only differences do not change outputs
- `complete_session` free-text note differences do not change outputs or authoritative replay hashes
- bounded `recentCompletions` history preserves the `engine_02` window and ordering rules when replay fixtures are reconstructed from canonical input
- gamification counters are monotonic or explicitly preserved unless a reset rule is part of the contract
- no output depends on wall clock, locale, environment variables, or accidental iteration order

Property-test scope decisions:

- Hand-authored scenario-property tests are sufficient for Wave 1.
- Generator-heavy fuzzing is deferred until snapshot normalization, candidate taxonomy, score precision, and canonical serialization policy settle.
- The purpose of property-style coverage in Wave 1 is to guard contracts and invariants, not to mathematically prove the scoring model.

### 6. Addendum-Driven Stateful Progression and Gamification Coverage

The addendum makes the closed adaptation loop a required test target, not an optional integration test.

Required stateful coverage for Wave 1:

- `plan_session` must show fatigue-aware recommendation changes.
- `plan_session` must show progression-action summaries derived from current progression state, including default behavior when a record is missing.
- `plan_session` must show class-archetype bias staying bounded beneath hard constraints.
- `complete_session` must cover all four outcome classes: `complete_clean`, `complete_compromised`, `partial`, and `missed`.
- `complete_session` must update progression state deterministically across `overload`, `maintain`, `regress`, and `swap`.
- `complete_session` must update XP and adherence streak deterministically, and preserve streak behavior where the contract says it should not change.
- `complete_session` must include at least one explicit public level-up threshold scenario asserting the result-path level-up indicator plus the corresponding XP and level state changes; the current Rust baseline already covers this scenario, so it is a Wave 1 contract requirement rather than an open gap.
- `complete_session` and replay-chain coverage already assert the normalized `recentCompletions` window rule from `engine_02`: keep only the most recent three entries per `exerciseId` and preserve canonical ordering by `exerciseId`, `completedAt`, then `quality`.
- The closed loop must prove that the next plan depends only on canonical snapshot state plus the semantic state patch, not on hidden external history.

What is already covered in the Rust baseline:

- fatigue-aware branch changes
- progression defaulting and branch coverage
- class bias bounded by hard constraints
- XP delta and adherence streak changes
- missed-session streak preservation
- public level-threshold handling
- canonical recent-completion window ordering and retention
- deterministic next-plan reconstruction from the completion patch
- closed-loop replay from `complete -> patch -> next plan`

What remains deferred:

- broader future threshold permutations, including additional XP boundary rollover combinations and streak-reset cases if they become contractual
- broader future completion-history permutations beyond the required canonical window scenario
- richer event-emission coverage if optional domain events become normative rather than optional

### 7. Regression Policy

Regression handling is split into contract regressions and heuristic regressions.

Contract regression policy:

- If a public envelope, typed rejection, state-patch shape, decision-log step order, or replay-receipt contract changes, tests must fail loudly.
- Contract changes require a spec update and an intentional test update in the same change.
- Full-golden updates require a written explanation of why the baseline contract moved.

Heuristic regression policy:

- Tuning changes are allowed if they preserve the boundary contract, replay guarantees, hard-constraint ordering, and invariant suite.
- Heuristic changes should primarily require partial-assertion updates, not blanket new goldens.
- A heuristic change that alters a baseline golden is treated as a higher-bar change because it moved a canonical baseline scenario.

Failure triage policy:

- A replay-stability failure is a release-blocking engine defect.
- A public-boundary validation failure is a release-blocking contract defect.
- A threshold or tuning-scenario failure may be a heuristic regression, but it still requires review against the invariant suite before accepting any change.

### 8. Canonical Serialization and Replay-Hash Policy

Wave 1 deliberately leaves canonical serialization, the final hash algorithm, and numeric policy open, but `engine_02` has closed replay-hash field membership at the field-set level.

Field-set expectations that are now normative:

- `replayReceipt.inputHash` is expected to cover the canonicalized public input material:
  - `schemaVersion`
  - `operation`
  - `determinism`, including `seed`, `effectiveAt`, `ruleVersion`, `referenceHash`, and `canonicalizationVersion`
  - `referenceSnapshot`
  - `stateSnapshot`
  - `policySnapshot`
  - `request`
- `replayReceipt.inputHash` excludes:
  - `metadata`
  - request free-text fields marked non-decision by `engine_02`, currently `request.session.notes` and `request.session.exercises[].sets[].notes`
- `replayReceipt.outputHash` is expected to cover the canonicalized public output material excluding the replay receipt fields themselves.
- `replayReceipt.referenceHash` must equal `determinism.referenceHash`.

Already tested today:

- replay receipts exist on the public envelope
- replay receipt fields are stable for identical Rust inputs
- replay receipt fields change when certain deterministic inputs change
- baseline goldens pin the current Rust implementation's receipt field values for the named baseline fixtures

Still open:

- the canonical byte-serialization algorithm for replay inputs and outputs
- the final hash algorithm contract
- the numeric policy for replay-relevant values and cross-language determinism
- the cross-language replay-hash compatibility contract
- whether replay hashes are part of the long-term compatibility surface or implementation-versioned diagnostics

Interpretation rule:

- Current Rust tests certify deterministic receipt behavior within the Rust baseline.
- They do not certify cross-language canonical hashing and must not be read as having closed canonical serialization or hash-algorithm questions.

## Acceptance Criteria

- Fixture classes are explicitly defined and mapped to required assertions.
- Full-golden policy is limited to stable named baseline outputs; partial assertions are the default elsewhere.
- The replay matrix clearly distinguishes identical-input stability, material deterministic input changes including `effectiveAt` and `ruleVersion`, non-material metadata and free-text-note changes, malformed-input rejection, and closed-loop replay.
- Invariants and lightweight property-style checks are defined as contract guards that survive heuristic tuning.
- The stateful progression and gamification loop is explicitly part of required coverage, including the required public `complete_session` level-up threshold path, canonical `recentCompletions` window behavior, and closed-loop replay path, all of which are already covered in the Rust baseline.
- `engine_03` rejection-summary precedence and candidate-pipeline trace obligations are explicitly part of required test policy.
- The spec states exactly what the Rust baseline already tests versus what remains deferred.
- Canonical serialization and hash algorithm remain open, while replay-hash field-set expectations and current implementation-local replay receipt coverage are described precisely.

## Open Risks or Unresolved Items

- The remaining deferred work is cross-language replay certification, canonical serialization closure, numeric policy closure, and broader future permutation coverage beyond the Wave 1 fixture set.
- Cross-language parity certification remains blocked on canonical serialization closure and numeric policy closure.
