# Engine 27: Private Beta Release Evidence Pack

## Goal

Convert the active Production Beta Readiness lane into an executable evidence pack that ties release operations to the Engine 23-26 hardening work.

This spec does not reopen engine architecture. It defines the evidence required to decide whether a private beta candidate can ship.

## Status

- `State`: Complete
- `Priority`: Critical
- `Depends On`:
  - `docs/operations/release_operations_runbook.md`
  - `docs/operations/deployment_verification_checklist.md`
  - `docs/operations/observability_baseline.md`
  - `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
  - `docs/archive/specs/engine_24_replay_bundle_and_beta_debug_evidence.md`
  - `docs/archive/specs/engine_26_cycle_session_orchestration_reliability_hardening.md`

## GitNexus Grounding

GitNexus context used for this spec:

- `/api/v0/sessions/generate` and `/api/v0/sessions/complete` are the beta-critical workout route flows.
- `/api/v0/reporting/analytics` exposes deterministic analytics read models and currently has no direct consumers in the route map.
- `handleInitializeCycle`, `handleGenerateSession`, and `handleCompleteSession` are the app-owned runtime bridge into `runEngineInput`.
- `getDeterministicAnalyticsReadModel` is the current normalized analytics read-model entry point.
- `EngineInputV1` and `EngineOutputV1` are CRITICAL if changed, so release evidence must validate current behavior rather than expand boundary scope during beta promotion.

## Boundary Decision

Engine 27 is a release evidence and operations spec.

This spec keeps unchanged:

- Rust engine operations and envelopes
- app auth and RLS assumptions
- manual live Supabase and Playwright lanes from the release runbook
- Engine 23-26 implementation decisions

This spec defines:

- the private-beta candidate evidence pack
- owner sign-off inputs
- required command outputs and smoke artifacts
- route-level beta journey evidence
- how replay/debug evidence is captured for launch triage

## Evidence Pack

Each private beta release candidate must record:

- commit SHA and release candidate identifier
- quality gate results
- app production build result
- Docker build and runtime smoke result
- local deployment smoke result
- live Supabase E2E result
- optional Playwright journey result, if run
- environment readiness result
- migration parity check result
- replay invocation alignment status from Engine 23
- beta debug evidence status from Engine 24
- orchestration reliability status from Engine 26
- known or resolved `stats_json` compatibility status from completed Engine 25
- release owner, environment owner, rollback owner, and final decision

## Implementation Direction

- Add a release evidence template or script output that mirrors the runbook and private beta release record.
- Link route-level smoke checks to `/api/health`, `/offline`, `/api/v0/sessions/generate`, `/api/v0/sessions/complete`, and `/api/v0/reporting/analytics` where credentials and environment allow.
- Require owner sign-off to include any Engine 23-26 open exceptions.
- Keep live Supabase verification manual and gated. Do not make it default CI.
- Record failures as release blockers or accepted risks, not informal notes.

## Verification And Acceptance Rules

Implementation acceptance requires:

- evidence template or command output checked into operations docs
- tests or smoke verifier coverage where feasible without live secrets
- documented manual steps for live Supabase and optional browser verification
- a private beta release record proving the evidence pack was filled for a candidate
- no engine boundary changes

Execution-side verification:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build --workspace apps/web`
- `npm run verify:deploy:smoke`
- Docker smoke from `docs/operations/release_operations_runbook.md`
- manual live Supabase E2E before promotion

## Completion Target

Engine 27 closes when private beta release decision evidence is backed by a complete release evidence pack that ties app quality gates, deployment smoke, live Supabase verification, and replay/orchestration confidence into one owner-signed record.

## Completion Record

Closed with release-confidence evidence captured at `2026-05-02T06:12:04Z`.

Accepted evidence:

- Docker version/context passed with `desktop-linux` on `linux/amd64`.
- `docker build --secret id=build_env,src=.env -t adaptabuddy-web:engine-27-smoke .` passed.
- Docker runtime on `http://127.0.0.1:3001` passed.
- `npm run verify:deploy:smoke -- http://127.0.0.1:3001` passed.
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts` passed `1/1` after live DB migrations.
- `RUN_PLAYWRIGHT_E2E=1 npm run test:e2e:playwright` passed `3/3`.
- Signed-in browser `GET /api/v0/reporting/analytics` returned HTTP `200`, body `status:"success"`, `availability:"unavailable"`, `analyticsPresent:false`, `Cache-Control: no-store`, and `x-request-id` present.
- Previous baseline quality gates were green: `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build --workspace apps/web`.
- Live Supabase migration list includes numbered migrations `017_engine_15_session_traces` and `018_engine_24_replay_debug_input_material`, plus live parity repair/hardening migrations `engine_session_trace_live_parity` and `restrict_complete_session_atomic_execute`.
- Deoxys confirmed `engine_session_traces.input_material` exists; authenticated has SELECT only on `engine_session_traces`; `complete_session_atomic` execute grants are `anon=false`, `authenticated=false`, `service_role=true`.

Final decision:

- Engine 27 implementation acceptance is complete.
- Release promotion remains `HOLD` because git HEAD was unavailable/no commits, candidate metadata remains local-working-tree/unavailable, owners are unassigned, and audit disposition is not recorded.
