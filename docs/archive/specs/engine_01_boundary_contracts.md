# Engine Spec 01: Boundary Contracts

## Status

- `State`: Complete
- `Priority`: Done

## Goal

Define the engine as an isolated deterministic decision core with explicit boundaries between engine responsibilities and app-shell responsibilities, then lock the current MVP public contract against the Rust reference implementation.

## Dependencies

- `docs/architecture/engine_first_architecture.md`
- `specs/overall_plan.md`
- `packages/engine-rs/src/lib.rs`
- `packages/engine-rs/src/boundary.rs`

## In Scope

- Engine scope versus app scope
- The current MVP `EngineInputV1` and `EngineOutputV1` public envelopes
- Determinism, replay, and purity invariants that are already enforced or assumed by the Rust boundary
- Non-goals and exclusions

## Out of Scope

- DB schema changes
- Supabase integration
- API transport wrappers around the engine boundary
- UI flows
- Scoring formulas, candidate heuristics, and normalization expansion beyond what is required to lock the boundary

## Closed Boundary Decisions

### Ownership split

- `apps/web` owns auth, sessions, route guards, transport, edge validation, rate limiting, security headers, DB reads and writes, RLS-backed enforcement, unit conversion, snapshot assembly, and persistence mapping.
- The engine owns deterministic decision logic, semantic state transitions, typed deterministic rejections, structured decision logs, and replay receipts.
- DB rows, Supabase clients, API wrapper shapes, and `users.stats_json` are excluded from the canonical engine contract.

### Current MVP operation scope

- The current public engine MVP supports `plan_session` and `complete_session` only.
- Additional operations remain future contract work and are not part of the locked MVP boundary.

### `EngineInputV1`

Current public envelope:

```text
EngineInputV1
- schemaVersion
- operation
- determinism
- referenceSnapshot
- stateSnapshot
- policySnapshot
- request
- metadata
```

Current public field expectations:
- `schemaVersion`: must match `engine.v1`
- `operation`: `plan_session` or `complete_session`
- `determinism`:
  - `seed`
  - `effectiveAt`
  - `ruleVersion`
  - `referenceHash`
  - `canonicalizationVersion`
- `referenceSnapshot`: public JSON envelope, parsed into typed Rust reference structs
- `stateSnapshot`: public JSON envelope, parsed into typed Rust state structs
- `policySnapshot`: public JSON envelope, parsed into a typed Rust policy struct
- `request`: operation-specific JSON payload that remains untyped at the envelope boundary in the MVP
- `metadata`: JSON payload for correlation or trace data that must not affect engine outcomes

Current request validation policy:
- unknown request fields are rejected before engine execution
- malformed `plan_session` and `complete_session` request shapes are rejected before engine execution
- `complete_session` boundary validation currently includes canonical session fields such as `slotId`, `notes`, and nullable `overallRpe` / `rir`

### `EngineOutputV1`

Current public envelope:

```text
EngineOutputV1
- schemaVersion
- operation
- result
- statePatch
- events
- decisionLog
- replayReceipt
```

Current public field expectations:
- `schemaVersion`: must match `engine.v1`
- `operation`: echoes the input operation
- `result`: typed success payload for the selected operation or a typed deterministic rejection
- `statePatch`: semantic engine-owned patch data, not storage-shaped merge blobs
- `events`: optional raw JSON array in the MVP; present in the envelope but not yet modeled as a typed public contract
- `decisionLog`: structured log entries parsed into typed Rust log structs
- `replayReceipt`:
  - `inputHash`
  - `outputHash`
  - `seedUsed`
  - `effectiveAt`
  - `implementationVersion`
  - `policyVersion`
  - `referenceHash`

### Internal typed boundary in the Rust MVP

- `referenceSnapshot`, `stateSnapshot`, and `policySnapshot` are parsed into typed Rust structs before engine execution.
- `request`, `metadata`, and `events` remain JSON values at the public envelope boundary in the MVP.
- Deterministic success payloads, deterministic rejections, state patches, and decision logs are parsed back into typed Rust structs on the output side.

## Boundary Enforcement Rules

- Schema-version mismatches are rejected on both parse and serialize paths.
- Unknown fields are rejected by the typed Rust boundary structs used for the current MVP snapshots, policy, results, and decision logs.
- Stable string identifiers remain the boundary identifiers; the engine does not depend on Supabase numeric IDs.
- The engine boundary does not infer logic from DB rows, app-specific persistence shapes, transport wrappers, wall clock time, locale, environment variables, or implicit randomness.

## Invariants

- Same canonical input plus same seed, rule version, reference hash, and canonicalization version yields the same output.
- The engine performs no IO.
- The engine reads no external clock or environment state.
- Deterministic rejection paths use typed result payloads, not ad hoc response wrappers.
- Output ordering must remain stable under the typed boundary and deterministic containers.
- State patches remain semantic and engine-owned.

## Acceptance Criteria Check

- The engine boundary is explicit about what stays in app/orchestration land and what belongs in the decision core.
- No engine-facing contract uses DB rows or Supabase integer primary keys as the canonical model.
- `users.stats_json` is documented only as an app persistence shape.
- Unknown or transport-only fields are rejected from the canonical engine contract where the MVP has typed boundary structs and request validators.
- Deterministic rejection paths are described as typed outcomes, not ad hoc response wrappers.

Result:
- Acceptance criteria are satisfied for the current MVP boundary, so `engine_01` is closed and Phase 2 can become the active spec focus.

## Open Risks or Unresolved Items

- Exact canonical serialization rules for replay receipts
- Exact numeric representation policy across languages
- Final long-term policy for `statePatch` only versus `statePatch` plus typed `events`
- Whether future operations need additional envelope fields beyond the current `EngineInputV1` / `EngineOutputV1` shape
