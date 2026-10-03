# Product Roadmap

## MVP Now

1. Rust API exposes `/api/v0/me/...` for profile, stats, dashboard, food, workout plans, and workout sessions.
2. Supabase Auth supplies user identity; Rust validates JWTs and owns authorization decisions.
3. Supabase Postgres stores user-owned rows with owner IDs and RLS.
4. Android consumes the Rust API contract after a Kotlin project is created.

## Next Pass

Build authenticated `/api/v0/me/dashboard` consumption into the Android Home screen once the Kotlin scaffold exists.

## Later

- iOS/Swift after Mac testing is available.
- Unity/RPG frontend after the health data loop is stable.
- Web/admin surfaces only after the API contract settles.
