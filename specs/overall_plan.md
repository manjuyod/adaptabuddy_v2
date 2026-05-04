# Adaptabuddy_v2 Engine-First Roadmap

## Status Legend

| Tag | Meaning |
|-----|---------|
| `[DONE]` | Completed and locked unless a later numbered spec revises it |
| `[ACTIVE]` | Current primary implementation lane |
| `[NEXT]` | Queued immediately after the active item |
| `[LATER]` | Downstream work that depends on earlier phases |
| `[HISTORICAL]` | Archived context only |

## Overview

Wave 2 is complete. Wave 3 is complete and archived. Wave 4 is complete through canonical replay serialization and numeric policy: normalized engine-owned cycle tables remain canonical for initialized-cycle identity, cursor state, gamification, and app-owned analytics derivation, while `users.stats_json.activeProgram` remains compatibility-only for the current shell.

The pre-beta app-shell hardening lane is complete: Wave 5 completed the beta alignment, release-evidence, and cross-language replay certification work through Engine 28 without revising the Rust public engine envelopes, Engine 29 completed the required live Supabase Playwright breaker suite for browser-visible success and failure paths beyond release-promotion paperwork, and Wave 6 closed the private beta promotion lane after Docker build/runtime evidence passed for the exact candidate. Wave 8, Engine 30, and Wave 9 now close the local Season Loop: `New Game` initializes normalized engine-backed cycles, the Rust engine can evaluate and backtest season transitions, and the app shell can persist and present season rank, awards, and next-season recommendations. Playwright browser E2E remains a required release-candidate gate for `apps/web`, not a substitute for local backtesting.

Current architecture split:
- Engine: `packages/engine-rs` owns deterministic decision logic for `initialize_cycle`, `plan_session`, and `complete_session`
- App shell: `apps/web` owns auth, transport, orchestration, persistence, and RLS-backed enforcement
- Adapter contracts: `packages/contracts` validates app-edge request and response shapes
- Persistence: normalized engine-owned cycle tables plus minimal app projection in `users.stats_json`

Current runtime note:
- the Rust crate exposes `initialize_cycle`, `plan_session`, and `complete_session`
- the app currently invokes Rust directly for `initialize_cycle`
- cycle-backed completion in `apps/web` now invokes Rust `complete_session` and persists normalized gamification/progression state from the engine patch
- cycle-backed session generation in `apps/web` now invokes Rust `plan_session` for raw active normalized sessions, while persisted filled payloads still short-circuit directly

Canonical architecture reference:
- `docs/architecture/engine_first_architecture.md`

Active and planned numbered specs live under `docs/specs/`. Completed historical specs are archived under `docs/archive/specs/` and should not be treated as the active queue.

## Active Spec Queue

Current active spec:
- `[DONE]` `docs/specs/wave_8_new_game_engine_first_workflow.md`
- `[DONE]` `docs/specs/engine_30_headless_season_loop_and_backtest_harness.md`
- `[DONE]` `docs/specs/wave_9_season_loop_product_shell.md`

Current launch lane:
- `[DONE]` `Production Beta Readiness` for `apps/web`
- Latest promoted candidate: `rc-3db65a2-20260502` at `3db65a2f56c5a7a92cf0c6b72d3ab1d0496e1ba2`

Current operations lane:
- `[PLANNED]` `Wave 7: Private Beta Operations And Learning Loop` after Season Loop local backtesting and product-shell completion

Current product/app-shell lane:
- `[DONE]` `Wave 8: New Game Engine-First Workflow`
- `[DONE]` `Wave 9: Season Loop Product Shell`

Current Wave 5 queue:
- `[DONE]` `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
- `[DONE]` `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
- `[DONE]` `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`
- `[DONE]` `docs/archive/specs/engine_26_cycle_session_orchestration_reliability_hardening.md`
- `[DONE]` `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
- `[DONE]` `docs/archive/specs/engine_28_cross_language_replay_certification.md`
- `[DONE]` `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md`

Completed Wave 3 specs:
- `[DONE]` `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
- `[DONE]` `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`
- `[DONE]` `docs/archive/specs/engine_14_class_preset_addendum.md`

