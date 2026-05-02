# Engine 23: App Replay Invocation Alignment

## Goal

Make every app-built Rust engine invocation comply with the Engine 22 canonical replay policy before private beta.

This spec closes the gap between the completed Rust replay policy and the current app bridge inputs for `initialize_cycle`, `plan_session`, and `complete_session`.

## Status

- `State`: Complete
- `Priority`: Critical
- `Depends On`:
  - `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`
  - `docs/architecture/engine_first_architecture.md`
  - `specs/hippocampus/domain_model_notes.md`
  - `specs/hippocampus/test_strategy_notes.md`

## GitNexus Grounding

GitNexus context used for this spec:

- `runEngineInput` in `apps/web/src/lib/engine-runner.ts` is called by `handleInitializeCycle`, `handleGenerateSession`, and `handleCompleteSession`.
- `handleInitializeCycle` in `apps/web/src/modules/cycles/service.ts` builds the app-side `initialize_cycle` envelope.
- `handleGenerateSession` in `apps/web/src/modules/sessions/service.ts` builds cycle-backed `plan_session` envelopes and calls `persistEngineSessionTrace`.
- `handleCompleteSession` in `apps/web/src/modules/sessions/service.ts` builds cycle-backed `complete_session` envelopes and calls `syncNormalizedCycleCompletion`, `persistCycleCompatibilityProjection`, and `complete_session_atomic`.
- GitNexus route maps show `/api/v0/sessions/generate` and `/api/v0/sessions/complete` flowing through route edge validation into those handlers.
- GitNexus impact reports mark `EngineInputV1` and `EngineOutputV1` as CRITICAL if changed, so this spec must align app invocation without revising the public engine envelopes.

Repository inspection found current app bridge placeholders:

- `apps/web/src/modules/cycles/service.ts` uses `referenceHash: "sha256:app-cycle-reference"` and `canonicalizationVersion: "canon-v1"`.
- `apps/web/src/modules/sessions/service.ts` uses the same placeholder reference hash and legacy alias for cycle-backed `plan_session` and `complete_session`.
- Cycle-backed `plan_session` may use `new Date().toISOString()` as a fallback effective time, which weakens replay evidence unless the caller-supplied effective time is recorded and stable.

## Boundary Decision

Engine 23 is an app invocation alignment slice, not a Rust engine boundary revision.

This spec keeps unchanged:

- `EngineInputV1`
- `EngineOutputV1`
- Rust operations `initialize_cycle`, `plan_session`, and `complete_session`
- Engine 22 canonical JSON, SHA-256, reference-hash, and numeric policy
- normalized cycle persistence schema unless implementation discovery proves a migration is required for storing app-owned replay evidence

This spec defines:

- how the app derives canonical `determinism.referenceHash` from the exact normalized `referenceSnapshot` sent to Rust
- how app invocations move from the legacy `canon-v1` alias to `canon-replay-v1`
- how app edge code supplies stable `effectiveAt` values without implicit wall-clock fallback inside engine input builders
- tests proving all three app-built operation envelopes are accepted by the Rust Engine 22 policy

## Implementation Direction

- Add an app-owned helper for replay-policy-compliant engine input assembly. It should derive the canonical reference hash using the same policy as `packages/engine-rs`, or delegate to the Rust runner in a deterministic preflight path if sharing the serializer directly is not practical.
- Replace app bridge placeholder reference hashes for `initialize_cycle`, cycle-backed `plan_session`, and cycle-backed `complete_session`.
- Use `canonicalizationVersion: "canon-replay-v1"` in app-built inputs. Keep Rust's `canon-v1` alias only as backwards compatibility for older fixtures or stored traces.
- Remove implicit clock fallback from engine input builders. If the app needs a fallback timestamp, compute it at the request boundary or orchestration boundary, pass it explicitly, and include it in test setup.
- Keep `metadata.correlationId` non-decision material. Changing request IDs must not change `inputHash`.

## Verification And Acceptance Rules

Implementation acceptance requires:

- focused app tests proving `handleInitializeCycle`, cycle-backed `handleGenerateSession`, and cycle-backed `handleCompleteSession` build inputs with canonical `referenceHash` and `canon-replay-v1`
- regression tests proving the Rust runner accepts those app-built inputs under Engine 22 reference-hash verification
- tests proving metadata-only changes do not change authoritative replay hashes
- tests proving material reference snapshot changes do change `referenceHash` and `inputHash`
- tests proving generated effective time is explicit and stable in app test fixtures
- no change to `EngineInputV1` or `EngineOutputV1`

Execution-side verification:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `cd apps/web && npm run build`
- `cargo test --manifest-path packages/engine-rs/Cargo.toml`

## Completion Target

Engine 23 closes when all app-built Rust engine invocations use Engine 22-compliant replay policy material, no app bridge sends placeholder reference hashes, and the app tests prove replay-policy compliance across initialize, generate, and complete flows.
