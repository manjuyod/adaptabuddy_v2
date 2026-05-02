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

The pre-beta app-shell hardening lane is complete: Wave 5 completed the beta alignment, release-evidence, and cross-language replay certification work through Engine 28 without revising the Rust public engine envelopes, and Engine 29 completed the required live Supabase Playwright breaker suite for browser-visible success and failure paths beyond release-promotion paperwork. Playwright browser E2E remains a required pre-beta gate for `apps/web`.

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
- None currently queued.

Current launch lane:
- `[DONE]` `Pre-Beta Playwright E2E Hardening` for `apps/web`

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
- `[ACTIVE]` `Production Beta Readiness` for `apps/web`
- Engine 27 release-confidence evidence is complete, but promotion remains blocked until immutable candidate metadata, owner signoff, and audit disposition are recorded.
- Engine 22 canonical replay implementation and Engine 28 cross-language replay certification are complete.

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

## Immediate Next Milestones

1. Treat Wave 2 as closed and archived.
2. Treat Wave 3 projection cleanup as closed and archived.
3. Treat `engine_13` as complete and archived.
4. Treat `docs/archive/specs/engine_17_user_facing_explanation_consumers.md` as complete and archived.
5. Treat `docs/archive/specs/engine_23_app_replay_invocation_alignment.md` through `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md` as complete and archived.
6. No active numbered engine spec is currently queued.
7. Keep live Supabase verification gated outside the default green lane.
8. Treat Playwright browser E2E as a required pre-beta gate for `apps/web`.
9. Treat `users.stats_json` compatibility ownership and sunset mapping as documented by `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`.
10. Treat `docs/archive/specs/engine_18_deterministic_analytics_read_models.md` as complete and archived.
11. Treat `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md` as complete and archived.
12. Treat `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md` as complete and archived.
13. Treat `docs/archive/specs/engine_21_analytics_api_endpoint.md` as complete and archived.
14. Treat `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md` as complete and archived.
15. Resolve private beta promotion blockers from `docs/operations/private_beta_release_record.md`: immutable candidate commit metadata, owner signoff, and audit disposition.

## Explicit Risks And Tradeoffs

- Full macrocycle materialization increases persistence complexity but keeps replay and orchestration simpler.
- Hybrid app-owned plus engine-owned state can drift if the projection boundary is not kept narrow.
- The new Rust engine surface improves determinism but raises the cost of sloppy adapter changes.
- Live Supabase verification remains valuable, but it cannot be the default CI gate.

## Open Architectural Questions

- Whether the engine should emit deterministic patches only or patches plus domain events
- How far `users.stats_json` should remain as a compatibility surface during rollout
