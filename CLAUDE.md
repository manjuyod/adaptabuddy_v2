# CLAUDE.md

This file is the canonical process and architecture guide for agents working in this repository.

## Build/Dev/Test Commands

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

# Run specific test file
cd apps/web && npm run test -- tests/path/to/file.test.ts

# Production build for apps/web
cd apps/web && npm run build && npm run start

# apps/web deployment smoke verifier
npm run verify:deploy:smoke

# Python helper environment (scripts/python_helper, uv + Python 3.13)
uv sync --project scripts/python_helper --python 3.13
uv run --project scripts/python_helper --python 3.13 python scripts/python_helper/generate_assets.py --prompt "your prompt"
```

## Overview

Purpose: Build an engine-first training decision system whose long-term center of gravity is a standalone deterministic core, while keeping the current Next.js + Supabase application as the product shell and adapter layer.

Scope: Prioritize explicit engine boundaries, deterministic behavior, replayable decision logic, and small explainable contracts. Treat `apps/web` as the orchestration, auth, UI, and persistence surface, not the canonical engine model.

Canonical architecture reference:
- `docs/architecture/engine_first_architecture.md`

Active roadmap reference:
- `specs/overall_plan.md`

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

## Architecture

Monorepo with npm workspaces and an explicit engine/app split:

```text
apps/web/            Next.js product shell: routes, UI, auth, API, middleware, DB orchestration
packages/engine-rs/  accepted Rust MVP engine baseline for `initialize_cycle` / `plan_session` / `complete_session`
packages/core/       legacy TypeScript decision logic retained as reference behavior
packages/contracts/  TypeScript adapter contracts and edge validation
packages/db/         SQL and schema notes for app persistence only
```

Current runtime note:
- `apps/web` currently invokes Rust directly for `initialize_cycle`
- cycle-backed completion now invokes Rust `complete_session` and applies normalized gamification/progression state from the engine patch
- cycle-backed session generation now invokes Rust `plan_session` for raw active normalized sessions, while persisted filled payloads still short-circuit directly

Boundary rules:
- `packages/engine-rs` is the accepted engine implementation baseline and must remain pure and deterministic.
- `packages/core` remains useful reference behavior but is not the active MVP implementation surface unless a task is explicitly migration- or parity-scoped.
- `apps/web` owns auth, sessions, request handling, rate limiting, security headers, persistence, RLS-backed enforcement, and unit conversion before engine invocation.
- `packages/contracts` is a TypeScript boundary adapter, not the long-term canonical cross-language engine schema.
- `users.stats_json` is an app persistence shape. It is not the canonical engine state model.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Product shell | Next.js 15 (App Router, standalone output, typed routes) |
| Auth/DB | Supabase via `@supabase/ssr` (cookie-based sessions) |
| Validation/adapters | Zod in `packages/contracts` |
| Accepted engine MVP baseline | Rust in `packages/engine-rs` |
| Legacy reference engine | TypeScript in `packages/core` |
| Testing | Vitest + `@testing-library/react` + jsdom + Playwright |
| Runtime | TypeScript 5.4, ES2022 target |

## Path Aliases

| Alias | Resolves To |
|-------|-------------|
| `@adaptabuddy/contracts` | `packages/contracts/src` |
| `@adaptabuddy/core` | `packages/core/src` |
| `@/*` | `apps/web/src/*` |

## Environment Setup

Copy `.env.example` to `.env` (or `.env.local`) at repo root:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
RUN_SUPABASE_E2E_VERIFICATION=0
SUPABASE_TEST_EMAIL=test@example.com
SUPABASE_TEST_PASSWORD=your-test-password
RUN_PLAYWRIGHT_E2E=0
```

Environment validation lives in `apps/web/src/lib/env.ts`.

## Python Helpers (`scripts/python_helper`)

- Use `uv` with explicit project and Python flags: `--project scripts/python_helper --python 3.13`
- Python helpers are pinned to Python `3.13`
- For Python helper and `uv` workflow changes, fetch latest docs through Context7 MCP first; if unavailable, document the blocker and fall back to official primary docs

## GitNexus Working Context

- Treat the generated GitNexus block near the end of this file as tool-owned context; keep durable human-authored guidance outside that block so future `gitnexus analyze` runs do not wipe it.
- To refresh code intelligence from the repo root, run `gitnexus analyze --force`. If the global CLI is unavailable, use `npx gitnexus analyze --force`.
- After refreshing, verify the indexed repo with GitNexus `list_repos`, then use the MCP tools for context and impact work: `query`, `context`, `impact`, `detect_changes`, `cypher`, `rename`, `route_map`, `api_impact`, `shape_check`, `tool_map`, `group_list`, and `group_sync`.
- Preserve `.gitnexus/` and `.claude/skills/generated/*` as generated tool context. Preserve `specs/hippocampus/*` and `docs/hippocampus/*` as durable handoff/status memory.

## Non-Negotiable Rules

1. Auth stays in cookies only. Never move auth or sensitive state into localStorage or sessionStorage.
2. Every external input is validated at the app edge before it reaches engine or persistence code.
3. Only `NEXT_PUBLIC_*` values may reach client bundles.
4. Assume RLS enforcement in the app persistence layer. Do not bypass ownership checks.
5. Engine logic stays pure and deterministic. No implicit randomness, clocks, or IO.
6. Do not treat Zod or `users.stats_json` as the canonical cross-language engine model.
7. Do not mutate existing plans without explicit confirmation.

## Engine-First Workflow

When adding or changing behavior, use this order unless the task explicitly says otherwise:

1. Define or revise the engine boundary contract.
2. Define invariants, deterministic fixtures, and replay expectations.
3. Update the pure engine spec or implementation in `packages/engine-rs` for the accepted MVP baseline; use `packages/core` only when a task is explicitly migration- or parity-scoped.
4. Add or revise adapter contracts in `packages/contracts` only after engine behavior is settled.
5. Add app/API/UI integration in `apps/web` only if it is explicitly in scope.

This repository now prefers clean architectural boundaries over convenience-driven coupling.

## Testing Expectations

| Scope | Requirement |
|-------|-------------|
| Engine contract/spec work | Add deterministic fixtures, invariant checks, or replay-oriented tests where applicable |
| Engine implementation changes | Add or update golden or determinism tests |
| Adapter/API shape changes | Update TypeScript contracts and add schema smoke tests |
| Product-shell changes | Run `npm run typecheck`, `npm run lint`, `npm run test`, and `cd apps/web && npm run build` before completion |
| Live Supabase E2E | Manual `apps/web` pre-release verification only |
| Browser E2E | Manual-only and uses live Supabase test credentials |

## Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| DB rows leaking into engine contracts | Use normalized domain snapshots and stable string identifiers at the boundary |
| Treating `stats_json` as the engine model | Document it as an app persistence shape only |
| Implicit seeds or clocks | Require explicit seed and caller-supplied time inputs |
| Freeform explanations with no replay value | Prefer structured decision logs with typed fields |
| Server env leaks | Never import non-`NEXT_PUBLIC_*` vars in client components |

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

## Database (`packages/db/`)

`packages/db` is a documentation-only package for the app persistence layer. It records SQL migrations, schema notes, and operational history for the Supabase-backed product shell.

Current persistence notes:
- Supabase project ID: `vezfyhbrrpokheqipepa`
- `users.stats_json` currently stores app-managed workout state and preferences
- `workout_logs` and `set_logs` provide queryable history

Important boundary clarification:
- Persistence shapes exist to support the current app shell.
- They should not be treated as the canonical long-term engine input or output contract.

## Current Engine Families (`packages/core/src/engine/`)

Current engine areas include:
- Candidate scoring and slot filling
- Session generation
- Fatigue and recovery math
- Progression logic
- Completion/state transition math
- Volume allocation
- Template resolution
- Chaos planning
- Deviation analysis
- Guardrail evaluation
- Deterministic RNG and constraint evaluation

These current TypeScript engines are the reference behavior for the engine-first roadmap. They are not proof that the future standalone engine boundary is already fully specified.

## apps/web Runtime Surface

The product shell currently includes:
- Auth routes and session handling
- Workout generation/logging/history flows
- Onboarding, settings, and dashboard surfaces
- API routes with edge validation, rate limiting, and security headers
- Deployment smoke, observability, and release runbook support

Treat this as the integration surface around the engine, not the primary architecture story.

## Planned Next Work

Primary next milestones are defined in `specs/overall_plan.md`:
- Wave 2 is complete: `initialize_cycle`, normalized cycle persistence, and cycle-backed app integration
- Wave 3 is complete and archived through `engine_14`
- Wave 4 explainability/reporting boundary is complete and archived as `engine_15`
- Wave 4 operational/release hardening is complete and archived as `docs/archive/specs/engine_16_operational_release_hardening.md`
- Wave 4 user-facing explanation consumers are complete and archived as `docs/archive/specs/engine_17_user_facing_explanation_consumers.md`
- Wave 4 deterministic analytics read models are complete and archived as `docs/archive/specs/engine_18_deterministic_analytics_read_models.md`
- Wave 4 dashboard analytics consumer migration is complete and archived as `docs/archive/specs/engine_19_dashboard_analytics_consumer_migration.md`
- Wave 4 remaining dashboard analytics read models are complete and archived as `docs/archive/specs/engine_20_dashboard_remaining_analytics_read_models.md`
- Wave 4 broader analytics API endpoint is complete and archived as `docs/archive/specs/engine_21_analytics_api_endpoint.md`
- Engine 22 canonical replay serialization and numeric policy is complete and archived as `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`
- Wave 5 private beta release evidence is complete and archived as `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
- Engine 28 cross-language replay certification is complete and archived as `docs/archive/specs/engine_28_cross_language_replay_certification.md`
- Engine 29 pre-beta Playwright E2E hardening is complete and archived under `docs/archive/specs/engine_29_pre_beta_playwright_e2e_hardening.md`

Historical completed specs live under:
- `docs/archive/specs/`

Active and planned specs live under:
- `docs/specs/`

Explicitly unresolved architecture risks:
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
