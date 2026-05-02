# Operational Release Hardening

## Goal

Define the next Wave 4 boundary revision as an app-shell operational and release-hardening contract for `apps/web`, built on the stable engine-owned cycle model and the completed `engine_15` explainability/reporting read-model boundary.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
  - `docs/archive/specs/18_backend_reliability_hardening.md`
  - `docs/archive/specs/19_observability_runtime_implementation.md`
  - `docs/archive/specs/20_api_consistency_cleanup.md`
  - `docs/operations/release_operations_runbook.md`
  - `docs/operations/observability_baseline.md`

## Current Baseline

This boundary is implemented and aligned in the app shell.

The broad default green lane is:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

The release/deploy smoke verifier is now part of the executable contract:
- `npm run verify:deploy:smoke`
- validates `/offline`
- validates `/api/health`
- validates health payload fields `status`, `timestamp`, and `supabase`
- validates health response correlation via `x-request-id`
- validates `Cache-Control: no-store` on `/api/health`

Live Supabase verification remains a manual gated lane:
- `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`

Playwright browser E2E remains manual and optional release-confidence evidence:
- `npm run test:e2e:playwright`

The aligned operational docs are:
- `docs/operations/release_operations_runbook.md`
- `docs/operations/deployment_verification_checklist.md`
- `docs/operations/observability_baseline.md`

## Problem Statement

The engine-facing decision surface and the app-owned explanation/reporting boundary are both in place, but Wave 4 still lacks a single canonical spec for how `apps/web` should be hardened and operated in release conditions.

Current limitations:
- release verification expectations are spread across implementation history and operations runbooks instead of one active numbered spec
- live Supabase verification is documented and available, but the current roadmap does not yet freeze how it should be treated as gated evidence versus default CI
- observability and release triage expectations exist, but they are not yet framed as the active Wave 4 operationalization boundary
- rollout and rollback expectations for engine-backed session flows need a single current spec reference now that `initialize_cycle`, `plan_session`, `complete_session`, and `engine_15` read models are all live in the app shell

The next step should not reopen the engine contract. It should close the app-shell operational boundary around verification, observability, promotion, and rollback expectations.

## Boundary Decision

Wave 4 continues with an app-shell operationalization spec, not an engine-envelope revision.

This spec keeps unchanged:
- `EngineInputV1`
- `EngineOutputV1`
- public Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- public `decisionLog` semantics
- public `replayReceipt` semantics
- the completed `engine_15` app-owned explainability/reporting read-model contract

This spec defines:
- the canonical release-verification and promotion expectations for `apps/web`
- the operational role of live Supabase verification and deploy smoke verification
- the observability and rollback expectations for engine-backed app-shell runtime flows
- the rules future release/ops work must follow without pushing operational requirements back into the engine boundary

This spec does not define:
- new engine output fields
- new score families
- new replay-receipt fields
- analytics expansion
- new user-facing explanation/reporting surfaces unless required as operational evidence

## Operational Input Rules

The canonical operational inputs for this Wave 4 slice are:
- broad repo quality gates:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `cd apps/web && npm run build`
- deploy smoke verification:
  - `npm run verify:deploy:smoke`
  - verifies `/offline`, `/api/health`, health payload shape, `x-request-id`, and `Cache-Control: no-store`
