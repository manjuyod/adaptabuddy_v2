# Rust Backend Overview

Adaptabuddy is moving to a mobile-first ecosystem with a Rust API backend as the source of truth for business logic.

```text
Kotlin Android app
        |
        v
Rust API modular monolith
        |
        v
Supabase Auth + Postgres
```

## MVP Now

- `backend/` is the Rust Axum API service.
- Domain crates are internal modules, not separate deployables.
- Supabase provides Auth, Postgres, local development compatibility, and RLS for reviewed direct table access.
- `/api/v0/me/...` is the canonical mobile/client API namespace.
- `/me/...` may exist as a convenience alias, but versioned routes are the ecosystem contract.

## Current Internal Modules

- `auth`: Supabase/local JWT extraction and `AuthContext`.
- `storage`: repository boundary with in-memory tests and Postgres implementation.
- `nutrition`: food entries, targets, and BMR estimate support.
- `body-metrics`: body stat recording.
- `workouts`: v0 plan generation and session completion.
- `progression`: XP, level, and streak derivation.
- `analytics`: dashboard composition.
- `achievements`, `habits`, `goals`, `events`: supporting product modules.

## Deferred

RPG, Unity, iOS, web, and admin surfaces stay downstream of the mobile health loop and should not block the MVP.
