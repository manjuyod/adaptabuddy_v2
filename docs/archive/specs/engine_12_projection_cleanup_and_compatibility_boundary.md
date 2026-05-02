# Projection Cleanup And Compatibility Boundary

## Goal

Define the first Wave 3 boundary-reduction step: normalized engine-owned cycle state becomes the canonical source for active cycle identity and cursor state, while `users.stats_json` is narrowed to a compatibility surface for the current app shell only.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_10_engine_state_persistence_and_projection.md`
  - `docs/archive/specs/engine_11_app_integration_and_rollout.md`

## Completion Note

This spec is complete and now serves as the Wave 3 compatibility-boundary reference. The normalized engine-owned cycle tables are canonical for initialized-cycle identity, active cursor state, and gamification, and `users.stats_json.activeProgram` is compatibility-only once a normalized cycle exists.

## Problem Statement

Wave 2 successfully split engine-owned cycle state into normalized tables, but the app still keeps a second source of truth in `users.stats_json.activeProgram`.

Current remaining coupling:
- cycle initialize writes a compatibility projection into `users.stats_json`
- session completion recalculates and rewrites `currentDayIndex` and `currentMicrocycle`
- app readers such as dashboard, workout, and program helpers still treat `stats_json.activeProgram` as live cycle state
- manual program activation and onboarding still seed `stats_json.activeProgram` directly

This dual ownership is now the main source of boundary drift between the Rust engine lane and the product shell.

## Canonical Ownership Decision

Normalized engine-owned tables are the source of truth for active cycle state once a cycle has been initialized:
- `engine_cycle_profiles`
- `engine_cycle_program_mix`
- `engine_cycle_plans`
- `engine_cycle_sessions`
- `engine_gamification_states`

Canonical ownership rules:
- active cycle identity comes from the active normalized plan and its linked profile, not from `users.stats_json`
- active session cursor and microcycle progression come from normalized plan and session rows, not from `users.stats_json.activeProgram`
- resolved class archetype for an initialized cycle comes from `engine_cycle_plans.resolved_class_archetype`; `engine_cycle_profiles.resolved_class_archetype` is retained only as an unused historical column and other copies are denormalized convenience only
- engine-owned gamification counters come from normalized gamification state, not from app-side recomputation or summary projection

`users.stats_json` remains app-owned for:
- preferences and opt-ins
- app-managed fatigue, mastery, capacity, and progression summaries that are not yet normalized engine-owned state
- temporary compatibility fields still needed by the current UI shell during rollout

`users.stats_json` must not remain canonical for:
- active cycle cursor
- current microcycle position
- expanded session sequence
- program blend composition
- engine-owned gamification counters
- resolved class archetype for an active normalized cycle

## Compatibility Projection Policy

`users.stats_json.activeProgram` remains in place during Wave 3 as a temporary compatibility field, but it is no longer authoritative once a normalized active cycle exists.

Rules:
- readers must prefer normalized active cycle state first
- readers may fall back to `users.stats_json.activeProgram` only when no active normalized cycle exists
- writers must stop treating `stats_json.activeProgram.currentDayIndex` and `currentMicrocycle` as durable state that needs to stay synchronized after every completion
- compatibility projection may continue to preserve enough information for legacy fallback and non-cycle flows, but any cursor-like values are derived convenience only and must be ignored when normalized state is present

Allowed compatibility meaning by state:
- no normalized active cycle:
  - `activeProgram` may continue to support legacy manual activation and onboarding flows
- normalized active cycle exists:
  - `activeProgram` is compatibility-only and must not drive cycle selection, day resolution, or microcycle advancement

## Normalized-First Read Model

Wave 3 introduces a normalized app read model for the current active cycle. This is an app-assembled read model, not a Rust boundary change.

The normalized-first reader should return an app-owned `ActiveCycleView` rather than reusing `users.stats_json.activeProgram` as its contract.

Authoritative normalized fields:
- active cycle identity:
  - `engine_cycle_plans.id`
  - `engine_cycle_plans.primary_program_id`
  - `engine_cycle_plans.profile_id`
  - `engine_cycle_plans.resolved_class_archetype`
- active cursor:
  - `engine_cycle_plans.current_session_index`
  - `engine_cycle_sessions` row where `plan_id = active plan id` and `session_index = current_session_index`
- app-facing day and microcycle values:
  - `currentDayIndex = engine_cycle_sessions.planned_day_of_week` for the active session row
  - `currentMicrocycle = engine_cycle_sessions.microcycle_index + 1` for the active session row
  - `daysPerWeek = engine_cycle_profiles.available_days_per_week`
- display start metadata:
  - `startedAt = engine_cycle_plans.created_at`

Required derivation rules:
- readers must load the active plan first using `engine_cycle_plans.is_active = true`
- readers must then load the current session row by `current_session_index`
- if an active plan exists and the current session row exists, the session row is authoritative for day-of-week and microcycle display
- if an active plan exists and no current session row exists, the cycle is at terminal cursor state and the app must treat the normalized plan as authoritative rather than falling back to `stats_json.activeProgram`
- `users.stats_json.activeProgram` is only a fallback when no active normalized plan exists at all

Required `ActiveCycleView` behavior:
- active normalized session exists:
  - return status `active`
  - populate `programId`, `startedAt`, `daysPerWeek`, `currentDayIndex`, and `currentMicrocycle` from normalized state
- active normalized plan exists but no current session row exists:
  - return status `completed`
  - populate `programId`, `startedAt`, and `daysPerWeek` from normalized state
  - set `currentDayIndex` and `currentMicrocycle` to `null`
  - session-generation consumers must treat this as no active generatable session and must not synthesize cursor values from stale projection data
- no normalized active plan exists:
  - fall back to the legacy `stats_json.activeProgram` flow if present

Wave 3 implementation target for app reads:
- dashboard and workout surfaces should resolve active cycle identity, current day, and current microcycle from normalized state
- `getUserActiveProgram` must stop being a raw `stats_json` read for normalized-cycle users

Wave 3 implementation target for app writes:
- initialize may still seed compatibility projection while fallback consumers remain
- completion may continue updating app-owned summary buckets in `users.stats_json`, but it must not treat compatibility-projection cursor fields as authoritative state
- completion must derive any compatibility refresh from normalized state without introducing a second source of truth
- manual activation and onboarding may continue writing legacy `activeProgram` for pre-cycle flows, but that field must yield to normalized state after cycle initialization

## App Read/Write Responsibilities

`apps/web` remains responsible for:
- authenticated reads and writes
- RLS-compatible access patterns
- assembling app-facing read models from normalized engine-owned tables plus reference tables
- deriving compatibility projection fields where they are still temporarily required

Wave 3 reader migration scope:
- `apps/web/src/modules/programs/service.ts`
- `apps/web/app/(game)/dashboard/page.tsx`
- `apps/web/app/(game)/workout/page.tsx`
- any helper or client component that assumes `stats_json.activeProgram.currentDayIndex` or `currentMicrocycle` is authoritative

Wave 3 writer migration scope:
- `apps/web/src/modules/cycles/service.ts`
- `apps/web/src/modules/sessions/service.ts`
- `apps/web/src/modules/programs/actions.ts`
- `apps/web/src/modules/onboarding/actions.ts`

## Interface And Contract Rules

This spec does not revise the public Rust engine envelope:
- keep `EngineInputV1`
- keep `EngineOutputV1`
- keep the current Rust public operations `initialize_cycle`, `plan_session`, and `complete_session`

This spec also does not widen the Rust public `statePatch`:
- keep semantic patch ownership limited to engine-owned buckets already established by Wave 2
- do not add compatibility-projection fields to Rust output
- do not push app summary or storage-shape concerns into the engine boundary

Current runtime integration note:
- `packages/engine-rs` exposes `initialize_cycle`, `plan_session`, and `complete_session` at the crate boundary
- the current app runtime directly invokes Rust for `initialize_cycle`
- session generation and completion in `apps/web` still use mixed integration with legacy TypeScript logic plus normalized cycle persistence
- Wave 3 projection cleanup is intended to remove boundary drift before any broader runtime migration of `plan_session` or `complete_session`

Adapter and app-contract guidance:
- `packages/contracts/src/stats.ts` may continue to expose `activeProgram` temporarily for compatibility
- that field should now be documented and treated as a compatibility read model rather than canonical cycle state
- the normalized-first app reader should introduce a separate app-facing `ActiveCycleView` contract with terminal-state support rather than forcing terminal state through the legacy `ActiveProgram` shape
- removing or narrowing `activeProgram` from shared app contracts is deferred until normalized readers fully replace the remaining projection consumers

## Acceptance Criteria

- A new normalized-first app read path is defined for active cycle identity, current day, and current microcycle.
- The spec explicitly states that normalized engine-owned tables are canonical for initialized cycle state.
- The spec explicitly states that `users.stats_json.activeProgram` is compatibility-only when normalized state exists.
- Completion no longer requires app-owned cursor math to be treated as authoritative state.
- Dashboard and workout migration targets are identified as normalized-first readers.
- Manual activation and onboarding are explicitly documented as pre-cycle or fallback writers rather than long-term cycle authorities.
- The spec keeps `EngineInputV1` and `EngineOutputV1` unchanged.
- The spec keeps the Rust crate implementation lane deferred until boundary ownership is cleaned up.

## Deferred Follow-Up

The next Wave 3 spec after this one should address explicit class taxonomy and class-resolution rules in the Rust boundary rather than continuing to pass through opaque strings.

The following Wave 3 spec should then address richer progression and adherence modeling once projection ownership is no longer ambiguous.
