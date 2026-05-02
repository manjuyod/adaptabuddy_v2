# Engine 14 Class Preset Addendum

## Goal

Add a user-facing class preset layer for initialized cycles without widening the canonical engine class taxonomy beyond the existing `strength` and `hybrid` archetypes.

## Decision

This addendum introduces a class preset catalog with the following ids:
- `classless`
- `bb`
- `powa`
- `ninja`
- `monk`

The preset is the user-facing selection and is persisted on normalized cycle state as `class_preset_id`.

The coarse engine-facing archetype remains unchanged in this pass:
- `strength`
- `hybrid`

Preset-to-archetype mapping for the current implementation:
- `classless` -> `hybrid`
- `bb` -> `hybrid`
- `powa` -> `strength`
- `ninja` -> `hybrid`
- `monk` -> `hybrid`

## Boundary Rules

- Preset semantics are authoritative in app and engine-adapter code, not in database JSON config.
- The `classes` table is a stable catalog for ids, labels, descriptions, selectability, status, and transitional base-archetype mapping.
- `engine_cycle_profiles.class_preset_id` stores the intake snapshot.
- `engine_cycle_plans.class_preset_id` stores the active-plan authority.
- `resolved_class_archetype` remains the transitional coarse engine identity for the current Rust boundary.

## Implemented V1 Preset Semantics

- `classless`
  - neutral baseline
- `bb`
  - keep at most one `main` slot per generated day payload
  - preserve non-main work
- `powa`
  - lower rep ranges on `main` slots that require the `compound` tag
- `ninja`
  - inject `bodyweight` requirements into generated slot payloads
  - reject plans when no bodyweight-compatible path exists
- `monk`
  - present in the catalog but not selectable

## Notes

- This addendum does not change `EngineInputV1`, `EngineOutputV1`, or the accepted Rust operation set.
- Explicit removal of the coarse `strength|hybrid` field from the engine boundary is deferred to a later numbered spec.