Recently completed authoring queue:
- `[DONE]` `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md`
- `[DONE]` `docs/archive/specs/engine_28_cross_language_replay_certification.md`
- `[DONE]` `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
- `[DONE]` `docs/archive/specs/engine_26_cycle_session_orchestration_reliability_hardening.md`
- `[DONE]` `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`
- `[DONE]` `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
- `[DONE]` `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
- `[DONE]` `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`
- `[DONE]` `docs/archive/specs/engine_21_analytics_api_endpoint.md`
- `[DONE]` `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`
- `[DONE]` `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`
- `[DONE]` `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`
- `[DONE]` `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`

Archived completed engine specs:
- `docs/archive/specs/engine_01_boundary_contracts.md`
- `docs/archive/specs/engine_02_snapshot_normalization.md`
- `docs/archive/specs/engine_03_candidate_pipeline_and_constraints.md`
- `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md`
- `docs/archive/specs/engine_05_testing_and_replay.md`
- `docs/archive/specs/engine_06_isolated_engine_implementation.md`
- `docs/archive/specs/engine_07_rust_review_fix_and_test_plan.md`
- `docs/archive/specs/engine_08_initialize_cycle_boundary.md`
- `docs/archive/specs/engine_09_cycle_generation_and_program_blending.md`
- `docs/archive/specs/engine_10_engine_state_persistence_and_projection.md`
- `docs/archive/specs/engine_11_app_integration_and_rollout.md`
- `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
- `docs/archive/specs/engine_13_class_definition_and_resolution_boundary.md`
- `docs/archive/specs/engine_14_class_preset_addendum.md`
- `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`
- `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
- `docs/archive/specs/engine_16_operational_release_hardening.md`
- `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`
- `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`
- `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`
- `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`
- `docs/archive/specs/engine_21_analytics_api_endpoint.md`
- `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`
- `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
- `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
- `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`
- `docs/archive/specs/engine_26_cycle_session_orchestration_reliability_hardening.md`
- `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
- `docs/archive/specs/engine_28_cross_language_replay_certification.md`
- `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md`
- `docs/archive/specs/engine_addendum_stateful_progression_gamification.md`

## Wave 1 Baseline `[DONE]`

Wave 1 established the accepted Rust MVP boundary and deterministic engine core. That work is closed for this wave and now serves as historical baseline rather than the active queue.

Completed outputs:
- canonical `EngineInputV1` and `EngineOutputV1` envelope
- deterministic `plan_session` and `complete_session` baseline
- replay receipts, decision-log structure, and fixture-oriented testing
- engine-first architecture direction separated from app persistence shapes

## Wave 2: Intake, Cycle Expansion, and Persistence `[DONE]`

Goal:
- Introduce `initialize_cycle` as a first-class Rust operation driven by questionnaire-style intake and persist the resulting macrocycle state in normalized engine-owned tables.

Primary outputs:
- deterministic intake contract for class choice, fatigue preference, injuries, and weighted program selection
- cycle expansion logic that materializes macro, meso, micro, and session windows up front
- normalized cycle tables for plans, sessions, program blend, intake profile, and gamification state
- `apps/web` bridge that persists initialized state and reads it before falling back to legacy generation

Dependencies:
- Wave 1 baseline

Acceptance criteria:
- `initialize_cycle` is public, deterministic, and covered by Rust regression tests
- the app persists engine-owned cycle state outside `users.stats_json`
- session generation reads active cycle sessions first
- completion sync advances normalized cycle state and gamification counters

## Wave 3: Class Resolution and Richer Progression `[DONE]`

Goal:
- Reduce legacy projection coupling and expand cycle/progression richness without collapsing app-owned and engine-owned responsibilities.

