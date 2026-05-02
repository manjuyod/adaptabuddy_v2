# Engine State Persistence And Projection

## Goal

Define the Wave 2 persistence split between normalized engine-owned cycle state and the shrinking app-owned compatibility projection.

## Status

- `State`: Next
- `Priority`: High

## Supersession Note

This archived Wave 2 spec is superseded by `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`. The completed Wave 3 boundary makes normalized engine-owned tables canonical for initialized-cycle identity, cursor state, and gamification, with `users.stats_json.activeProgram` retained only as compatibility.

## Engine-Owned Tables

Wave 2 normalized tables:
- `engine_cycle_profiles`
- `engine_cycle_program_mix`
- `engine_cycle_plans`
- `engine_cycle_sessions`
- `engine_gamification_states`

Ownership rules:
- these tables persist engine-owned cycle and gamification state
- they are app-written but engine-shaped
- they are the source of truth for active initialized cycle state

## Compatibility Projection

`users.stats_json` remains:
- app-owned
- minimal
- compatible with current UI shell

`users.stats_json` must not remain the canonical source for:
- active macrocycle structure
- expanded cycle sessions
- program blend weights
- gamification counters once normalized state exists

Wave 2 projection minimum:
- current `activeProgram` information needed by the existing shell

## Read/Write Responsibilities

`apps/web` owns:
- authenticated writes
- RLS-compatible reads
- engine input snapshot assembly from reference tables
- projection refresh after engine-owned state changes

Reference tables still read from Supabase:
- `programs`
- `program_days`
- `program_slots`
- `exercises`
- `exercise_muscle_map`
- `muscle_groups`

## Acceptance Criteria

- The initialized cycle is persisted outside `users.stats_json`.
- Session generation can read the active normalized cycle session.
- Completion sync can advance normalized session cursor and gamification state.
- Projection updates stay narrow and compatible.
