# Engine Spec 02: Snapshot Normalization

## Status

- `State`: Complete
- `Priority`: Done

## Goal

Lock the normalization rules that turn app-owned data into canonical engine-facing snapshots before any deterministic engine logic runs.

This spec is the normalization companion to `engine_01`. It keeps the public envelope at `EngineInputV1` and `EngineOutputV1`, folds in the stateful progression and gamification addendum as normative input, and freezes what belongs in each snapshot versus what must stay app-side.

## Dependencies

- `specs/engine_01_boundary_contracts.md`
- `specs/engine_addendum_stateful_progression_gamification.md`
- `docs/architecture/engine_first_architecture.md`
- `packages/engine-rs/src/lib.rs`
- `packages/engine-rs/src/boundary.rs`
- `packages/engine-rs/src/domain/*`

## Out of Scope

- DB schema design
- Supabase read/write orchestration
- New public API envelopes beyond `EngineInputV1` / `EngineOutputV1`
- Scoring formulas, candidate ranking rules, or final replay hashing algorithm selection
- UI, transport, auth, or persistence implementation details

## Closed Decisions

### 1. Envelope and ownership stay unchanged

- The public engine request envelope remains `EngineInputV1` with:
  - `schemaVersion`
  - `operation`
  - `determinism`
  - `referenceSnapshot`
  - `stateSnapshot`
  - `policySnapshot`
  - `request`
  - `metadata`
- `apps/web` owns normalization, unit conversion, identifier sanitation, bounded-history truncation, ordering, and assembly of canonical engine inputs.
- The engine owns only deterministic parsing and decision logic after normalization.
- No app persistence row, joined DB record, transport wrapper, or `users.stats_json` blob is allowed to cross the boundary as-is.

### 2. Normalization is a lossy app-to-engine projection

Normalization must produce a new engine-facing document, not forward app persistence shapes unchanged.

Required normalization stages:

1. Read app-owned persistence and request data.
2. Drop auth, transport, UI, and storage-only fields.
3. Convert quantities into canonical engine units.
4. Normalize timestamps into explicit UTC RFC3339 strings.
5. Bound history to the replay-relevant window defined by this spec.
6. Sort or key collections according to the deterministic ordering rules below.
7. Materialize the final `EngineInputV1` object.

Rule:
- If a field is not needed to decide the operation or replay it offline, it does not belong in the normalized snapshots.

### 3. Stable identifier and slug policy

- Every engine-addressable entity must have a stable string `id`.
- `id` is the canonical foreign key at the engine boundary. Engine logic keys on `id`, not on display labels.
- `id` values are compared byte-for-byte after normalization. The engine must not trim, case-fold, locale-normalize, or reinterpret them.
- `id` values must be non-empty, unique within their collection scope, and stable across replay.
- Boundary producers should use lowercase ASCII kebab-case IDs for new engine-owned identifiers, but normalization must treat already-published IDs as opaque stable strings rather than rewriting them.
- `slug` is a human-readable stable label used only where the boundary explicitly includes it.
- In `referenceSnapshot`, `slug` is required for `exercises[]` and `programs[]`, must be lowercase ASCII kebab-case, and must be unique within its collection.
- Slugs are never the authoritative join key for replay or state mutation. They are descriptive reference metadata only.

### 4. Canonical unit policy

The app shell owns all unit conversion before engine invocation.

Canonical units for the current MVP:

- athlete height: centimeters
- athlete bodyweight: kilograms
- external load and performance weights: kilograms
- reps, days, indices, streak counts, XP, level, and counters: non-negative integers
- RPE: integer `1..10` when present
- RIR: integer `0..10` when present
- thresholds and scoring weights in `policySnapshot`: JSON numbers carried exactly as provided by the caller

Rules:

- The engine must not interpret mixed-unit payloads.
- If the app stores pounds, inches, or richer local display units, conversion happens before snapshot assembly.
- If a new physical quantity crosses the boundary later, its canonical unit must be specified in a future spec revision before use.

### 5. Timestamp and effective-time policy

- All engine-facing timestamps are caller-supplied explicit UTC instants in RFC3339 form and must end with `Z`.
- The engine must never read system time, local timezone, locale, or environment state.
- `determinism.effectiveAt` is the authoritative decision-time input for the operation.
- `request.session.startedAt`, `request.session.completedAt`, and `stateSnapshot.recentCompletions[].completedAt` use the same UTC RFC3339 policy.
- Offset timestamps such as `-07:00` must be converted to UTC before crossing the boundary.
- The app owns any wall-clock interpretation such as local-day grouping or time-zone display.

Additional normalization rule:

- For `complete_session`, `completedAt` must be greater than or equal to `startedAt` before the request is considered canonical.

