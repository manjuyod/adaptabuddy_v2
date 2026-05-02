# Engine Addendum: Stateful Progression and Gamification MVP

This addendum extends the existing engine-first spec set. It does not replace `engine_01` through `engine_06`.

V1 precedence rule:
- This addendum remains normative for stateful progression and gamification intent unless a later numbered engine spec closes a narrower V1 contract.
- When a later numbered engine spec closes a narrower V1 contract for a specific field, bucket, ordering rule, or rejection family, that narrower numbered-spec contract controls V1 implementation and replay behavior over broader addendum wording.
- For the current V1 boundary, `engine_02` controls normalized snapshot shape and field placement, and `engine_03` controls active candidate-pipeline hard constraints and rejection behavior.

## 1. Purpose of Addendum

This addendum extends the Rust engine spec so the engine is no longer only a static program amalgamation selector.

The MVP shift is:

`user state -> generate recommendation -> session outcome -> state update -> next recommendation`

This addendum preserves the existing engine-first architecture:
- `apps/web` remains responsible for auth, persistence, transport, edge validation, and orchestration.
- The Rust engine remains pure, deterministic, and storage-agnostic.
- Existing program selection, fatigue inputs, days-per-week handling, injury constraints, and deterministic output expectations remain valid unless explicitly extended here.

## 2. Why the Current Engine Is Insufficient

The current engine family can already generate deterministic recommendations, but it is still under-specified for longitudinal coaching behavior.

It is insufficient because it does not yet make athlete state, progression trend, and post-session state updates first-class contract elements. It also lacks a disciplined gamification layer that can improve adherence without weakening safety, fatigue, or injury rules.

Without these additions, the engine cannot reliably distinguish:
- a novice from an advanced athlete
- a fresh athlete from a recovery-constrained athlete
- a lift that is progressing from one that is stalled
- a stateful recommendation from a one-off recommendation
- a soft motivational bias from a hard safety constraint

## 3. MVP Scope Changes

Added in MVP:
- canonical `AthleteState`
- explicit separation of raw athlete inputs, derived metrics, and rolling state
- first-class session recommendation plus session-outcome ingestion loop
- per-exercise or per-movement progression tracking
- lightweight gamification primitives: `xp`, `level`, `classArchetype`
- expanded scoring inputs for fatigue, injury, progression need, movement balance, class bias, and controlled novelty

Changed in MVP:
- `plan_session` must consume athlete state, not only static preferences
- `complete_session` becomes the primary state-update operation
- decision logs must explain progression actions and gamification updates when they materially affect output

Deferred in MVP:
- rich social systems
- economy systems
- narrative progression
- black-box adaptive systems

## 4. New Domain Concepts

`AthleteState` is the canonical engine-facing aggregate for one athlete.

The MVP domain model must distinguish three categories:

| Category | Meaning | MVP examples |
|---|---|---|
| Raw inputs | caller-supplied facts read directly by the engine | height, weight, `trainingAge`, goal bias, available days per week, injury or limitation state, known lift or performance stats, age optional, sex optional |
| Derived metrics | deterministic values computed from raw inputs or rolling state | estimated 1RM, workload tolerance class, recovery budget class |
| Rolling state | engine-owned mutable state used across cycles | fatigue state, progression records, bounded recent completions, adherence streak, xp, level |

`AthleteState` must include at minimum:
- `athleteProfile`
- `readinessState`
- `injuryState`
- `performanceState`
- `progressionState`
- `gamificationState`
- `activeProgramState`
- `recentCompletions`

`athleteProfile` must include:
- `height`
- `weight`
- `trainingAge`
- `goalBias`
- `availableDaysPerWeek`
- `classArchetype`
- `age` optional unless already reliably supported upstream
- `sex` optional unless already reliably supported upstream

V1 field-closure note:
- `trainingAge` is the closed V1 experience field.
- `experienceLevel` remains broader addendum vocabulary for future revisions only and is not an alternative engine-facing V1 field.

Derived metrics policy:
- MVP-required:
  - estimated 1RM where sufficient performance data exists
  - workload tolerance or recovery budget class
- MVP-optional:
  - BMI
  - DOTS or similar powerlifting score
  - composite readiness score

Rule: if a metric can be recomputed cheaply and deterministically from canonical state, it should remain derived unless preserving it as rolling state materially improves replayability or decision stability.

## 5. Updated Engine Responsibilities

The engine must now:
- accept `AthleteState` as a first-class decision input
- derive deterministic metrics needed for recommendation and progression
- classify recent progression trend
- choose a progression action per relevant exercise or movement family: `overload`, `maintain`, `regress`, or `swap`
- score candidates using both static preference signals and state-aware signals
- generate a recommendation without mutating app-owned storage
- ingest session outcome data and emit a semantic state patch
- update progression, fatigue, readiness, and gamification state deterministically
- emit structured decision logs that explain state-aware decisions