Completed output:
- `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md` closed the projection-cleanup step and narrowed `users.stats_json.activeProgram` to a compatibility projection.
- `docs/archive/specs/engine_13_class_definition_and_resolution_boundary.md` closed the canonical class taxonomy, explicit resolution precedence, and historical-token compatibility boundary.
- `docs/archive/specs/engine_14_class_preset_addendum.md` closed the user-facing preset layer without widening the canonical engine taxonomy.
- `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md` closed the richer progression/adherence boundary, including Rust-backed cycle completion/generation, normalized progression persistence, and the first richer planning heuristics.
- `docs/archive/specs/2026-04-08-engine-14-counters-only-design.md` remains the completed implementation record for the counters-only Engine 14 slice.

## Wave 4: Explainability and Operationalization `[DONE]`

Goal:
- Build explanation, analytics, and runtime operations on top of the stable engine-owned cycle model.

Completed output:
- `[DONE]` `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
- `[DONE]` `docs/archive/specs/engine_16_operational_release_hardening.md`
- `[DONE]` `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`
- `[DONE]` `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`
- `[DONE]` `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`
- `[DONE]` `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`
- `[DONE]` `docs/archive/specs/engine_21_analytics_api_endpoint.md`
- `[DONE]` `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`

Private beta output:
- `[DONE]` `Production Beta Readiness` for `apps/web`
- Engine 22 canonical replay implementation and Engine 28 cross-language replay certification are complete.
- Latest release-candidate evidence, decision status, and promotion blockers are tracked in `docs/operations/private_beta_release_record.md`.

## Wave 5: Beta Replay And Completion Hardening `[DONE]`

Goal:
- Convert the completed Engine 22 replay policy into app-compliant invocation evidence, harden the app-owned beta launch path around replay bundles, `stats_json` compatibility, cycle/session orchestration, and release evidence, then certify replay material across an independent implementation path.

Queued output:
- `[DONE]` `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
- `[DONE]` `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
- `[DONE]` `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`
- `[DONE]` `docs/archive/specs/engine_26_cycle_session_orchestration_reliability_hardening.md`
- `[DONE]` `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
- `[DONE]` `docs/archive/specs/engine_28_cross_language_replay_certification.md`

Boundary:
- Engine 23-27 are complete private-beta alignment and hardening work around the accepted Rust engine baseline.
- `EngineInputV1`, `EngineOutputV1`, and public Rust operations stay unchanged unless a later accepted boundary-revision spec explicitly changes them.
- Engine 28 cross-language replay certification is complete and archived after app replay invocation alignment and release-confidence evidence.

## Wave 6: Private Beta Promotion Closure `[DONE]`

Goal:
- Close the private beta release lane after resolving promotion blockers and validating the exact candidate through local, live Supabase, Playwright, Docker build, and Docker runtime smoke gates.

Completed output:
- `rc-3db65a2-20260502` promoted from commit `3db65a2f56c5a7a92cf0c6b72d3ab1d0496e1ba2`
- high-severity npm audit blocker remediated without semver-major framework, auth, or test-tool upgrades
- Docker Desktop Linux engine availability confirmed on `desktop-linux`
- Docker build and runtime smoke passed for `adaptabuddy-web:rc-3db65a2-20260502`
- live Supabase E2E and Playwright browser E2E passed against the target project

Evidence:
- `docs/operations/private_beta_release_record.md`

Boundary:
- No Rust public engine envelope changes were made for promotion closure.
- No DB schema changes were made for promotion closure.
- No new numbered engine spec was accepted as part of promotion closure.

## Wave 7: Private Beta Operations And Learning Loop `[PLANNED]`

Goal:
- Operate live private beta only after the local Season Loop is backtested and product-complete enough for live users to provide meaningful evidence.

