# Wave 8: New Game Engine-First Workflow

## Goal

Wire the `New Game` product path into the existing engine-first cycle initialization flow.

`New Game` should create a normalized engine-backed cycle before the user reaches workout
generation. It should no longer complete setup by only saving preferences and a legacy
`users.stats_json.activeProgram` compatibility projection.

## Status

- `State`: Active
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_08_initialize_cycle_boundary.md`
  - `docs/archive/specs/engine_11_app_integration_and_rollout.md`
  - `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
  - `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`

## Current Gap

The app already has the engine-first backend path:

- `POST /api/v0/sessions/initialize`
- `handleInitializeCycle`
- normalized cycle persistence in `engine_cycle_profiles`, `engine_cycle_program_mix`,
  `engine_cycle_plans`, `engine_cycle_sessions`, and `engine_gamification_states`
- cycle-backed workout generation that invokes Rust `plan_session`

The `New Game` UI does not currently use that path. `New Game` routes to `/onboarding`,
and onboarding currently calls `completeOnboarding`, which saves preferences, marks
`has_save`, and may write a legacy compatibility `stats_json.activeProgram` projection
when no normalized active cycle exists.

## Boundary Decision

Wave 8 is an app-shell workflow integration spec, not an engine-boundary revision.

This spec keeps unchanged:

- Rust public engine envelopes
- public Rust operations: `initialize_cycle`, `plan_session`, and `complete_session`
- canonical replay serialization and numeric policy
- normalized cycle tables as the canonical initialized-cycle source
- `users.stats_json.activeProgram` as compatibility-only state
- app-owned auth, transport, validation, persistence, RLS enforcement, and UI

This spec defines:

- how `New Game` collects enough intake to build an `InitializeCycleRequest`
- how onboarding submits to the existing initialize-cycle path
- how success leaves the user with a normalized active cycle ready for `plan_session`
- how legacy onboarding save behavior is narrowed to app-owned preferences and compatibility
  support, not primary cycle activation

## Product Flow

The intended `New Game` flow is:

1. User chooses `New Game` from the title screen.
2. App routes to `/onboarding`.
3. Onboarding collects app-owned preferences and engine-cycle intake:
   - equipment
   - unit system
   - class preset
   - goal bias
   - available days per week
   - fatigue preference
   - injury muscle group slugs
   - macrocycle weeks
   - selected program weights
4. Final submit validates the app-edge payload and calls the existing authenticated
   initialize-cycle path.
5. The app persists normalized cycle state and any required compatibility projection.
6. The app routes the user to `/dashboard` or `/workout`.
7. Workout generation reads the normalized active cycle and invokes Rust `plan_session`
   through the existing cycle-backed generation path.

## Implementation Direction

- Keep `NEW_GAME_ROUTE` pointed at `/onboarding`.
- Extend onboarding UI/state only enough to produce the existing
  `InitializeCycleRequestSchema` shape from `packages/contracts`.
- Reuse the existing `/api/v0/sessions/initialize` route or the same service boundary behind
  it. Do not introduce a second engine initialization entrypoint.
- Preserve `completeOnboarding` behavior only where it still owns app preferences,
  `has_save`, and compatibility support. It must not be treated as the primary New Game
  cycle activation mechanism after Wave 8.
- On initialize success, refresh dashboard, start/title, programs, and workout paths that
  display active-cycle or save-state data.
- On initialize failure, keep the user in onboarding and show actionable validation or
  persistence errors without partially claiming setup success.

## Verification And Acceptance Rules

Implementation acceptance requires:

- unit coverage for mapping onboarding choices into `InitializeCycleRequest`
- server/action coverage for successful initialize-cycle invocation and initialization
  failure display
- UI coverage for the New Game wizard submitting the engine-first setup path
- API coverage remains in the existing `/api/v0/sessions/initialize` tests
- Playwright user journey coverage for:
  - `New Game`
  - onboarding validation
  - successful normalized cycle initialization
  - dashboard or workout arrival
  - workout generation from the initialized active cycle

Default verification:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

Release-candidate verification still requires the manual live Supabase and Playwright gates
documented in `specs/overall_plan.md`.

## Acceptance Criteria

Wave 8 closes when:

- completing `New Game` creates one active normalized `engine_cycle_plans` row for the user
- the initialized plan has expanded `engine_cycle_sessions`
- normalized gamification state exists for the initialized plan
- dashboard/workout surfaces read the normalized active cycle
- workout generation after `New Game` invokes the existing cycle-backed `plan_session` path
- legacy `stats_json.activeProgram` is not the primary New Game activation source when a
  normalized active cycle exists
- no Rust engine contract, envelope, replay-policy, or DB schema migration is required