The engine still must not own:
- persistence schemas
- workout history queries
- UI reward presentation
- auth, transport, or DB orchestration

## 6. New Input Contract

The existing `EngineInputV1` envelope remains, but `stateSnapshot` is extended to include the following engine-owned state buckets.

V1 boundary note:
- The bucket list below is subordinate to the narrower `engine_02` snapshot contract.
- For V1, `recentCompletions` lives only in top-level `stateSnapshot.recentCompletions`, not as a second bounded-history field under `performanceState`.
- For V1, `gamificationState` is frozen to `xp`, `level`, and `adherenceStreak`.
- Stable string `id` values are the authoritative engine join keys. Slugs are descriptive only where the numbered specs explicitly include them.

`athleteProfile`
- `height`
- `weight`
- `trainingAge`
- `goalBias`
- `availableDaysPerWeek`
- `classArchetype`
- `age` optional
- `sex` optional

`readinessState`
- per-muscle fatigue
- systemic fatigue or recovery headroom
- recent readiness flags if explicitly supplied

`injuryState`
- active limitations
- blocked movement patterns
- severity or restriction class

`performanceState`
- known lift stats
- per-exercise capacity data

V1 note:
- bounded recent-completion history is represented only by top-level `recentCompletions`
- broader performance-owned recent-completion summaries remain deferred unless a future numbered spec adds a separate canonical field

`progressionState`
- previous performance reference
- recent trend window
- current progression action
- regression, stall, or swap counters where applicable

`gamificationState`
- `xp`
- `level`
- `adherenceStreak`

V1 note:
- milestone counters, reward ledgers, and other richer gamification bookkeeping are deferred until a future numbered spec expands the boundary

Input contract rules:
- raw inputs cross the boundary in canonical units
- derived metrics used by the engine must either be computed inside the engine from canonical inputs or be supplied with explicit formula or version metadata
- full workout history is not required in-engine for MVP
- only bounded summaries needed for deterministic replay belong in `stateSnapshot`
- `stateSnapshot` must remain decision-relevant and storage-agnostic
- equipment-availability and lock-state hard-constraint families are architecturally valid, but under the current V1 boundary they remain deferred until canonical engine-facing inputs exist

## 7. New Output Contract

`EngineOutputV1` remains the canonical envelope, but state-aware operations require richer result payloads.

For `plan_session`, `result` should include:
- recommended session or movement set
- predicted fatigue or recovery demand summary
- progression action summary for key lifts or movement groups
- score contributions relevant to the final decision
- class bias contribution if used
- controlled novelty rationale if used

For `complete_session`, `result` should include:
- session outcome classification
- updated progression action summary
- awarded XP summary
- level-up indicator if triggered
- warnings if recovery or injury rules tightened future choices

`statePatch` must support semantic updates for:
- fatigue and readiness values
- per-exercise progression records
- bounded `recentCompletions`
- `adherenceStreak`
- xp and level
- movement swap flags or deload or regression markers

Optional domain events may include:
- `progression_hit`
- `stall_detected`
- `swap_triggered`
- `level_up`

The patch must remain semantic and replayable. It must not be a storage-shaped merge blob or app persistence diff.

## 8. Stateful Adaptation Loop

The MVP loop is first-class engine behavior.

1. `plan_session`
- consume `AthleteState`, request context, policy, and determinism inputs
- derive required metrics
- filter unsafe candidates
- choose progression actions
- score remaining candidates
- perform seeded tie resolution where allowed
- emit recommendation and structured decision log

2. `complete_session`
- consume performed outcome for the recommended session
- classify completion quality
- update fatigue, progression state, and gamification state
- emit semantic `statePatch`

3. next cycle
- caller persists app-owned state
- caller rebuilds the next `AthleteState`
- next `plan_session` uses the updated state

The engine must not rely on hidden history outside the snapshot. The snapshot must contain enough rolling state to replay the next decision offline.

## 9. Progression Model

The MVP progression unit is per exercise or per movement family.

Each progression record must support:
- previous performance reference
- last successful load and reps where available
- trend direction: `improving`, `stalled`, `regressing`
- completion quality
- current action: `overload`, `maintain`, `regress`, `swap`

Minimal completion-quality classes:
- `complete_clean`
- `complete_compromised`
- `partial`
- `missed`

MVP trend detection rules:
- use the last 2 to 3 relevant exposures
- compare target attainment, load or rep performance, confidence, and fatigue or readiness context
- classify only into `improving`, `stalled`, or `regressing`

