# Engine 16 Hippocampus

## Status

- `complete`

## Scope snapshot

- Completed numbered spec: `docs/archive/specs/engine_16_operational_release_hardening.md`
- Completed Wave 4 read-model boundary:
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
- Historical operationalization inputs:
  - `docs/archive/specs/18_backend_reliability_hardening.md`
  - `docs/archive/specs/19_observability_runtime_implementation.md`
  - `docs/archive/specs/20_api_consistency_cleanup.md`
  - `docs/operations/release_operations_runbook.md`
  - `docs/operations/observability_baseline.md`

## Intent

- Continue Wave 4 with an app-shell operational/release hardening boundary.
- Keep `EngineInputV1`, `EngineOutputV1`, `decisionLog`, and `replayReceipt` unchanged.
- Freeze how `apps/web` should be verified, observed, promoted, and rolled back now that the Rust-backed engine flows and `engine_15` read-model boundary are live.

## Implemented so far

- The canonical Wave 4 operational boundary is archived under `docs/archive/specs/engine_16_operational_release_hardening.md`.
- `docs/operations/release_operations_runbook.md`, `docs/operations/deployment_verification_checklist.md`, and `docs/operations/observability_baseline.md` now align to one release policy.
- `npm run verify:deploy:smoke` now enforces the `/api/health` header contract in addition to payload shape.
- Health-route regression coverage now pins `x-request-id` echo and `Cache-Control: no-store`.
- Live Supabase remains manual/gated release-confidence evidence, while Playwright remains manual and optional.

## Verified commands

- `npm run test --workspace apps/web -- tests/verify-deploy-smoke.test.ts`
- `npm run test --workspace apps/web -- tests/ui-production-hardening.test.tsx`
- `npm run test --workspace apps/web -- tests/api-observability.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

## Runtime truth

- Broad repo verification remains the default green lane:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `cd apps/web && npm run build`
- The gated live Supabase lane remains manual:
  - `RUN_SUPABASE_E2E_VERIFICATION=1 npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts`
- `npm run verify:deploy:smoke` is required release/deploy evidence.
- Playwright browser E2E remains manual and optional:
  - `npm run test:e2e:playwright`

## Boundary guardrails

- No new engine-envelope fields are introduced in Engine 16.
- Release verification, observability, promotion, and rollback remain app-shell-owned.
- Live Supabase verification remains release-confidence evidence, not a default green-lane prerequisite.
- User-facing explanation/reporting expansion and analytics remain later follow-on work.

## Next exact action

- No further Engine 16 implementation is required for closure of this boundary. Later Wave 4 work remains explanation-consumer and analytics expansion.

## Handoff log

- `2026-04-22`: Archived the completed Engine 16 spec under `docs/archive/specs/engine_16_operational_release_hardening.md`.
- `2026-04-22`: Aligned release operations, deployment verification, and observability docs to one canonical Engine 16 policy.
- `2026-04-22`: Extended deploy smoke verification to require `/api/health` request-correlation and no-store headers.
- `2026-04-22`: Added release-hardening regression coverage for deploy smoke verification and health-route response guarantees.