### 6. Deterministic ordering: arrays versus ordered maps

Use arrays when sequence is semantically meaningful or when the public MVP envelope already exposes an array.

Use ordered maps when lookup by stable key matters more than presentation order.

Array rules:

- `referenceSnapshot.exercises` and `referenceSnapshot.programs` are arrays sorted by `id` ascending after normalization.
- `progressionState.records` is an array sorted by `exerciseId` ascending, with exactly one record per `exerciseId`.
- `recentCompletions` remains a flat array in `stateSnapshot` for MVP compatibility, but it represents bounded per-exercise completion buckets. Normalization must:
  1. partition entries by `exerciseId`
  2. within each `exerciseId` bucket, sort by `completedAt` descending so the later UTC instant is treated as more recent, then by normalized `quality` token lexicographically ascending
  3. keep the first three entries from each sorted per-exercise bucket
  4. re-sort the retained entries into the final canonical array by `exerciseId` ascending, `completedAt` ascending, then normalized `quality` token lexicographically ascending
- The final canonical array order after truncation is the order used for hashing and replay comparison.
- `request.session.exercises` remains an array because performed slot order may matter to downstream interpretation. `slotId` must still be present and unique within the session.
- `request.session.exercises[].sets` remains an array and must be sorted by `setIndex` ascending with unique `setIndex` values per exercise.

Ordered-map rules:

- `readinessState.muscleFatigue` is an ordered map keyed by stable bucket ID.
- `performanceState.knownLifts` is an ordered map keyed by exercise `id`.
- Any future keyed collection that is semantically a lookup table rather than a sequence should use lexicographically ordered keys for canonicalization.
- Implementations may materialize ordered maps internally as `BTreeMap` or an equivalent deterministic keyed container.

Normalization rule:

- Collections that are not semantically ordered must be normalized into deterministic key order before hashing or replay comparisons.

### 7. `referenceSnapshot` is canonical reference data only

`referenceSnapshot` owns curated reference entities that are stable across many decisions. It is not a DB export.

Normalized MVP shape:

- `referenceVersion`: semantic reference bundle version string
- `exercises[]`
  - `id`
  - `slug`
  - `name`
  - `movementPattern`
  - `equipment[]`
  - `tags[]`
- `programs[]`
  - `id`
  - `slug`
  - `name`
  - `daysPerWeek`

Rules:

- `equipment[]` and `tags[]` are descriptive arrays. Their order is not semantically meaningful, so normalization should deduplicate and sort them lexicographically.
- Duplicate exercise IDs, duplicate exercise slugs, duplicate program IDs, or duplicate program slugs are invalid.
- Broader reference domains mentioned in architecture docs, such as blocks or muscle maps, remain deferred and do not implicitly become part of `EngineInputV1`.

### 8. `stateSnapshot` is the normalized mutable athlete state

The addendum is normative here. `stateSnapshot` explicitly includes the following buckets:

1. athlete/profile
2. readiness
3. injury
4. performance
5. progression
6. gamification
7. active-program
8. bounded recent-completion buckets

For MVP envelope compatibility, those buckets are carried as:

- `athleteProfile`
- `readinessState`
- `injuryState`
- `performanceState`
- `progressionState`
- `gamificationState`
- `activeProgramState`
- `recentCompletions`

For V1, bounded recent-completion summaries live only in top-level `stateSnapshot.recentCompletions`. The addendum's broader wording about bounded recent completion summaries under `performanceState` is superseded for V1 normalization and remains deferred unless a future boundary revision adds a separate performance-owned summary field.

#### `athleteProfile`

Required normalized fields:

- `height`
- `weight`
- `trainingAge`
- `goalBias`
- `availableDaysPerWeek`
- `classArchetype`

Decisions:

- `trainingAge` is the canonical V1 experience field. The addendum's `experienceLevel` alternative is deferred until a later boundary revision.
- Addendum-optional fields such as `age` and `sex` are not part of normalized V1 state because the current MVP boundary does not model them consistently.
- `goalBias` and `classArchetype` are stable string classifiers and must already be normalized before crossing the boundary.

#### `readinessState`

Required normalized fields:

- `systemicFatigue`
- `muscleFatigue`

Decisions:

- `systemicFatigue` is a bounded categorical enum, not free text.
- `muscleFatigue` is a keyed deterministic map from stable muscle or movement-bucket ID to non-negative integer fatigue points.
- The app may store richer recovery notes, questionnaire answers, or wearable inputs, but only the normalized readiness summary crosses the boundary.

#### `injuryState`

Required normalized fields:

- `activeLimitations`
- `blockedMovementPatterns`

Decisions:

