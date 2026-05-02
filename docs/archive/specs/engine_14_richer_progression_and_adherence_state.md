# Richer Progression And Adherence State

## Goal

Define the next Wave 3 boundary revision for richer progression, adherence, and gamification state so the engine can own more replayable training-state history without reintroducing projection drift.

## Status

- `State`: Active
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
  - `docs/archive/specs/engine_13_class_definition_and_resolution_boundary.md`

## Problem Statement

Current engine-owned mutable state is intentionally narrow:
- `progressionState`
- `readinessState`
- `gamificationState`

That boundary is stable, but it is still too shallow for the next round of cycle intelligence.

Current limitations:
- progression records do not explicitly model enough durable counters to explain long-running adherence or stall patterns
- gamification state is frozen to `xp`, `level`, and `adherenceStreak`
- `recentCompletions` is retained for replay, but it is not a durable public patch bucket
- app summaries in `users.stats_json` still carry some richer progression language that the engine cannot own or replay directly

The next revision must expand engine-owned meaning while keeping `users.stats_json` as a compatibility surface rather than reviving a second source of truth.

## Boundary Expansion Decision

Wave 3 keeps the top-level engine-owned state buckets unchanged:
- `progressionState`
- `readinessState`
- `gamificationState`

This spec does not introduce a new top-level `adherenceState` or `milestoneState` bucket.

Instead, richer state is added inside the existing engine-owned buckets so:
- replay receipts remain structurally close to the current contract
- compatibility cleanup continues to shrink, not widen, the number of canonical authorities
- future app projections can derive summaries from richer engine-owned state rather than owning parallel counters

## Progression-State Expansion Rules

`progressionState` remains keyed by stable exercise identity and should expand to carry durable per-exercise progression summaries such as:
- latest resolved action and trend
- last successful working load or equivalent prescription anchor
- consecutive successful completions
- consecutive stalls or regressions
- swap recommendation count
- last completed session timestamp or equivalent caller-supplied decision-time provenance

Rules:
- progression records must stay keyed by stable engine-facing identifiers, not DB row ids or array position
- richer counters must be deterministic consequences of canonical input plus outcome classification
- counters must be patchable from `complete_session` without relying on `users.stats_json`
- any derived summaries shown in the app remain app-owned read models assembled from canonical engine-owned state

## Adherence And Gamification Expansion Rules

`gamificationState` should remain the owner of longitudinal adherence and reward state.

Existing owned fields stay canonical:
- `xp`
- `level`
- `adherenceStreak`

New engine-owned additions may include:
- completed-session count
- missed-session count
- last-adherence outcome classification
- last-award timestamp or equivalent caller-supplied provenance
- milestone ledger or milestone progress counters, if they can be represented deterministically without introducing event-only ambiguity

Rules:
- adherence counters must be advanced from normalized cycle/session outcomes, not app-side recomputation
- any milestone representation must remain deterministic and replayable from canonical state plus operation outcome
- user-facing badges, copy, or celebratory presentation remain app-owned derived UI, not engine boundary data

## Replay, Determinism, And Patch Rules

This spec keeps replay and patch constraints strict:
- no wall-clock reads inside the engine
- richer counters must derive only from canonical snapshots, caller-supplied determinism fields, and operation request payloads
- closed-loop replay must still reproduce the same next-state result after applying the semantic state patch

Patch ownership:
- richer progression fields stay inside `statePatch.progressionState`
- richer adherence and reward fields stay inside `statePatch.gamificationState`
- `statePatch.readinessState` remains available for recovery-related updates when needed
- `recentCompletions` remains a replay input bucket and decision-log reference, not a promoted public patch bucket in this wave

This spec does not close the broader event-versus-patch architecture question; it only states that this richer-state revision must work within the current patch-first public boundary.

## App And Compatibility Boundary Rules

`users.stats_json` remains app-owned and compatibility-only for:
- temporary UI summaries not yet migrated
- preferences and display-oriented convenience values
- fallback legacy program state when no normalized active cycle exists

`users.stats_json` must not remain canonical for:
- exercise-level progression counters that the engine can deterministically own
- adherence counters or reward progression once those counters are promoted into `gamificationState`
- normalized-cycle milestone truth once a deterministic milestone ledger exists

App read models may still denormalize richer summaries for convenience, but:
- normalized engine-owned state is authoritative when present
- compatibility projections must be refreshable from normalized state rather than maintained as independent truth

## Boundary And Contract Rules

This spec does not revise the public engine envelope:
- keep `EngineInputV1`
- keep `EngineOutputV1`
- keep public Rust operations `initialize_cycle`, `plan_session`, and `complete_session`

Expected later implementation direction:
- extend typed Rust domain structs for richer nested progression and gamification fields
- update adapter contracts only after the engine-side meaning is settled
- add deterministic fixtures and golden coverage for richer counters, streak behavior, milestone behavior if adopted, and closed-loop replay

## Acceptance Criteria

- The spec keeps top-level public state-patch ownership within `progressionState`, `readinessState`, and `gamificationState`.
- The spec defines which richer progression summaries become engine-owned rather than app-owned.
- The spec defines which adherence and reward counters become engine-owned rather than app-owned.
- The spec explicitly keeps `recentCompletions` out of the public patch surface in this wave.
- The spec keeps `users.stats_json` as a compatibility projection rather than a canonical richer-state model.
- The spec keeps `EngineInputV1`, `EngineOutputV1`, and the current Rust public operations unchanged.
- The spec requires replay-safe, deterministic closed-loop verification for any richer counters added later.

## Deferred Risks And Follow-Up

- Exact numeric representation policy for any future percentage- or score-like counters
- Canonical serialization and hashing rules for richer replay receipts
- Whether milestone history eventually belongs in deterministic events, semantic patches, or both
- Whether any richer adherence signals should later influence public score categories beyond the current closed set

This spec is now the active Wave 3 lane and builds on the completed `docs/archive/specs/engine_13_class_definition_and_resolution_boundary.md`, so richer progression/adherence state is not built on top of ambiguous class semantics.
