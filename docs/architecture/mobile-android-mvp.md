# Android Mobile MVP

The Kotlin Android project lives in `mobile/`. This document locks the first mobile product slice and navigation contract.

## MVP Now

Bottom navigation:

1. Home
2. Habits
3. Add
4. Workout
5. Food

Use a top-right overflow or action area for account, settings, extra goodies, future RPG toggle, and developer/debug information.

## Screens

- Home: latest weight, calories today, workout recommendation, next planned workout, progress summary, stale-stats prompt.
- Habits: calendar-style daily status markers for workout, food log, weigh-in, stat update, and later habit events.
- Add: quick add for food entry, workout completion, body stat/weigh-in, and exercise stat.
- Workout: upcoming workout, current plan, recent completions, and muscle group summary data.
- Food: today’s foods, calories, macros, meal type, and flexible sorting/filtering.

## API

Android should authenticate with Supabase Auth and call the Rust API using the Supabase access JWT. The canonical contract is documented in `docs/api/api-contracts.md`.

## Later

- Do not start iOS/Swift until Mac-based testing is available.