MVP progression rules:
- `overload` when the athlete hits or exceeds the upper target band with acceptable fatigue and non-regressing trend
- `maintain` when the athlete is close to target, confidence is low, or readiness is uncertain
- `regress` when targets are missed repeatedly, performance declines, or recovery headroom is poor
- `swap` when the movement is blocked by injury or repeated regressions indicate the current choice is no longer productive

V1 hard-constraint note:
- Equipment-driven swaps and explicit lock-driven swaps remain architecturally valid future behavior, but `engine_03` defers those families under the current V1 boundary until canonical inputs exist.

`swap` must preserve movement intent where possible:
- prefer same movement family first
- then prefer same class or archetype alignment
- only then widen substitution scope

The MVP does not require ML, long-horizon forecasting, or advanced deload trees.

## 10. Gamification Model

Gamification is a biasing layer, not a control layer.

MVP primitives:
- `xp`
- `level`
- `classArchetype`

V1 bucket note:
- `classArchetype` remains an `athleteProfile` field for V1 recommendation biasing.
- `gamificationState` itself is limited to `xp`, `level`, and `adherenceStreak` in the closed V1 snapshot contract.

Supported MVP archetype examples:
- `powerlifter`
- `bodybuilder`
- `hybrid`
- `athlete`
- `general_fitness`

Rules:
- `classArchetype` influences recommendation weighting only
- archetype must never hard-lock the engine into unsafe or incompatible choices
- hard constraints and safety rules always outrank gamification

XP should come from simple measurable events:
- workout completion
- consistency or adherence streak
- PR or progression event
- high-quality completion of the recommended session

Leveling policy:
- use a deterministic threshold function
- exact XP values may evolve without changing the contract
- level-up results must be replayable and logged

Gamification must not override:
- injury blockers
- severe fatigue blockers
- recovery or safety policy blockers

Future-facing note:
- If equipment or lock blocker families are activated in a later boundary revision, gamification must not override those either.

## 11. Scoring Model Changes

The scoring model must now include state-aware signals in addition to template preference or goal matching.

Hard constraints:
- injury incompatibility
- explicit movement exclusions
- severe fatigue or recovery blocker
- policy-level safety blockers

Deferred under current V1 boundary:
- equipment incompatibility
- locked program or slot constraints

These families are architecturally valid, but they are not active V1 hard blockers until canonical engine-facing inputs are added by a later numbered spec.

Soft scoring:
- fatigue and recovery compatibility
- injury compatibility when not a blocker
- progression need
- movement balance across the week or microcycle
- goal bias match
- class archetype bias
- mastery or competence fit
- controlled novelty or variation
- recent adherence and completion trend

Tie-breaking and randomness:
- deterministic candidate ordering first
- seeded randomness only among candidates within an allowed top band
- stable ID ordering as the final fallback

Novelty policy:
- novelty is budgeted and capped
- novelty cannot override safety, injury, or recovery blockers
- novelty usage must be visible in the decision log

Scoring policy constraints:
- hard constraints must run before soft scoring
- class bias must remain a small bounded positive influence
- fatigue, injury, and recovery compatibility must outweigh motivational bias
- the addendum defines scoring categories and decision order, not frozen tuning constants

## 12. Determinism and Replayability

This addendum preserves strict determinism.

Rules:
- same canonical input state, same seed, same explicit time inputs, same version metadata, same output
- the engine must not call system time, external randomness, locale-sensitive logic, or unordered iteration that affects outcome
- all week-to-week or microcycle-to-microcycle variation must come from explicit inputs such as `weekIndex` or `microcycleIndex`
- sub-seeds may be derived from the base seed plus canonical state or version inputs
- seeded randomness is allowed only for bounded tie-breaking or bounded novelty
- the decision log must include derived metrics, progression action, score contributions, tie-break stage, and seed usage sufficient for replay

Week-to-week variation does not break determinism because the week or microcycle index is part of the canonical input.

Replay requirements added by this addendum:
- the same canonical input plus the same seed must reproduce the same recommendation and state patch
- the same recommendation plus the same completion payload must reproduce the same completion result and state patch
- replay receipts must remain independent of DB row identity

## 13. Rust Module / Crate Boundary Recommendations

Use one core Rust crate for MVP, with focused internal modules.

Recommended module split:
- `domain`
  - core structs and enums for athlete state, progression state, gamification state, and session outcome
- `derivations`
  - deterministic derived metrics such as estimated 1RM and recovery budget class
- `constraints`
  - hard-constraint evaluation
- `progression`
  - trend detection and overload or maintain or regress or swap decision rules
- `scoring`
  - soft scoring categories and tie-band handling
- `adaptation`
  - recommendation loop orchestration
- `state_update`
  - state patch construction and patch application rules
- `gamification`
  - XP and level calculations
- `rng`
  - deterministic RNG and sub-seed derivation