- These arrays contain stable string classifiers only.
- Normalization deduplicates and sorts them lexicographically because the engine treats them as constraint sets.
- Rich clinical notes, UI labels, and medical provenance remain app-side.

#### `performanceState`

Required normalized field:

- `knownLifts`

Each `knownLifts[exerciseId]` entry contains:

- `estimated1RM`
- `lastWeight`
- `lastReps`

Decisions:

- `knownLifts` keys are exercise IDs, not slugs and not DB primary keys.
- `estimated1RM` is allowed in the snapshot because it is materially decision-relevant, but it must already be consistent with the current `ruleVersion` if supplied.
- Full workout history does not belong here. Only the compact capacity summary needed for planning belongs in `performanceState`.
- V1 does not place bounded recent completion summaries inside `performanceState`; that history lives only in top-level `recentCompletions`.

#### `progressionState`

Required normalized field:

- `records`

Each record contains:

- `exerciseId`
- `previousPerformanceReference`
  - `weight`
  - `reps`
- `trend`
- `currentAction`

Decisions:

- There must be at most one progression record per `exerciseId`.
- `records` is sorted by `exerciseId`.
- Trend and action values are normalized enums, not app-specific prose.
- Higher-order counters suggested by the addendum, such as repeated-regression counts, are deferred until a later revision because the current boundary does not model them yet.

#### `gamificationState`

Required normalized fields:

- `xp`
- `level`
- `adherenceStreak`

Decisions:

- The addendum's gamification input is normative, but V1 freezes the bucket to these three counters.
- Class/archetype preference remains in `athleteProfile.classArchetype`; it is not duplicated here.
- Rich milestone ledgers or social reward state remain outside `EngineInputV1` until a future revision explicitly adds them.

#### `activeProgramState`

Required normalized fields:

- `programId`
- `currentDayIndex`
- `currentMicrocycle`

Decisions:

- `programId` must reference an existing `referenceSnapshot.programs[].id`.
- Day and microcycle indices are non-negative integers.
- For `plan_session`, these fields define the active program cursor that the duplicated request fields must match exactly.
- Program persistence metadata, template lineage, and app scheduling UI state stay app-side.

#### `recentCompletions`

This bucket is the MVP representation of bounded recent-completion history.

Each entry contains:

- `exerciseId`
- `completedAt`
- `quality`

Decisions:

- `recentCompletions` is a bounded replay bucket, not full history.
- Normalization keeps only the most recent three entries per `exerciseId`, where "most recent" means the later `completedAt` instant after UTC normalization.
- Truncation happens before the final canonical array sort described in Section 6.
- The final hashed and replayed array order is `exerciseId` ascending, `completedAt` ascending, then normalized `quality` token lexicographically ascending.
- Older completion history remains app-owned persistence and must not be required for replay of the next decision.
- `quality` is a normalized enum. Free-text coaching notes do not belong in this bucket.

### 9. `policySnapshot` is deterministic behavior policy only

Normalized MVP shape:

- `noveltyBudget`
- `classArchetypeBias`
- `fatigueBlockThreshold`
- `seededTieBreakBand`

Rules:

- `policySnapshot` contains thresholds and tunable weights that can change deterministic behavior.
- Transport flags, rollout metadata, UI copy, and non-deterministic experiment labels are excluded.
- The current MVP does not add a `policyVersion` field to `policySnapshot`. The replay receipt `policyVersion` remains implementation-owned metadata until a later spec revision decides whether policy versioning becomes a public input field.

### 10. `request` stays operation-specific but must be canonicalized

`request` remains the operation-specific JSON payload within `EngineInputV1`, but normalization rules are now frozen for the current MVP operations.

#### `plan_session`

Normalized request shape:

- `programId`
- `sessionFocus`
- `microcycleIndex`

Rules:

- Unknown request fields are invalid.
- `programId` is a stable program ID, not a slug and not a DB row ID.
- `sessionFocus` is a normalized stable string classifier.
- `microcycleIndex` is an explicit non-negative integer. The engine must not infer cycle position from wall clock time.
- `request.programId` must equal `stateSnapshot.activeProgramState.programId`.
- `request.microcycleIndex` must equal `stateSnapshot.activeProgramState.currentMicrocycle`. In V1 these two field names refer to the same zero-based microcycle counter.
- A `plan_session` mismatch between request and `activeProgramState` is invalid canonical input and must be rejected before deterministic engine execution. No source-precedence fallback is allowed.

#### `complete_session`

Normalized request shape:

- `session`
  - `programDayId`
  - `seed`
  - `startedAt`
  - `completedAt`
  - `exercises[]`
    - `slotId`
    - `exerciseId`
    - `sets[]`
      - `setIndex`
      - `weight`
      - `reps`
      - `rir`
      - `notes`
  - `overallRpe`
  - `notes`

