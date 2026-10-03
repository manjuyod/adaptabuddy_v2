# CLAUDE.md

This file is the canonical process and architecture guide for agents working in this repository.

## Current Direction

Adaptabuddy is focused on a concrete mobile + Rust backend MVP:

```text
Kotlin Android app
        |
        v
Rust API backend
        |
        v
Supabase Auth + Postgres
```

The Rust API is the source of truth for business logic. Supabase provides identity and durable storage. Android is the first client surface; iOS, Unity/RPG, web, and admin surfaces are deferred.

Canonical references:

- Architecture: `docs/architecture.md`
- Backend overview: `docs/architecture/backend-overview.md`
- Service boundaries: `docs/architecture/service-boundaries.md`
- Android MVP plan: `docs/architecture/mobile-android-mvp.md`
- Security posture: `docs/security/mobile-auth-api-security.md`
- Product scope: `docs/product/mvp-scope.md`
- Roadmap: `docs/product/roadmap.md`
- API contracts: `docs/api/api-contracts.md`
- Data model: `docs/data/data-model.md`
- Active plan: `specs/overall_plan.md`

## Build, Dev, And Test Commands

```bash
# Install repository dependencies
npm install

# Start local Supabase after installing the Supabase CLI
npx supabase status
make supabase-start
make supabase-reset

# Run the Rust API
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

Use live or remote Supabase only when the task explicitly requires it. Local development should prefer the local Supabase stack.

## Architecture

```text
backend/       Rust Axum modular monolith and API source of truth
mobile/        Kotlin/Jetpack Compose Android app with Supabase Auth and Home dashboard
supabase/      Local Supabase config, migrations, seed data, and SQL checks
migrations/    Migration stream notes
docs/          Current MVP architecture, product, API, data, and security docs
```

Rust crates are internal module boundaries, not deployable service boundaries. Keep the MVP as one backend deployable unless operational pressure proves a split is needed.

## API And Auth Rules

- `/api/v0/me/...` is the canonical mobile/client API namespace.
- Mobile clients authenticate with Supabase Auth and send the Supabase access JWT to Rust as `Authorization: Bearer <token>`.
- Rust validates access JWTs on protected routes and attaches typed auth context.
- Protected routes must use auth context ownership. Do not trust client-supplied owner IDs.
- Mobile may hold the Supabase project URL and publishable key.
- Mobile must never hold service-role keys, JWT secrets, database passwords, webhook secrets, or admin credentials.
- Admin/service operations stay server-only.
- Direct mobile table access is allowed only for intentionally exposed tables with RLS enabled and reviewed.
- Route classes are explicit: `public`, `user`, `internal`, and `webhook`.

## MVP Service Boundaries

- Auth/API security owns JWT validation, route class enforcement, and auth context.
- User engine owns profile, body stats, exercise stats, muscle group summaries, and stat prompts.
- Food engine owns food diary entries, meal type metadata, macros, nutrition targets, and BMR estimates.
- Workout generation engine owns v0 plan/day/exercise creation.
- Workout completion engine owns session lifecycle, exercise completion status, XP awards, and stat update hooks.
- RPG support is deferred and must not block mobile health workflows.

## Data Rules

- User-owned rows include an owner field such as `user_id`.
- RLS is required for any table directly exposed to Supabase clients.
- Backend-only tables should still carry owner IDs for clarity and defense in depth.
- Authorization roles must not live in user-editable profile fields.
- Index common query paths by owner, dates, plan/session IDs, meal type, and creation timestamps.

## Android Direction

Android uses a five-item bottom navigation:

1. Home
2. Habits
3. Add
4. Workout
5. Food

Use a top-right overflow menu for account, settings, extra items, future RPG toggle, and developer/debug information. Mock data is acceptable only when backend endpoints do not exist yet, and it must be clearly marked.

## Non-Negotiable Rules

1. Keep server secrets out of mobile and client bundles.
2. Validate external inputs at the API edge.
3. Validate Supabase JWTs before protected route handling.
4. Use auth context ownership instead of client-supplied owner IDs.
5. Preserve RLS for directly exposed tables.
6. Keep Rust backend logic server-authoritative.
7. Keep RPG features deferred from the mobile health MVP.
8. Prefer small, reviewable vertical slices over broad ecosystem work.

## Testing Expectations

| Scope | Requirement |
| --- | --- |
| Rust backend changes | Run `cargo fmt`, `cargo check`, `cargo clippy`, and `cargo test` for `backend/Cargo.toml` |
| Auth/API changes | Add or update route boundary and ownership tests |
| Storage/migration changes | Validate local Supabase migrations and RLS when CLI is available |
| Android docs/planning | Keep `mobile/README.md`, `docs/architecture/mobile-android-mvp.md`, and `docs/api/api-contracts.md` aligned |
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
