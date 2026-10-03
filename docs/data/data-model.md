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