Primary work:
- Preserve the promoted beta evidence and operations runbooks as release history.
- Defer new live-learning conclusions until Wave 8, Engine 30, and Wave 9 provide a complete local product loop.
- Once live beta resumes, track private beta feedback, support reports, release incidents, and debugging evidence in durable handoff memory under `docs/hippocampus/` or `specs/hippocampus/`.
- Correlate beta issues with request IDs, replay receipts, route-level evidence, and affected app/engine boundary areas.
- Classify findings as app-shell, adapter-contract, persistence/RLS, telemetry/read-model, replay/debuggability, deterministic engine behavior, or product-copy issues.

Boundary:
- Wave 7 does not gate Engine 30.
- Live beta feedback is downstream validation, not the prerequisite for building the local Season Loop.
- `apps/web` remains the shell for auth, support, telemetry, persistence, release operations, and beta feedback capture.
- Future engine specs after Engine 30 should still be justified by local backtest evidence, replay evidence, or live evidence that exposes a deterministic engine-boundary problem.

Exit criteria:
- Wave 8 New Game flow is complete.
- Engine 30 headless Season Loop backtests pass deterministic replay and balance invariants.
- Wave 9 product shell can run New Game through a season transition locally.
- Live beta can produce useful evidence about a complete loop rather than about missing loop mechanics.

## Wave 8: New Game Engine-First Workflow `[DONE]`

Goal:
- Wire the `New Game` product path into the existing engine-first cycle initialization flow so onboarding creates a normalized active cycle before workout generation.

Active spec:
- `docs/specs/wave_8_new_game_engine_first_workflow.md`

Primary work:
- Keep `New Game` routed to `/onboarding`.
- Adapt onboarding so final setup produces the existing `InitializeCycleRequest` shape.
- Reuse the existing authenticated `/api/v0/sessions/initialize` and `handleInitializeCycle` path.
- Persist normalized cycle state as canonical initialized-cycle state.
- Leave `users.stats_json.activeProgram` as compatibility-only when a normalized active cycle exists.
- Route the user to dashboard or workout with a normalized active cycle ready for the existing cycle-backed `plan_session` path.

Boundary:
- Wave 8 is an app-shell workflow integration spec, not Engine 30.
- No Rust public engine envelope changes are implied.
- No DB schema migration is expected.
- App-owned preferences, auth, transport, validation, persistence, and UI remain in `apps/web`.

Exit criteria:
- Completing `New Game` creates one active normalized `engine_cycle_plans` row for the user.
- Expanded `engine_cycle_sessions` and normalized gamification state are persisted.
- Dashboard/workout surfaces read the normalized active cycle.
- Workout generation after `New Game` invokes the existing cycle-backed `plan_session` path.
- Legacy `stats_json.activeProgram` is not the primary New Game activation source when a normalized active cycle exists.

## Engine 30: Headless Season Loop And Backtest Harness `[DONE]`

Goal:
- Add `advance_cycle` and a local backtest harness so the engine can evaluate completed macrocycle seasons, rank outcomes, award progress, emit bounded next-cycle requests, and replay chained seasons without the app, Supabase, or live beta traffic.

Active spec:
- `docs/specs/engine_30_headless_season_loop_and_backtest_harness.md`

Primary work:
- Expand the Rust public operation set with `advance_cycle`.
- Define typed season summary, rank breakdown, awards, evolution patch, next-cycle request, and next-cycle preview outputs.
- Add deterministic fixtures for S/A/B/C/D, overreach, and injury-constrained seasons.
- Add a headless multi-season harness that chains `initialize_cycle`, `plan_session`, `complete_session`, and `advance_cycle`.
- Prove backtest replay stability and balance caps before app-shell integration.

Boundary:
- Engine 30 is an engine-boundary revision.
- `EngineInputV1` and `EngineOutputV1` remain the public envelope names.
- No app API, UI, DB migration, or live Supabase work is implied by Engine 30.

