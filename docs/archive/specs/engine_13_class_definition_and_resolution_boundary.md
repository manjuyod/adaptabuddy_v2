# Class Definition And Resolution Boundary

## Goal

Define the Wave 3 class-taxonomy boundary so initialized cycles, active-session reads, and future engine progression logic no longer rely on opaque pass-through class strings.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`

## Problem Statement

Wave 3 projection cleanup made normalized cycle tables canonical for active-cycle identity and cursor state, but class handling remains underspecified.

Current remaining ambiguity:
- intake accepts freeform `classChoice`
- `initialize_cycle` currently passes that string through as `resolvedClassArchetype`
- normalized tables persist `class_choice`, `resolved_class_archetype`, and session-level `class_archetype` without a closed taxonomy
- legacy and historical rows may still contain values such as `legacy`
- app readers expose `resolvedClassArchetype` but there is no spec-level precedence or compatibility mapping for historical tokens

This leaves the engine boundary too loose for replayable class-aware planning and for later progression/adherence work that may depend on class semantics.

## Canonical Taxonomy Decision

Wave 3 closes the engine-facing class taxonomy to the currently supported canonical archetypes:
- `strength`
- `hybrid`

Compatibility-only historical token:
- `legacy`

Rules:
- `strength` and `hybrid` are the only canonical engine archetypes in this wave
- `legacy` is not a canonical engine archetype and must not be emitted by new engine results
- introducing additional canonical archetypes is deferred to a later numbered spec rather than handled as an open-ended string expansion

Rationale:
- these are the only values currently evidenced in the repo as live normalized-cycle outputs or compatibility-state inputs
- freezing the canonical set now removes boundary drift without inventing unsupported future categories

## Ownership And Resolution Rules

Engine-owned meaning:
- `resolved_class_archetype` on the active normalized plan is the canonical class identity for an initialized cycle
- denormalized session-level `class_archetype` values for normalized sessions must match the active plan's resolved class archetype
- engine outputs may expose `resolvedClassArchetype`, but only as one of the canonical values above

App-owned meaning:
- raw intake `classChoice` remains an app-edge input concern until it is normalized into the engine-facing request
- legacy fallback reads from `users.stats_json.activeProgram` remain app-owned compatibility behavior
- any display labels, onboarding copy, or UX grouping for classes remain app concerns and must not widen the engine taxonomy by implication

Precedence:
1. active normalized plan `resolved_class_archetype`
2. normalized session `class_archetype` only as a denormalized consistency copy
3. normalized profile `class_choice` as the intake snapshot, not the active-cycle authority
4. legacy compatibility projection only when no normalized active cycle exists

## Compatibility Mapping Policy

Wave 3 locks the compatibility handling for currently observed persisted tokens:
- `strength` -> canonical `strength`
- `hybrid` -> canonical `hybrid`
- `legacy` -> compatibility-only historical token with no canonical engine meaning

Required behavior:
- normalized active-cycle readers may surface `strength` or `hybrid` directly
- normalized active-cycle readers must not treat `legacy` as a valid resolved engine archetype for new work
- if a historical normalized row still contains `legacy`, app readers should treat it as an unresolved historical value rather than inventing a semantic mapping
- new cycle initialization must normalize input before engine invocation so the engine result never persists `legacy` as a resolved class archetype
- manual legacy flows may continue to carry `legacy` only in fallback app-owned state while no normalized cycle exists

This spec intentionally avoids guessing that `legacy` means `strength`, `hybrid`, or any other future archetype.

## Boundary And Contract Rules

This spec does not revise the public engine envelope:
- keep `EngineInputV1`
- keep `EngineOutputV1`
- keep public Rust operations `initialize_cycle`, `plan_session`, and `complete_session`

Wave 3 contract intent:
- tighten class taxonomy and resolution semantics without widening the JSON envelope
- allow app-edge schemas such as `InitializeCycleRequestSchema` to narrow from freeform strings to canonical tokens in follow-on implementation work
- keep `goalBias` separate from class taxonomy; shared string values such as `strength` do not imply that the two fields collapse into one concept

Required implementation direction for later work:
- `packages/contracts` should introduce a closed class archetype schema for cycle-facing flows
- `packages/engine-rs` should reject unsupported class tokens rather than treating them as opaque pass-through data
- `apps/web` should normalize or reject compatibility-only tokens before invoking `initialize_cycle`

## Persistence And Read-Model Rules

Normalized persistence:
- `engine_cycle_profiles.class_choice` stores the intake token captured at initialization time
- `engine_cycle_plans.resolved_class_archetype` stores the canonical resolved archetype for the active cycle
- `engine_cycle_sessions.class_archetype` stores a denormalized copy that must equal the plan's resolved archetype for the same cycle
- `engine_gamification_states.class_archetype` remains a convenience copy and must not outrank the active plan for reads

Compatibility projection:
- `users.stats_json.activeProgram` remains non-authoritative when a normalized active cycle exists
- if compatibility state carries historical class labels, those labels are app-owned fallback metadata only

App-facing read models:
- normalized `ActiveCycleView.resolvedClassArchetype` should expose only canonical resolved values or `null`
- legacy fallback read models may continue to expose `null` for class archetype rather than manufacturing a canonical value from historical state

## Acceptance Criteria

- The spec defines a closed canonical engine-facing class taxonomy for this wave.
- The spec distinguishes canonical engine archetypes from compatibility-only historical tokens.
- The spec defines precedence between intake snapshot, active normalized plan, denormalized session copies, and legacy fallback projection.
- The spec explicitly prevents new normalized cycles from persisting `legacy` as a resolved archetype.
- The spec keeps `EngineInputV1`, `EngineOutputV1`, and the current public Rust operation set unchanged.
- The spec identifies later adapter, engine, and app-edge narrowing work without treating that implementation as part of this spec pass.

## Deferred Follow-Up

- Additional canonical archetypes beyond `strength` and `hybrid`
- User-facing labeling or localization for archetype names
- Any class-aware scoring or progression behavior that depends on richer state modeling

The next numbered spec was `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`, which built on this completed class-resolution boundary before richer progression/adherence state became more engine-owned.
