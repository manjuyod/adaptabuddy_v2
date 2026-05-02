# Engine 24: Replay Bundle And Beta Debug Evidence

## Goal

Define the app-owned replay bundle and debug evidence required to triage private-beta engine decisions without widening the Rust engine envelope.

Engine 22 made Rust replay hashes canonical. Engine 23 aligns app invocation. Engine 24 makes the resulting evidence discoverable, redacted, and useful for beta support.

## Status

- `State`: Complete
- `Priority`: High
- `Depends On`:
  - `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
  - `docs/archive/specs/engine_15_explainability_and_reporting_read_models.md`
  - `docs/archive/specs/engine_21_analytics_api_endpoint.md`
  - `docs/operations/release_operations_runbook.md`

## GitNexus Grounding

GitNexus and repo inspection identify the current evidence path:

- `persistEngineSessionTrace` writes app-owned trace rows for `plan_session` and `complete_session`.
- `engine_session_traces` stores `decision_log`, `replay_receipt`, and `engine_result`, but not a complete replay-bundle contract.
- `derivePlanSessionExplanation`, `deriveWorkoutCompletionExplanation`, and `getWorkoutCompletionReadModels` consume stored trace material for user-facing explanation and history read models.
- `handleGenerateSession` persists plan traces after Rust `plan_session`.
- `handleCompleteSession` persists completion traces through `complete_session_atomic` or follow-up trace persistence.
- `/api/v0/reporting/analytics` currently has no direct consumers in GitNexus route maps, which makes it safe to extend beta debug read models behind a deliberately scoped endpoint or internal service.

## Boundary Decision

Engine 24 is an app reporting and operations slice.

This spec keeps unchanged:

- Rust engine public envelopes and operations
- replay hash field membership from Engine 22
- `decisionLog` semantics
- current user-facing explanation copy unless required by redaction or evidence linking

This spec defines:

- the minimum app-owned replay bundle for beta triage
- redaction rules for user-entered text and personally identifying metadata
- how trace rows connect to cycle plans, cycle sessions, workout logs, request IDs, and replay receipts
- how beta support can distinguish app orchestration defects from canonical engine replay defects

## Replay Bundle Contract

The beta replay bundle should contain:

- operation name
- schema version
- canonicalization version
- rule version
- reference hash
- replay receipt
- engine result
- decision log
- cycle plan ID when available
- cycle session ID when available
- workout log ID when available
- app request or trace correlation ID
- a redacted pointer to the exact app-built engine input material, or a stored redacted copy if the implementation chooses persistence

The bundle must not treat DB rows as canonical engine input. If stored input material is added, it must be the normalized public envelope material sent to `runEngineInput`, with non-decision notes and sensitive metadata redacted according to Engine 22 rules.

## Implementation Direction

- Define a typed app read model for replay debug evidence in the reporting layer.
- Extend trace persistence only if existing trace rows cannot support the read model through joins and request metadata.
- Add a narrow internal service or authenticated route only if a concrete beta support consumer needs it.
- Preserve existing explanation read models and add replay/debug fields beside them rather than replacing user-facing explanation content.
- Document which failures are canonicalization failures, engine deterministic rejections, app persistence failures, or post-engine orchestration failures.

## Verification And Acceptance Rules

Implementation acceptance requires:

- schema or contract tests for the replay debug read model
- service tests proving plan and completion traces resolve to replay bundles
- redaction tests for notes, set notes, and request metadata
- tests proving duplicate completion or reused idempotency does not create conflicting replay evidence
- tests proving missing optional trace material degrades to a typed unavailable state, not silent misleading evidence

Execution-side verification:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`

## Completion Target

Engine 24 closes when beta support can retrieve enough app-owned replay evidence to reproduce or classify a plan or completion decision without reading raw DB rows as engine contracts and without changing Rust public envelopes.