Exit criteria:
- `advance_cycle` is public, deterministic, and covered by malformed-input rejection tests.
- Every fixture-produced `nextCycleRequest` is valid for `initialize_cycle`.
- Multi-season backtests are replay-stable for identical seeds.
- Rank effects stay within configured caps and do not create empty or impossible next cycles.

## Wave 9: Season Loop Product Shell `[DONE]`

Goal:
- Integrate Engine 30 into `apps/web` so users can complete a season, see rank and awards, review the next-season recommendation, and start the next season through the existing initialize-cycle path.

Planned spec:
- `docs/specs/wave_9_season_loop_product_shell.md`

Primary work:
- Add authenticated `POST /api/v0/cycles/advance` backed by `handleAdvanceCycle`.
- Add TypeScript contracts for advance-cycle request/response, season rank, awards, and next-cycle preview.
- Persist normalized app-owned season summaries, awards, and transition records without letting DB rows define the engine boundary.
- Add dashboard/end-of-season UI for rank, awards, and next-season preview.
- Add local mocked journey coverage before live Supabase E2E resumes as release evidence.

Boundary:
- Wave 9 is app-shell integration, not a second engine-boundary revision.
- Auth, validation, transport, persistence, RLS, and UI stay in `apps/web`.
- Engine decisions remain driven by Engine 30 output and replay material.

Exit criteria:
- The local product shell can run `New Game -> workouts -> completion -> season rank/awards -> next-season recommendation -> repeat`.
- Season transition records include replay receipts and decision-log references.
- Live beta testing is explicitly re-enabled as downstream release validation after local Season Loop gates pass.

## Immediate Next Milestones

1. Treat Wave 2 as closed and archived.
2. Treat Wave 3 projection cleanup as closed and archived.
3. Treat `engine_13` as complete and archived.
4. Treat `docs/archive/specs/engine_17_user_facing_explanation_consumers.md` as complete and archived.
5. Treat `docs/archive/specs/engine_23_app_replay_invocation_alignment.md` through `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md` as complete and archived.
6. Engine 30 is complete for the headless Season Loop and local backtest harness.
7. Keep live Supabase verification gated outside the default green lane.
8. Treat Playwright browser E2E as a required release-candidate gate for `apps/web`.
9. Treat `users.stats_json` compatibility ownership and sunset mapping as documented by `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`.
10. Treat `docs/archive/specs/engine_18_deterministic_analytics_read_models.md` as complete and archived.
11. Treat `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md` as complete and archived.
12. Treat `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md` as complete and archived.
13. Treat `docs/archive/specs/engine_21_analytics_api_endpoint.md` as complete and archived.
14. Treat `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md` as complete and archived.
15. Treat `rc-3db65a2-20260502` as promoted according to `docs/operations/private_beta_release_record.md`.
16. Treat live Wave 7 beta observations as downstream validation until the local Season Loop exists end to end.
17. Treat `docs/specs/wave_8_new_game_engine_first_workflow.md` as complete pending any future archival pass.
18. Treat `docs/specs/engine_30_headless_season_loop_and_backtest_harness.md` as complete pending any future archival pass.
19. Treat `docs/specs/wave_9_season_loop_product_shell.md` as complete pending any future archival pass.

## Explicit Risks And Tradeoffs

- Full macrocycle materialization increases persistence complexity but keeps replay and orchestration simpler.
- Hybrid app-owned plus engine-owned state can drift if the projection boundary is not kept narrow.
- The new Rust engine surface improves determinism but raises the cost of sloppy adapter changes.
- Live Supabase verification remains valuable, but it cannot be the default CI gate.
- Live beta feedback is low-signal until the Season Loop is product-complete enough to exercise locally.

## Open Architectural Questions

- Whether the engine should emit deterministic patches only or patches plus domain events
- How far `users.stats_json` should remain as a compatibility surface during rollout
- How much of next-cycle tuning should live in `advance_cycle` output versus policy consumed by `initialize_cycle`
