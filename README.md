# AdaptaBuddy vNext

Engine-first training decision system with a Next.js/Supabase product shell. The primary technical focus is the deterministic Rust engine boundary, decision model, and replayable rule system that the app shell orchestrates around.

## Current Direction

The repository is already operating on an engine-first roadmap, with the standalone Rust engine as the accepted MVP baseline and `apps/web` as the current product shell.

- `packages/engine-rs` is the accepted deterministic engine implementation baseline for `initialize_cycle`, `plan_session`, and `complete_session`.
- `packages/core` remains legacy TypeScript reference behavior, not the primary implementation surface unless a task is explicitly migration- or parity-scoped.
- `packages/contracts` contains TypeScript-side boundary schemas and adapter contracts. These are important, but they are not the long-term canonical cross-language engine schema.
- `apps/web` remains the product shell: auth, UI, DB access, orchestration, and release/runtime operations.

Canonical architecture reference:
- `docs/architecture/engine_first_architecture.md`

Active roadmap reference:
- `specs/overall_plan.md`

Active engine spec queue:
- Active numbered engine spec: none currently documented
- Latest completed spec: `docs/archive/specs/engine_28_cross_language_replay_certification.md`

Current launch lane:
- `Production Beta Readiness` for `apps/web`, using the release runbook under `docs/operations/`; the latest candidate remains `HOLD` until immutable commit metadata, owner assignments, and audit disposition are resolved.

## Architecture Split

```text
apps/web/            auth/UI/DB/orchestration shell
packages/engine-rs/  accepted Rust MVP engine baseline
packages/core/       legacy TypeScript decision logic retained as reference
packages/contracts/  boundary schemas and TypeScript adapters
packages/db/         SQL and schema notes for the app persistence layer
```

Boundary rules:
- The engine consumes normalized domain snapshots, not DB rows.
- The engine uses stable string identifiers or slugs at the boundary, not Supabase integer primary keys.
- The app owns auth, sessions, API transport, persistence, security headers, rate limiting, and RLS-backed enforcement.
- The app converts units and assembles engine input snapshots before invocation.
- The engine owns deterministic scoring, constraints, recovery budgeting, seeded sampling, completion math, and structured decision traces.

## Engine-First Priorities

Primary work now follows this order:

1. Define or revise the engine boundary contract.
2. Define invariants, deterministic fixtures, and replay expectations.
3. Update the pure engine spec or implementation in `packages/engine-rs`.
4. Update TypeScript adapter contracts only after engine behavior is settled.
5. Add app-shell integration only when it is explicitly in scope.

See `specs/overall_plan.md` for the phase-by-phase roadmap and acceptance criteria.

## Engine Scope

The future standalone engine is intended to own:
- Candidate generation
- Hard-constraint filtering
- Soft scoring and ranking
- Recovery and fatigue budgeting
- Seeded deterministic selection
- Raw structured workout output generation
- Deterministic state patches
- Structured decision logging and replay receipts

The engine is not intended to own:
- Auth or session handling
- UI rendering or frontend state
- Direct DB access
- Supabase clients or transport concerns
- API wrapper responses
- Persistence-specific storage shapes such as `users.stats_json`

## Status Snapshot

What already exists in the repo:
- Deterministic Rust engine operations under `packages/engine-rs/`
- Deterministic TypeScript reference engines under `packages/core/src/engine/`
- TypeScript/Zod contracts under `packages/contracts/src/`
- A production-oriented Next.js/Supabase app shell under `apps/web`
- Web release and operational docs under `docs/operations/`

How to interpret that status after the pivot:
- Existing web and release work is historical delivery context, not the primary forward roadmap.
- Existing contracts and engine code are reference material for the new boundary definition, not proof that the long-term engine contract is already settled.

## Historical Product-Shell Work

Completed app-shell work remains relevant as downstream context:
- Auth/login consolidation at `/login`
- Dashboard, onboarding, workout, history, and settings flows
- PWA, offline shell, loading and error surfaces
- CI quality gates, deployment smoke checks, observability baseline, and release runbooks

Those items are preserved as historical and operational context. They no longer define the main project direction.

Historical completed specs now live under:
- `docs/archive/specs/`

## apps/web Operations

The following docs apply to the deployed `apps/web` runtime only:
- `docs/operations/deployment_verification_checklist.md`
- `docs/operations/observability_baseline.md`
- `docs/operations/release_operations_runbook.md`

These documents are intentionally scoped to the web shell and should not be treated as the canonical engine architecture source.

## Quickstart

```bash
# Install dependencies
npm install

# Run the web shell locally
npm run dev

# Repository quality checks
npm run typecheck
npm run lint
npm run test
cd apps/web && npm run build
```

## Next Milestones

Immediate roadmap focus:
- Wave 4 explainability, analytics, and operationalization is complete through `docs/archive/specs/engine_21_analytics_api_endpoint.md`.
- Engine 22 canonical replay serialization and numeric policy is complete and archived under `docs/archive/specs/`.
- Engine 23 app replay invocation alignment and Engine 24 replay bundle evidence are complete and archived under `docs/archive/specs/`.
- Engine 25 `stats_json` compatibility sunset mapping is complete and archived under `docs/archive/specs/`.
- Engine 26 cycle/session orchestration reliability hardening is complete and archived under `docs/archive/specs/`.
- Engine 27 private beta release evidence pack is complete and archived under `docs/archive/specs/`.
- Engine 28 cross-language replay certification is complete and archived under `docs/archive/specs/`.
- The immediate launch focus is resolving private beta promotion blockers for `apps/web`: immutable candidate metadata, owner signoff, and audit disposition.

Open architecture risks that remain explicit:
- Whether the engine should emit only deterministic state patches or patches plus append-only events
- How mixed app-owned versus engine-owned data should be separated over time from current persistence shapes
