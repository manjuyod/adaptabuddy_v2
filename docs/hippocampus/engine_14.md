# Engine 14 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`
- Completed addendum: `docs/archive/specs/engine_14_class_preset_addendum.md`
- Completed implementation slice: `docs/archive/specs/2026-04-08-engine-14-counters-only-design.md`

## Implemented so far

- Rust `complete_session` owns the richer Engine 14 counters and emits normalized `progressionState` / `gamificationState` patches.
- `apps/web` now routes cycle-backed completion through Rust `complete_session`.
- Normalized cycle completion sync now applies Rust gamification patches and persists per-exercise progression rows.
- Added normalized progression storage in `packages/db/sql/016_engine_14_progression_states.sql`.
- Rust planning heuristics now respond to repeated stalls, swap pressure, missed-session history, and stronger success streaks.
- `apps/web` now routes raw active-cycle generation through Rust `plan_session`.
- Deterministic milestone-threshold helper coverage now exists in `packages/engine-rs/src/gamification.rs`.

## Runtime truth

- `initialize_cycle` is Rust-backed in the app shell.
- Cycle-backed `complete_session` is Rust-backed in the app shell.
- Cycle-backed raw-session generation is Rust-backed in the app shell.
- Persisted filled normalized cycle payloads still short-circuit directly without a second engine call.

## Verified commands

- `npm run test --workspace apps/web -- session-cycle-sync.test.ts`
- `npm run test --workspace apps/web -- session-completion-reliability.test.ts`
- `npm run test --workspace apps/web -- session-cycle-bridge.test.ts`
- `npm run test --workspace packages/contracts -- smoke.test.ts`
- `npm run typecheck --workspace apps/web`
- `npm run lint --workspace apps/web`
- `cargo test --manifest-path packages/engine-rs/Cargo.toml`

## Open findings

- `users.stats_json` is narrower now, but it still remains the compatibility source for some shell summaries and legacy fallback paths.
- Live Supabase/browser verification for the final Engine 14 alignment remains a release-confidence task rather than a default green-lane requirement.

## Next exact action

- No further Engine 14 implementation is required for the completed boundary. The completed follow-on boundary is `docs/archive/specs/engine_16_operational_release_hardening.md`.

## Handoff log

- `2026-04-14`: Archived the completed counters-only Engine 14 design doc under `docs/archive/specs/2026-04-08-engine-14-counters-only-design.md`.
- `2026-04-14`: Landed Rust-backed cycle completion in `apps/web`, including normalized gamification patch application and normalized progression upserts.
- `2026-04-14`: Added `engine_progression_states` migration and normalized progression contract/schema coverage.
- `2026-04-14`: Updated Rust planning/scoring to use richer progression and adherence counters while keeping public score families unchanged.
- `2026-04-14`: Landed Rust-backed raw active-cycle generation in `apps/web` via `plan_session`, closing the remaining runtime integration gap for the Engine 14 boundary.
