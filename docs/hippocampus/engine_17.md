# Engine 17 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`
- Builds on:
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
  - `docs/archive/specs/engine_16_operational_release_hardening.md`

## Intent

- Expose Engine 15 explanation read models in user-facing app-shell surfaces.
- Keep `EngineInputV1`, `EngineOutputV1`, Rust operations, `decisionLog`, and `replayReceipt` unchanged.
- Avoid raw trace parsing in UI components and keep replay hashes out of normal workout-generation copy.

## Implemented

- Workout generation now stores the optional `GenerateSessionResponse.explanation` read model and renders a "Why this session" panel for cycle-backed generated sessions.
- The explanation panel shows session rationale, movement family, scope/filter/tie-break summaries, and progression changes when present.
- Workout history completion explanations now render readable labels for outcome, XP reason, warnings, and progression action/trend summaries.
- UI tests cover generated-session explanation rendering without replay hash exposure and readable completion explanation copy.

## Verified commands

- `npm run test --workspace apps/web -- tests/ui-workout-flow.test.tsx`
- `npm run test --workspace apps/web -- tests/ui-history.test.tsx`
- Broad closure lane run on 2026-04-23:
  - `npm run typecheck` passed
  - `npm run lint` passed
  - `npm run test` passed: 69 test files passed, 265 tests passed, 3 skipped
  - `cd apps/web && npm run build` passed

## Runtime truth

- `GenerateSessionResponse.explanation` remains optional.
- Missing explanation read models do not block session generation.
- Replay/debug fields remain available only on existing detail/debug surfaces.

## Boundary guardrails

- No engine-envelope fields were added.
- No Rust operation was added or revised.
- UI consumers use the existing app-owned read models instead of parsing raw `decisionLog`.
- Analytics/reporting expansion remains later Wave 4 follow-on work.
