# Explainability And Reporting Read Models

## Goal

Define the first Wave 4 boundary revision as an app-layer explainability and reporting read-model contract built on the already-closed engine trace surface and normalized engine-owned cycle state.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md`
  - `docs/archive/specs/engine_05_testing_and_replay.md`
  - `docs/archive/specs/engine_12_projection_cleanup_and_compatibility_boundary.md`
  - `docs/archive/specs/engine_13_class_definition_and_resolution_boundary.md`
  - `docs/archive/specs/engine_14_richer_progression_and_adherence_state.md`
  - `docs/archive/specs/engine_14_class_preset_addendum.md`

## Current Baseline

This boundary is implemented and green on the broad default lane:
- `npm run test`
- `cd apps/web && npm run build`

The implementation now includes:
- canonical reporting/explainability derivation in `apps/web/src/modules/reporting/service.ts`
- persisted trace support in `packages/db/sql/017_engine_15_session_traces.sql`
- current consumer wiring in session generation, workout history, and `/api/v0/reporting/active-cycle`

Live Supabase verification remains a manual gated lane:
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`

That lane is release-confidence evidence only. It is not a prerequisite for authoring or accepting this spec because it provisions users, writes normalized cycle state, exercises RLS behavior, and then cleans up created rows against the target project.

## Problem Statement

Wave 3 closed the engine-facing trace and normalized state boundaries, but Wave 4 still lacks a canonical way to turn those artifacts into stable app-owned explanation and reporting surfaces.

Current limitations:
- app features can read raw `decisionLog` and normalized tables, but there is no closed read-model contract that says how user-facing or internal explanations should be assembled
- analytics and reporting risk becoming ad hoc DB queries or UI-specific transformations instead of one app-owned derived model
- the repository has replayable trace data and richer normalized progression/adherence state, but it does not yet define a single consumer-facing story for why a session was selected or how a cycle is progressing
- `users.stats_json` is narrower after Wave 3, but some shell summaries still depend on compatibility projection fields, which makes reporting surfaces vulnerable to drift if they are not explicitly normalized around engine-owned state

The next step should not reopen the engine contract. It should define how the app shell consumes the closed trace and normalized state model to produce durable explanation and reporting outputs.

## Boundary Decision

Wave 4 starts with an app-layer read-model boundary, not an engine-envelope revision.

This spec keeps unchanged:
- `EngineInputV1`
- `EngineOutputV1`
- public Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- public `decisionLog` semantics closed by `engine_04`
- public `replayReceipt` semantics closed by `engine_04` and replay policy closed by `engine_05`

This spec defines:
- the canonical app-owned inputs used to derive explanation and reporting read models
- the categories of explanation and reporting outputs the app may expose
- the rules future API/UI surfaces must follow when consuming those derived models

This spec does not define:
- new engine output fields
- new score families
- new replay-receipt fields
- new deterministic patch buckets
- new canonical persistence ownership for app projections

## Read-Model Input Rules

The canonical inputs for Wave 4 explainability and reporting are:
- `decisionLog`
- `replayReceipt`
- normalized cycle/session plan state
- normalized progression state
- normalized gamification and adherence state
- compatibility projection fields only where normalized state does not yet cover a shell-only summary

Input ownership rules:
- `decisionLog` remains the canonical explanation trace for engine decisions
- `replayReceipt` remains the canonical replay/debug correlation artifact
- normalized cycle tables remain the canonical app-side source for initialized-cycle identity, cursor state, cycle/session history, and richer progression/adherence counters
- `users.stats_json` remains app-owned compatibility state and must not become the canonical source for explanation or reporting when normalized engine-owned state exists

Consumption rules:
- app read models must derive their outputs from canonical inputs rather than storing independent explanation truth
- future UI/API features must consume a stable app-owned read-model contract rather than parsing raw `decisionLog` arrays ad hoc in multiple locations
- compatibility projections may fill temporary gaps, but the read-model contract must remain refreshable from normalized state and closed trace semantics

## Explainability Output Rules

Wave 4 explanation outputs are app-owned derived models. They are not new engine fields.

