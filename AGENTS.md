# AdaptaBuddy vNext Agent Guide

`CLAUDE.md` is the canonical process source for this repository. This file mirrors it for agent consumption and should not introduce competing architecture direction.

## Current Direction

Purpose: build the mobile + Rust backend MVP.

```text
Kotlin Android app
        |
        v
Rust API backend
        |
        v
Supabase Auth + Postgres
```

Canonical references:

- Architecture: `docs/architecture.md`
- Backend overview: `docs/architecture/backend-overview.md`
- Service boundaries: `docs/architecture/service-boundaries.md`
- Android MVP plan: `docs/architecture/mobile-android-mvp.md`
- Security posture: `docs/security/mobile-auth-api-security.md`
- API contracts: `docs/api/api-contracts.md`
- Data model: `docs/data/data-model.md`
- Active plan: `specs/overall_plan.md`

## Commands

```bash
# Install dependencies
npm install

# Local Supabase
npx supabase status
make supabase-start
make supabase-reset

# Rust API
make dev-api

# Rust backend quality gate
cargo fmt --manifest-path backend/Cargo.toml --all
cargo check --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path backend/Cargo.toml

# Supabase validation
npx supabase db reset
npx supabase db lint --local --fail-on warning
```

## Architecture Split

```text
backend/       Rust Axum modular monolith and API source of truth
mobile/        Android-first mobile workstream
supabase/      Local Supabase config, migrations, seed data, and SQL checks
migrations/    Migration stream notes
docs/          Current MVP architecture, product, API, data, and security docs
```

## Boundary Rules

- `/api/v0/me/...` is the canonical mobile/client API namespace.
- Mobile clients authenticate with Supabase Auth and send the Supabase access JWT to Rust.
- Rust validates JWTs on every protected route and attaches typed auth context.
- Protected routes must use auth context ownership, not client-supplied owner IDs.
- Mobile may hold the Supabase project URL and publishable key.
- Mobile must never hold service-role keys, JWT secrets, database passwords, webhook secrets, or admin credentials.
- RLS is required for directly exposed user-owned tables.
- RPG, Unity, iOS, web, and admin surfaces are deferred.

## Service Boundaries

- Auth/API security owns JWT validation, route classes, and auth context.
- User engine owns profile, body stats, exercise stats, muscle group summaries, and stat prompts.
- Food engine owns diary entries, meal metadata, macros, nutrition targets, and BMR estimates.
- Workout generation owns v0 plan/day/exercise creation.
- Workout completion owns session lifecycle, exercise completion status, XP awards, and stat update hooks.
- RPG remains deferred and must not block mobile health workflows.

## Non-Negotiable Rules

1. Keep server secrets out of mobile and client bundles.
2. Validate external inputs at the API edge.
3. Validate Supabase JWTs before protected route handling.
4. Use auth context ownership instead of client-supplied owner IDs.
5. Preserve RLS for directly exposed tables.
6. Keep Rust backend logic server-authoritative.
7. Keep mobile simple and MVP-focused.

## Testing Expectations

| Scope | Requirement |
| --- | --- |
| Rust backend changes | Run `cargo fmt`, `cargo check`, `cargo clippy`, and `cargo test` for `backend/Cargo.toml` |
| Auth/API changes | Add or update route boundary and ownership tests |
| Storage/migration changes | Validate local Supabase migrations and RLS when CLI is available |
| Docs-only cleanup | Run stale-reference searches and `git status` |

## Current Next Pass

Harden the authenticated Android Home dashboard and complete the Habits, Add, Workout, and Food flows against `/api/v0/me/...`.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **adaptabuddy_v2** (7555 symbols, 12848 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/adaptabuddy_v2/context` | Codebase overview, check index freshness |
| `gitnexus://repo/adaptabuddy_v2/clusters` | All functional areas |
| `gitnexus://repo/adaptabuddy_v2/processes` | All execution flows |
| `gitnexus://repo/adaptabuddy_v2/process/{name}` | Step-by-step execution trace |

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