Rules:

- Unknown request fields are invalid.
- `programDayId`, `slotId`, and `exerciseId` are stable string IDs.
- `session.seed` is a duplicated provenance copy of top-level `determinism.seed` kept for MVP envelope compatibility, not an independent sub-seed.
- `session.seed` must equal top-level `determinism.seed`. Any mismatch is invalid canonical input and must be rejected before deterministic engine execution.
- `weight` uses canonical kilograms.
- `overallRpe` is nullable but, when present, must be an integer in `1..10`.
- `rir` is nullable but, when present, must be an integer in `0..10`.
- `notes` fields are allowed because the current MVP boundary already accepts them, but they are non-decision data. They must not affect deterministic behavior and are excluded from authoritative replay hash inputs.

### 11. `metadata` is trace-only and non-authoritative

Rules:

- `metadata` exists only for correlation, tracing, or orchestration context.
- `metadata` must not affect candidate generation, scoring, tie-breaking, state updates, or deterministic rejections.
- Producers should emit `metadata` as a JSON object of trace fields, even though the MVP envelope still treats it as an opaque JSON value.
- `metadata` is excluded from authoritative replay hash input because it must not change outcomes.

### 12. Versioning and replay-hash expectations are fixed at the field-set level

`determinism` field ownership:

- `seed`: deterministic randomness source
- `effectiveAt`: authoritative explicit time input
- `ruleVersion`: identifies the decision-rule family expected by the caller
- `referenceHash`: canonical hash of the normalized `referenceSnapshot`
- `canonicalizationVersion`: identifies the normalization rules used to assemble the input

Closed expectations:

- `canonicalizationVersion` must change whenever normalization rules change in a way that could alter replay, including unit policy, ordering policy, identifier policy, bounded-history rules, or timestamp normalization.
- `referenceSnapshot.referenceVersion` is a semantic bundle version. `determinism.referenceHash` is the canonical content identity used for replay. They serve different purposes and both may coexist.
- `determinism.referenceHash` must be validated against the already-normalized `referenceSnapshot` using the implementation-stable canonical serialization and hash pair in force for the current environment. A mismatch is a canonicalization failure and must be rejected before deterministic engine execution. It is not log-only.
- `replayReceipt.inputHash` is expected to cover the outcome-relevant canonicalized input material:
  - `schemaVersion`
  - `operation`
  - `determinism`
  - `referenceSnapshot`
  - `stateSnapshot`
  - `policySnapshot`
  - `request`
- `replayReceipt.inputHash` excludes:
  - `metadata`
  - request free-text fields that this spec marks as non-decision data, currently `request.session.notes` and `request.session.exercises[].sets[].notes`
- `replayReceipt.outputHash` is expected to cover the canonicalized public output material excluding the replay receipt fields themselves.
- `replayReceipt.referenceHash` must equal the input `determinism.referenceHash`.

Explicitly unresolved but bounded:

- This spec does not freeze the canonical byte serialization or the final hash algorithm. Those remain open architecture items and must be closed before claiming cross-language replay stability.
- Until hashing and serialization are finalized, replay hash strings are implementation-stable evidence, not a guarantee of cross-language compatibility.

### 13. Separation from app persistence is now explicit

The following stay app-owned and must not define the engine boundary:

- auth/session ownership data
- route or transport wrappers
- Supabase row shapes and numeric primary keys
- `users.stats_json`
- theme or display preferences
- rich workout history beyond the bounded recent-completion bucket
- UI-facing notes, labels, reward presentation state, or storage bookkeeping

The app may persist richer structures than the engine sees.

The engine sees only:

- the normalized snapshots defined above
- the operation request
- determinism/version metadata needed for replay

## Acceptance Criteria Check

- `referenceSnapshot`, `stateSnapshot`, `policySnapshot`, `request`, and `metadata` now have fixed normalization roles.
- `stateSnapshot` explicitly includes athlete/profile, readiness, injury, performance, progression, gamification, active-program, and bounded recent-completion buckets.
- Stable ID policy, slug policy, canonical units, timestamp rules, deterministic ordering, and replay-hash field expectations are now closed for MVP input normalization.
- Duplicated `plan_session` program or microcycle fields, `determinism.referenceHash` validation, and `recentCompletions` placement and truncation order are now explicit and deterministic.
- The public envelope remains `EngineInputV1` / `EngineOutputV1`.
- App persistence shapes are explicitly separated from engine-facing snapshots.

## Remaining Open Items

- Exact canonical serialization format for replay hashing
- Final hash algorithm contract for cross-language replay receipts
- Cross-language numeric precision policy for future non-integer scoring/math fields
