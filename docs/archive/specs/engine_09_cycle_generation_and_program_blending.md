# Cycle Generation And Program Blending

## Goal

Specify the deterministic Wave 2 rules for turning intake plus weighted programs into an expanded macrocycle.

## Status

- `State`: Active
- `Priority`: High

## Core Rules

1. Sort selected programs by descending weight, then stable `programId`.
2. Resolve the first program as primary unless a later numbered spec replaces that heuristic.
3. Use `availableDaysPerWeek` and `macrocycleWeeks` to materialize the entire session schedule up front.
4. Preserve primary-program main slots by default.
5. Use secondary-program slots as bounded accessories only.
6. Remove secondary accessories when they target injured muscle groups.
7. Cap secondary accessories further when fatigue preference is low.

## Program Blend Output

`programBlend[]` must be explicit and ordered.

Each entry must include:
- `programId`
- `weight`
- `role`

Wave 2 role rules:
- top weighted program => `primary`
- remaining programs => `secondary`

## Macrocycle Expansion

Wave 2 materializes the full cycle immediately rather than lazily generating one week at a time.

Required indices:
- `macroWeek`
- `mesocycleIndex`
- `microcycleIndex`
- `sessionIndex`
- `plannedDayOfWeek`

Required guarantees:
- `sessionIndex` is contiguous and unique within a plan
- session ordering is deterministic
- session payloads only reference slots present in the normalized reference snapshot

## Class Resolution

Wave 2 class resolution is deterministic and intake-driven.

Inputs:
- `classChoice`
- `goalBias`
- selected program mix

The resolved class is allowed to match the explicit class choice when no narrower heuristic overrides it.

## Acceptance Criteria

- The engine produces the same blend and session ordering for identical input.
- Injury-aware filtering removes disallowed secondary accessory work.
- Low-fatigue inputs reduce accessory expansion.
- Rust tests cover replay stability, injury filtering, fatigue caps, and macrocycle shape.
