# AdaptaBuddy vNext — Agent Guide

`CLAUDE.md` is the canonical process source for this repository. This file mirrors it for agent consumption and should not introduce competing architecture direction.

## Overview

Purpose: Work in an engine-first repository where the long-term center of gravity is a standalone deterministic training engine, while `apps/web` remains the current auth/UI/DB/orchestration shell.

Canonical references:
- Architecture: `docs/architecture/engine_first_architecture.md`
- Roadmap: `specs/overall_plan.md`
- Process source: `CLAUDE.md`

Current active engine spec queue:
- Active numbered engine spec: none currently queued.
- Completed Wave 5 queue:
  - `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
  - `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
  - `docs/archive/specs/engine_25_stats_json_compatibility_sunset_map.md`
  - `docs/archive/specs/engine_26_cycle_session_orchestration_reliability_hardening.md`
  - `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
  - `docs/archive/specs/engine_28_cross_language_replay_certification.md`
- Completed pre-beta app-shell hardening spec:
  - `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md`
- Latest completed numbered spec: `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md`

Archived completed engine specs:
- `docs/archive/specs/2026-04-08-engine-14-counters-only-design.md`
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
- `docs/archive/specs/engine_addendum_stateful_progression_gamification.md`

## Commands

```bash
# Install dependencies
npm install

# Development server (runs apps/web)
npm run dev

# Repository quality checks
npm run typecheck
npm run lint
npm run test
cd apps/web && npm run build

# Live Supabase E2E verification (manual apps/web pre-release check)
RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts

# Manual Playwright browser E2E (manual apps/web pre-release check)
npm run test:e2e:playwright

# First-time Playwright browser install
cd apps/web && npx playwright install

# apps/web deployment smoke verifier
npm run verify:deploy:smoke
```

## GitNexus Working Context

- Treat the generated GitNexus block near the end of this file as tool-owned context; keep durable human-authored guidance outside that block so future `gitnexus analyze` runs do not wipe it.
- To refresh code intelligence from the repo root, run `gitnexus analyze --force`. If the global CLI is unavailable, use `npx gitnexus analyze --force`.
- After refreshing, verify the indexed repo with GitNexus `list_repos`, then use the MCP tools for context and impact work: `query`, `context`, `impact`, `detect_changes`, `cypher`, `rename`, `route_map`, `api_impact`, `shape_check`, `tool_map`, `group_list`, and `group_sync`.
- Preserve `.gitnexus/` and `.claude/skills/generated/*` as generated tool context. Preserve `specs/hippocampus/*` and `docs/hippocampus/*` as durable handoff/status memory.

## Architecture Split

```text
apps/web/            product shell: auth, UI, API, middleware, DB orchestration
packages/engine-rs/  accepted Rust MVP engine baseline for `initialize_cycle` / `plan_session` / `complete_session`
packages/core/       legacy TypeScript decision logic retained as reference context
packages/contracts/  TypeScript adapter contracts and edge validation
packages/db/         SQL and schema notes for app persistence only
```

Current runtime note:
- `apps/web` currently invokes Rust directly for `initialize_cycle`
- cycle-backed completion now invokes Rust `complete_session` and applies normalized gamification/progression state from the engine patch
- cycle-backed session generation now invokes Rust `plan_session` for raw active normalized sessions, while persisted filled payloads still short-circuit directly

Boundary rules:
- `apps/web` owns auth, transport, persistence, rate limiting, security headers, and RLS-backed enforcement.
- `packages/engine-rs` is the accepted engine implementation baseline and owns the current standalone deterministic engine surface.
- `packages/core` remains useful reference behavior but is not the active MVP implementation surface unless a task is explicitly migration- or parity-scoped.
- `packages/contracts` is a TypeScript adapter layer, not the canonical long-term engine schema.
- `users.stats_json` is an app persistence shape, not the canonical engine state model.

## Non-Negotiable Rules

1. Auth stays in cookies only.
2. Validate external inputs at the app edge.
3. Keep server secrets out of client bundles.
4. Assume RLS enforcement for app persistence.
5. Keep engine code pure and deterministic.
6. Do not let DB rows or API wrapper shapes define the engine boundary.
7. Do not mutate plans without explicit confirmation.

## Engine-First Workflow

Use this order unless the task explicitly scopes differently:

1. Define or revise the engine boundary contract.
2. Define invariants, deterministic fixtures, and replay expectations.
3. Update the pure engine spec or implementation in `packages/engine-rs` for the accepted MVP baseline; use `packages/core` only when a task is explicitly migration- or parity-scoped.
4. Update adapter contracts in `packages/contracts` only after engine behavior is settled.
5. Add app/API/UI integration in `apps/web` only if explicitly in scope.

## Key Files Reference

| Purpose | Location |
|---------|----------|
| Canonical architecture direction | `docs/architecture/engine_first_architecture.md` |
| Active roadmap | `specs/overall_plan.md` |
| Rust engine logic | `packages/engine-rs/src/*` |
| Legacy TypeScript engine logic | `packages/core/src/engine/*` |
| TypeScript adapter contracts | `packages/contracts/src/*` |
| App middleware | `apps/web/middleware.ts` |
| Auth and route guards | `apps/web/src/lib/auth/guard.ts`, `apps/web/src/lib/routes.ts` |
| Supabase clients | `apps/web/src/lib/supabase/{server,client,middleware}.ts` |
| Env validation | `apps/web/src/lib/env.ts` |
| Security headers | `apps/web/next.config.mjs`, `apps/web/src/lib/security/` |
| DB migrations and notes | `packages/db/sql/*` |
| apps/web operations docs | `docs/operations/*` |

## Current Scope Notes

- Existing web product-shell work remains valid context, but it is downstream of the engine-first roadmap.
- Existing release docs remain valid only for `apps/web` runtime operations.
- Active and planned engine specs live under `docs/specs/`.
- Historical completed specs live under `docs/archive/specs/` and should not drive current architecture direction.

## Testing Expectations

| Scope | Requirement |
|-------|-------------|
| Engine contract/spec work | Prefer deterministic fixtures, invariant checks, and replay-oriented verification |
| Engine implementation changes | Add or update golden or determinism tests |
| Adapter/API shape changes | Update TypeScript contracts and add schema smoke tests |
| Product-shell changes | Run `npm run typecheck`, `npm run lint`, `npm run test`, and `cd apps/web && npm run build` before completion |

## Open Architecture Risks

- Whether the engine emits only deterministic state patches or patches plus domain events
- How mixed app-owned and engine-owned data should be separated from current persistence shapes

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Adaptabuddy_v2** (6384 symbols, 10761 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Adaptabuddy_v2/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Adaptabuddy_v2/clusters` | All functional areas |
| `gitnexus://repo/Adaptabuddy_v2/processes` | All execution flows |
| `gitnexus://repo/Adaptabuddy_v2/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
