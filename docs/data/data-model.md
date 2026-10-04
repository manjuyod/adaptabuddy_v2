# Data Model

The MVP data model separates public API shapes from database rows. Rust owns business logic; Supabase stores durable state.

## MVP Now

Reused tables:

- `users`
- `body_metrics`
- `nutrition_food_logs`
- `workout_sessions`
- reference `exercises`, `muscle_groups`, `programs`, `program_days`, and `program_slots`

Added or extended tables:

- `exercise_stats`
- `muscle_group_stats`
- `xp_events`
- `workout_plans`
- `workout_days`
- `workout_exercises`
- `workout_session_exercises`

## Ownership

- User-owned rows include `user_id`.
- RLS is enabled for directly exposed user-owned tables.
- Backend-only tables still carry owner IDs for traceability and safety.
- Authorization roles do not live in user-editable profile fields.

## Indexes

Common query paths are indexed by owner, dates, plan/session IDs, `meal_type`, and creation timestamps.

## Exercise catalog

Reference exercises carry a training category, intended tracking mode, source
URLs, brief instructions, and an editorial review status. Muscle associations
describe qualitative targets; legacy strength contribution values are heuristic
weights, and non-strength categories use zero strength-volume contribution.
See [the initial catalog audit](exercise-catalog-audit.md) for the original
corrections and sources, and the current coverage report for subsequent work.

Replacement metadata adds functional families, explicit alternative equipment
sets, and variant groups for deduplication. See
[replacement coverage](exercise-replacement-coverage.md) for the home/gym
acceptance matrix, audit commands, and catalog-backed Rust replacement routes.

`replacement_status` distinguishes eligible movements from intensity protocols,
composite sequences, specialist-review records, and unreviewed imports.
`replacement_reason` records why an active record is excluded. A technique's
`review_status` is separate from its functional replacement classification.

Backend-only `exercise_replacement_profiles` stores four fixed equipment
inventories. `exercise_replacement_coverage_requirements` independently requires
three distinct variants per supported category/family/profile, or records an
equipment-only exception that must have zero available variants. Both tables
have RLS and deny access to `anon` and `authenticated`.

`workout_exercises.prescription` is optional JSON for an explicitly supplied
tracking mode, sets/reps, duration in seconds and/or distance in meters. Old
rows remain null. Rust validates the shape and selected catalog mode; a timed
replacement uses zero in the legacy reps column and returns its typed
prescription. Replacements retain the exercise row ID and caution notes and
are forbidden once a session references the day. An eligible-family/variant
partial index supports selection and conservative anatomy exclusions across
aliases.
