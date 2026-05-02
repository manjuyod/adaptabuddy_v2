# Initialize Cycle Boundary

## Goal

Define the closed Wave 2 engine contract for questionnaire-style cycle intake and the new `initialize_cycle` public operation.

## Status

- `State`: Active
- `Priority`: High

## Scope

In scope:
- request shape for intake-driven cycle initialization
- deterministic output shape for class resolution, program blend, macrocycle expansion, and initial gamification state
- validation and replay invariants for `initialize_cycle`

Out of scope:
- storage schema details
- UI flow details
- rich long-horizon progression beyond the initial cycle seed

## Input Contract

`initialize_cycle` lives under `EngineInputV1` and keeps the existing envelope fields:
- `schemaVersion`
- `operation = initialize_cycle`
- `determinism`
- `referenceSnapshot`
- `stateSnapshot`
- `policySnapshot`
- `request`
- `metadata`

Wave 2 request fields:
- `profile.classChoice`
- `profile.goalBias`
- `profile.availableDaysPerWeek`
- `profile.fatiguePreference`
- `profile.injuryMuscleGroupSlugs`
- `macrocycleWeeks`
- `selectedPrograms[]`

Each `selectedPrograms[]` entry must include:
- `programId`
- `weight`
- ordered `days[]`

Each program day must include:
- `programDayId`
- `dayIndex`
- `name`
- ordered `slots[]`

Each slot must include:
- `slotId`
- `slotIndex`
- `slotType`
- `setsMin`
- `setsMax`
- `repsMin`
- `repsMax`
- `movementPattern` optional
- `muscleTargets`
- `tagsRequired`

## Output Contract

`result` must include:
- `resolvedClassArchetype`
- `primaryProgramId`
- `programBlend[]`
- `macrocycle`
- `initialGamificationState`

`macrocycle` must include:
- `totalWeeks`
- `mesocycleCount`
- `currentMesocycleIndex`
- `currentMicrocycleIndex`
- `currentSessionIndex`
- `sessions[]`

Each expanded session must include:
- `sessionId`
- `programId`
- `programDayId`
- `programDayName`
- `macroWeek`
- `mesocycleIndex`
- `microcycleIndex`
- `sessionIndex`
- `plannedDayOfWeek`
- `classArchetype`
- `slotPayload[]`

`statePatch` must remain semantic and engine-owned. It may summarize initialized cycle, active program cursor, and gamification state, but it must not be storage-shaped.

## Determinism Rules

- Identical canonical input plus identical determinism metadata must produce identical output and replay receipt.
- Program ordering must be canonicalized before blend selection.
- Input validation must reject empty `selectedPrograms`.
- The engine must not inspect wall clock time or persistence state.

## Acceptance Criteria

- `initialize_cycle` is supported by the public Rust boundary.
- Invalid intake payloads fail as `EngineError::InvalidInput`.
- Replay receipts stay stable across repeated identical runs.
- The output contains a fully expanded macrocycle session list.