- `logging`
  - structured decision-log and replay-receipt generation

These modules should remain pure and directly unit-testable. Separate crates are not required for MVP.

## 14. Data Model Recommendations

Use versioned nested structs, not a flat map.

Recommended canonical shape:
- `AthleteStateV1`
  - `athleteProfile`
  - `readinessState`
  - `injuryState`
  - `performanceState`
  - `progressionState`
  - `gamificationState`
  - `activeProgramState`
  - `recentCompletions`

Data-structure rules:
- use stable string `id` values as the authoritative engine identifiers
- use slugs only as descriptive metadata where the numbered specs explicitly include them
- prefer deterministic containers such as ordered `Vec` or `BTreeMap`
- bound `recentCompletions` to a small replay-friendly window
- keep app-owned display preferences and raw DB concerns outside canonical state
- do not use generic JSON merge blobs as state patches

`StatePatchV1` should be semantic. Typical patch operations:
- set readiness or fatigue values
- upsert progression record
- advance active program cursor
- append bounded completion summary
- set `adherenceStreak`
- increment XP
- set level when threshold is crossed

Persistence boundary:
- the app may store richer history and UI metadata
- the engine contract only owns normalized state needed for decisions and replay

## 15. Test Strategy Additions

Add fixture categories beyond the current static baseline:
- baseline athlete with a clear recommendation winner
- threshold athlete near fatigue, streak, XP, or progression boundaries
- conflicting-state athlete with injury, fatigue, and class bias present together
- no-solution athlete where all candidates are blocked
- replay athlete with frozen canonical input and seed
- regression athlete requiring `regress` or `swap`

Required test coverage:
- deterministic output with fixed seed
- hard constraint enforcement before soft scoring
- progression state updates after session outcome
- fatigue-aware recommendation changes
- class bias changing scores without violating hard constraints
- XP and level updates
- regress or deload behavior when recovery or trend requires it
- semantic state patch shape and allowed-field boundaries

Required invariants:
- state patch touches only allowed engine-owned fields
- output identifiers must come from input snapshots
- gamification counters are monotonic unless an explicit reset rule is part of the contract
- no decision depends on wall clock, locale, environment variables, or unordered iteration

Do not over-specify:
- exact tuning constants
- UI-facing reward names
- human-readable explanation text equality

## 16. Explicit MVP Deferrals

Deferred from MVP:
- full skill trees
- social systems
- economy or loot
- narrative quest systems
- real-time coaching LLM dependence
- black-box adaptive ML
- overcomplicated physiology modeling
- full achievement catalogs
- auto-inferred archetypes from opaque heuristics
- deep multi-week deload planners
- full-body-composition analytics as primary scoring drivers

Optional metrics explicitly deferred from scoring-critical MVP use:
- BMI
- DOTS or other powerlifting score
- advanced readiness composites
- long-horizon adherence forecasting

## 17. Acceptance Criteria

- The addendum defines `AthleteState` as a canonical engine-facing concept and separates raw inputs, derived metrics, and rolling state.
- `plan_session` and `complete_session` are specified as a first-class closed loop: recommendation, outcome ingestion, state update, next recommendation.
- The MVP input contract includes height, weight, `trainingAge`, goal bias, available days per week, readiness state, injury state, and available lift or performance stats, with age and sex documented as optional unless reliably supported upstream.
- The MVP requires deterministic support for estimated 1RM and workload tolerance or recovery budget class, and documents BMI and DOTS-style metrics as optional.
- The progression model defines previous performance reference, trend direction, completion quality, and deterministic `overload`, `maintain`, `regress`, and `swap` rules.
- The gamification model defines `xp`, `level`, and `classArchetype`, fixes the V1 `gamificationState` bucket to `xp`, `level`, and `adherenceStreak`, and explicitly states that gamification cannot override active safety or fatigue constraints.
- The scoring model explicitly separates hard constraints, soft scoring, and seeded tie-breaking, and includes fatigue or recovery compatibility, injury compatibility, progression need, movement balance, class bias, and controlled novelty.
- The determinism section states that the same canonical input plus the same seed and explicit time inputs must produce the same output, and explains how explicit week or microcycle inputs allow deterministic variation over time.
- The output contract requires semantic state patches for progression, readiness, and gamification updates rather than storage-shaped merge blobs.
- Rust module guidance keeps progression, scoring, adaptation, state update, gamification, and RNG logic pure and independently testable.
- Test strategy additions require coverage for fixed-seed determinism, constraint enforcement, progression updates, fatigue-aware changes, class bias behavior, XP or level updates, and regression or deload behavior.
- The addendum explicitly defers skill trees, social systems, economy or loot, narrative quests, real-time LLM coaching, black-box ML, and overbuilt physiology models.