- live Supabase verification:
  - `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- optional manual browser verification:
  - `npm run test:e2e:playwright`
- release and observability runbooks:
  - `docs/operations/release_operations_runbook.md`
  - `docs/operations/deployment_verification_checklist.md`
  - `docs/operations/observability_baseline.md`
- structured logging and request-correlation behavior already implemented in `apps/web`

Input ownership rules:
- operational verification remains app-shell-owned, not engine-owned
- deploy, promotion, rollback, and observability policies are runtime/ops concerns and must not widen the engine envelope
- live Supabase verification remains release-confidence evidence, not a default green-lane prerequisite
- Playwright remains optional/manual release-confidence evidence rather than a hard promotion gate for this boundary

## Operational Output Rules

Wave 4 operational outputs are app-shell rules and evidence expectations.

Required output categories:
- release gate expectations for candidate validation and promotion eligibility
- deploy smoke and post-release validation expectations for critical `apps/web` routes and flows
- live Supabase verification policy and evidence capture rules
- observability expectations for route correlation, error classification, and triage paths
- rollback trigger and ownership expectations for degraded release candidates

Rules:
- operational logic must remain app-owned and must not redefine engine semantics
- release evidence may reference replay/debug artifacts where useful, but must not require new engine fields
- observability and rollback guidance must cover engine-backed session flows as deployed app behavior, not as separate engine-runtime infrastructure
- manual release-confidence lanes must stay explicitly distinguished from default CI/green-lane requirements

## Interface And Integration Rules

This spec introduces a new kind of public interface inside the app shell:
- a canonical release/verification contract for `apps/web`
- a canonical observability and rollback contract for engine-backed web-shell runtime behavior

Integration rules:
- future release docs and runbooks must align with this numbered spec instead of drifting into parallel process sources
- app-shell runtime checks must consume existing structured logging, health, smoke, and verification surfaces rather than inventing engine-specific operational contracts
- any operational debugging use of `decisionLog` or `replayReceipt` must remain app-owned and read-model-compatible

## Verification And Acceptance Rules

This boundary is now closed by:
- explicit release gate alignment between this numbered spec and the existing runbooks
- explicit live Supabase/manual verification policy and evidence capture guidance
- explicit rollback and promotion decision rules for `apps/web`
- explicit observability ownership and first-response paths for engine-backed runtime flows
- executable smoke-verifier and health-route regression coverage for the release contract
- confirmation that broad repo verification remains the default green lane, live Supabase remains manual/gated, and Playwright remains manual/optional

Execution-side verification rules remain:
- keep the broad repo lane green:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `cd apps/web && npm run build`
- keep deploy smoke verification required for release/deploy evidence:
  1. run `npm run verify:deploy:smoke`
  2. require `/offline` and `/api/health` to pass
  3. require the health payload contract to pass
  4. require `x-request-id` and `Cache-Control: no-store` on `/api/health`
- keep live Supabase verification manual and gated:
  1. confirm env parity for `SUPABASE_URL`, anon key, and service-role key
  2. confirm target project matches the release target
  3. run `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
  4. capture pass/fail and any environmental blocker in the release record
- keep Playwright manual and optional:
  1. run `npm run test:e2e:playwright` only when the release owner wants browser confidence coverage
  2. capture pass/fail if run, but do not treat it as a default green-lane or hard promotion requirement for this spec

## Out Of Scope

This spec does not:
- revise score families or ranking policy
- reopen `decisionLog` or `replayReceipt` semantics
- add fields to `EngineInputV1` or `EngineOutputV1`
- make DB rows or query layouts canonical engine boundary material
- define analytics expansion as the next Wave 4 slice
- define new user-facing explanation/reporting surfaces unless operational evidence requires a minimal consumer

## Deferred Risks And Follow-Up

- future user-facing cycle explanation expansion beyond the current `engine_15` consumers
- future analytics/reporting surfaces derived from normalized cycle/session state
- long-term reduction of compatibility-only summaries still sourced from `users.stats_json`
- any later engine-boundary revision needed for numeric policy, canonical serialization, or events-versus-patches

## Completion Note

Engine 16 is complete as a Wave 4 app-shell operationalization boundary.

This completion means:
- the release, smoke, observability, promotion, and rollback contract for `apps/web` is now canonical and aligned to one archived numbered spec
- the deploy smoke verifier and health-route contract are covered by regression tests instead of prose alone
- future Wave 4 work can focus on later explanation-consumer or analytics expansion without reopening the engine envelope or the release-hardening boundary
