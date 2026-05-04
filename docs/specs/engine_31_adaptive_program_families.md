# Engine 31: Adaptive Program Families

## Status

- State: Implemented
- Scope: `initialize_cycle`
- Follows: Engine 30 headless game loop design

## Decision

Slotless challenge and hypertrophy-engine programs are adaptive program families, not broken static templates. The app may persist and catalog their metadata, but deterministic schedule expansion belongs in Rust because it changes workout output and replay material.

## Boundary Additions

`initialize_cycle.request` may include:

- `programAdaptationInputs.challengeBaselines[exerciseSlug].maxReps`
- `selectedPrograms[].templateKind`
  - `slot_based`
  - `challenge_progression`
  - `hypertrophy_engine_v1`
- `selectedPrograms[].adaptiveTemplate`, copied from `programs.metadata.source_template_json`

Adaptive programs are fixed at `profile.availableDaysPerWeek = 3`.

## Family Behavior

### `slot_based`

Preserves existing behavior. Static `program_days` and `program_slots` remain required.

### `challenge_progression`

Requires a baseline for the selected exercise slug. The engine chooses the group from `initial_test_groups`, then expands the selected group into deterministic week/day sessions. Each challenge set becomes one slot with:

- `setsMin = setsMax = 1`
- exact `repsMin` / `repsMax`
- `lockedExerciseId`
- structured `prescription` including group, set type, rest, week, day, and baseline

### `hypertrophy_engine_v1`

Expands the three metadata sessions into deterministic session templates. Pool-backed slots keep their movement pattern, set/repetition ranges, target muscles, tags, and family prescription metadata.

## App Responsibilities

- Include valid adaptive templates in the catalog even when they have no static slots.
- Reject incomplete adaptive metadata before invoking the engine.
- Collect max-rep baselines for selected challenge programs.
- Pass replayable baseline inputs and adaptive template metadata into Rust.
- Keep static slot validation unchanged for ordinary slot-based programs.

## DB Repair

Migration `022_adaptive_program_template_repair.sql` normalizes the four active adaptive programs as fixed 3-day templates and installs `public.program_template_integrity_check()` for release-gate validation.

The expected release-gate result is zero rows for invalid active static programs and zero rows for invalid active adaptive programs.