Required explanation categories:
- selection rationale for `plan_session`
- filter or block reasons derived from `scope`, `filter`, `score`, `tie_break`, and `final_selection` entries
- progression and adherence summaries derived from normalized progression and gamification state plus completion traces when needed
- completion outcome explanations derived from `classify`, `state_update`, and `award_xp`
- replay and debug references derived from `replayReceipt` and deterministic trace metadata

Rules:
- user-facing prose must be derived from structured log entries and normalized state, not treated as a second canonical explanation source
- explanations must not require hidden engine state beyond the closed V1 trace and normalized app persistence
- a missing optional compatibility projection field must not change the underlying meaning of an explanation when normalized state is present
- read models may include app-friendly labels, grouping, and copy, but those are presentation-layer derivations from canonical engine-owned meaning

## Reporting Output Rules

Wave 4 reporting outputs are also app-owned derived models.

Required reporting categories:
- adherence trend summaries from normalized session outcomes and gamification counters
- progression state summaries from normalized per-exercise progression records
- session and cycle completion metrics from normalized plan/session state
- class or preset resolution context where it materially helps interpret the cycle or session history
- replay-oriented internal correlation fields where a report or admin view needs to tie a surfaced explanation back to the engine trace

Rules:
- reporting must prefer normalized engine-owned cycle state over compatibility projections
- reports must tolerate continued shrinkage of `users.stats_json` without redefining engine semantics
- internal/admin reporting may expose more raw structured detail than end-user explanations, but both surfaces must be derived from the same canonical read-model inputs
- reporting logic must stay app-owned and must not push DB-shaped or UI-shaped requirements back into the engine boundary

## Interface And Integration Rules

This spec introduces a new kind of public interface inside the app shell:
- a derived explanation read-model contract
- a derived reporting read-model contract

These are app-owned interfaces, not engine-envelope interfaces.

Integration rules:
- any future API route, server action, admin view, or user-facing screen that needs explanation or reporting must consume the read-model layer rather than manually walking raw logs in-place
- the read-model layer may assemble composite records from trace data and normalized tables, but it must not redefine the meaning of engine-owned state
- if a UI needs wording or grouping that is not directly present in the trace, the app may derive it, but the derivation must remain deterministic from the available canonical inputs

## Verification And Acceptance Rules

Spec acceptance requires a later implementation to cover:
- explanation derivation from `plan_session` decision logs without hidden engine state
- explanation derivation from `complete_session` classification, state-update, and XP traces
- reporting that remains stable when compatibility projection fields continue to shrink
- replay/debug correlation using the existing `replayReceipt` fields
- deterministic handling of missing or legacy-compatible projection data without redefining engine semantics

Execution-side verification rules remain:
- keep the broad repo lane green:
  - `npm run test`
  - `cd apps/web && npm run build`
- keep live Supabase verification manual and gated:
  1. confirm env parity for `SUPABASE_URL`, anon key, and service-role key
  2. confirm target project matches the release target
  3. run `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
  4. capture pass/fail and any environmental blocker in the release record

## Out Of Scope

This spec does not:
- revise score families or ranking policy
- reopen `decisionLog` or `replayReceipt` semantics
- add fields to `EngineInputV1` or `EngineOutputV1`
- make DB rows or query layouts canonical engine boundary material
- define release-hardening implementation work for the app shell

Operational and release hardening remain a follow-on Wave 4 spec, informed by archived Specs 18 through 20 but not merged into this boundary.

## Deferred Risks And Follow-Up

- exact API and UI surfaces that first consume the read-model layer
- how much raw replay/debug detail should be exposed to internal tools versus end-user surfaces
- long-term reduction of compatibility-only summaries still sourced from `users.stats_json`
- downstream operationalization work for release hardening, observability refinement, and rollout guardrails after the explainability/reporting boundary is implemented

## Completion Note

Engine 15 is complete as a boundary-closure spec.

This completion means:
- the app-layer explainability/reporting read-model contract is implemented and canonical
- future user/admin consumer expansion can build on the read-model layer without reopening the engine boundary
- the next numbered lane is Wave 4 operational/release hardening, not an engine-envelope revision
