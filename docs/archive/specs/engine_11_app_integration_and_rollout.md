# App Integration And Rollout

## Goal

Define the Wave 2 app-shell bridge that invokes the engine, persists cycle state, and rolls the current generate/complete flow onto the new normalized model.

## Status

- `State`: Next
- `Priority`: High

## Supersession Note

This archived Wave 2 spec is superseded by `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`. The completed Wave 3 boundary makes normalized engine-owned tables canonical for initialized-cycle identity, cursor state, and gamification, with `users.stats_json.activeProgram` retained only as compatibility.

## App Surface

Wave 2 app work:
- authenticated initialize route
- intake validation in `packages/contracts` and `apps/web`
- Rust-engine invocation from the app shell
- normalized persistence writes for initialized cycle state
- cycle-first reads in session generation
- normalized sync after completion

## Route Rules

The initialize route must:
- require auth
- validate the intake payload at the app edge
- assemble the engine-facing reference snapshot
- invoke `initialize_cycle`
- persist normalized state
- refresh the compatibility projection

## Generate/Complete Bridge

Generate rules:
- read active cycle plan first
- return persisted expanded session when present
- fall back to legacy generation only when no active cycle-backed session exists

Complete rules:
- keep current workout/set logging behavior
- advance normalized cycle cursor
- mark the active cycle session completed
- sync normalized gamification state
- refresh any required compatibility projection

## Verification Lanes

Default green lane:
- Rust deterministic tests
- app/API tests with local fixtures and mocked persistence

Gated lane:
- live Supabase verification using env-backed credentials

## Acceptance Criteria

- `POST /api/v0/sessions/initialize` is authenticated and validated.
- The app persists cycle state into normalized tables.
- Generate/complete routes work against normalized cycle state without breaking the legacy fallback.
- Live Supabase checks remain opt-in rather than default CI blockers.
