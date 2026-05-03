# Wave 9: Season Loop Product Shell

## Goal

Wire the Engine 30 Season Loop into the web product shell after the headless engine loop and local backtests are credible.

The product loop is:

```text
New Game
  -> workouts
  -> completion
  -> season rank and awards
  -> next-season recommendation
  -> repeat
```

Wave 9 should make the existing app feel like a repeatable training game loop without moving auth, persistence, UI, or release operations into the engine.

## Status

- `State`: Planned
- `Priority`: High after Wave 8 and Engine 30
- `Depends On`:
  - `docs/specs/wave_8_new_game_engine_first_workflow.md`
  - `docs/specs/engine_30_headless_season_loop_and_backtest_harness.md`

## Boundary Decision

Wave 9 is an app-shell integration spec, not an additional engine-boundary revision.

The app owns:

- auth and cookie sessions
- API transport and validation
- Supabase persistence and RLS-backed ownership
- assembling normalized snapshots for `advance_cycle`
- persisting season summaries, awards, and transition records
- UI presentation for season rank, awards, and next-season preview

The engine owns:

- deterministic season evaluation
- rank and award decisions
- bounded next-cycle direction
- replay receipts and decision logs
- semantic engine-owned state patches

DB rows and API wrapper shapes must not become the canonical engine model.

## Planned Public App Surface

Add a future authenticated route:

```text
POST /api/v0/cycles/advance
```

Service boundary:

```text
handleAdvanceCycle(userId, request)
```

Contract additions:

- `AdvanceCycleRequestSchema`
- `AdvanceCycleResponseSchema`
- `SeasonRankSchema`
- `SeasonAwardSchema`
- `NextCyclePreviewSchema`
- normalized season summary and transition read-model schemas

The route should validate app-edge input, load the active completed cycle context, build `EngineInputV1` with `operation: "advance_cycle"`, invoke the Rust bridge, persist app-owned records, and return a typed response for the UI.

## Persistence Direction

Future normalized app-owned persistence should record:

- season summary per completed cycle
- rank breakdown and award summaries
- next-cycle request material emitted by the engine
- transition replay receipt and decision log reference
- applied transition status

Persistence must remain an app concern. The engine emits semantic state patches and next-cycle intent; the app decides how to store, audit, and present those values.

## Product Flow

1. Wave 8 creates a normalized active cycle through New Game onboarding.
2. Workout generation continues to use the cycle-backed `plan_session` path.
3. Workout completion continues to use the cycle-backed `complete_session` path.
4. When the active cycle reaches its terminal session, the app offers or triggers season advancement.
5. `handleAdvanceCycle` builds the deterministic season-transition input and invokes `advance_cycle`.
6. The app persists the season summary, awards, next-cycle preview, replay receipt, and transition record.
7. The UI shows the season result and the next-season recommendation.
8. Starting the next season calls the existing initialize-cycle flow with the engine-emitted `nextCycleRequest`.

## UI Direction

Initial UI surfaces:

- dashboard season status panel
- end-of-season result view
- rank and award summary
- next-season preview with reason codes from the engine output
- start-next-season action

The UI should present engine explanations from structured decision logs and preview fields, not from app-invented prose that changes the meaning of the engine decision.

## Local-First Verification

Wave 9 must be verified locally before live Supabase or browser release gates are treated as product evidence.

Required default gates:

```bash
npm run typecheck
npm run lint
npm run test
cd apps/web && npm run build
```

Required scenario coverage:

- route contract tests for `POST /api/v0/cycles/advance`
- service tests for completed-cycle input assembly
- persistence tests or fakes for season summaries and transition records
- UI tests for season result and next-season preview states
- mocked Playwright journey for New Game through first season transition

Live Supabase E2E and Playwright browser E2E remain release-candidate gates only after the local Season Loop works end to end.

## Out Of Scope

- changing Rust engine decisions beyond Engine 30
- live Supabase verification during normal cloud work
- production release promotion
- social features, leaderboards, inventory, perks, or full RPG buildcraft
