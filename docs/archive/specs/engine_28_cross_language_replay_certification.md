# Engine 28: Cross-Language Replay Certification

## Goal

Certify Engine 22 and Engine 23 replay behavior against an independent implementation or verifier harness after Engine 27 private-beta release evidence is complete.

This spec turns canonical replay policy into cross-language evidence. It is important architecture work, but it is not a private-beta launch blocker unless portability becomes a launch requirement.

## Status

- `State`: Completed and archived
- `Priority`: Medium
- `Depends On`:
  - `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`
  - `docs/archive/specs/engine_23_app_replay_invocation_alignment.md`
  - `docs/archive/specs/engine_27_private_beta_release_evidence_pack.md`
  - `specs/hippocampus/test_strategy_notes.md`
  - `packages/engine-rs/src/fixtures.rs`

## Completion Result

Engine 28 is complete and archived. The checked-in replay certification manifest lives at `packages/engine-rs/fixtures/replay-certification/engine_28_manifest.json`, and the independent TypeScript verifier lives at `packages/contracts/src/replay-certification.ts`.

The completed slice covers canonical replay material and negative failure classification, including unsupported canonicalization versions, reference-hash mismatches, invalid numeric material, metadata-only stability, and hash mismatches. It did not change the public `EngineInputV1` / `EngineOutputV1` envelope or public operation names.

Implementation verification commands:

```bash
node scripts/generate-engine-28-replay-manifest.mjs
npm run test --workspace @adaptabuddy/contracts -- replay-certification
cargo test --manifest-path packages/engine-rs/Cargo.toml
```

## GitNexus Grounding

GitNexus context used for this spec:

- `EngineInputV1` and `EngineOutputV1` live in `packages/engine-rs/src/lib.rs`.
- `EngineInputV1` impact is CRITICAL and reaches fixture builders, boundary parsing, and `derived_input_hash`.
- `EngineOutputV1` impact is CRITICAL and reaches public output conversion, validation, and `derived_output_hash`.
- `initialize_cycle`, `plan_session`, and `complete_session` remain the public operation surface.
- `packages/engine-rs/src/replay.rs`, `packages/engine-rs/src/boundary.rs`, and `packages/engine-rs/src/adaptation/mod.rs` are the Rust replay and boundary implementation surfaces.
- `packages/engine-rs/src/fixtures.rs`, `inspect_engine`, and `engine_runner` provide useful starting points for conformance fixture export and replay execution.

## Boundary Decision

Engine 28 is a certification and tooling slice.

This spec keeps unchanged:

- `EngineInputV1`
- `EngineOutputV1`
- Engine 22 canonical policy identity `canon-replay-v1`
- SHA-256 `sha256:<lowercase-hex>` hash strings
- public operation names

This spec defines:

- the cross-language fixture bundle shape
- which hashes and canonical bytes must be reproduced
- acceptable verifier implementation choices
- failure classification for canonicalization, numeric policy, hash derivation, boundary validation, and operation result drift

## Certification Bundle

The fixture bundle should include:

- canonical public input JSON
- canonical reference snapshot bytes or a deterministic way to derive them
- expected `referenceHash`
- expected `inputHash`
- expected public output JSON
- expected `outputHash`
- operation name, schema version, rule version, and canonicalization version
- fixture metadata that is explicitly outside replay material

Minimum fixture classes:

- initialize cycle baseline
- plan session baseline
- plan session rejection
- complete session baseline
- complete session note-only non-material variant
- reference hash mismatch rejection
- numeric boundary case
- event-order or empty-events output case while `events` remains in `EngineOutputV1`

## Implementation Direction

- Export a small canonical fixture bundle from the Rust crate or checked-in test fixtures.
- Add an independent verifier harness in TypeScript, Rust-with-independent-path, or another agreed language. The verifier must not call Rust replay helpers for canonicalization if it is meant to certify cross-language behavior.
- Compare canonical bytes and hashes before comparing operation outputs.
- Keep full operation reimplementation optional unless the chosen verifier is intended to prove deterministic decision parity, not only replay-material parity.
- Promote failures into typed classes so canonicalization drift is not confused with heuristic or engine-result drift.

## Verification And Acceptance Rules

Implementation acceptance requires:

- fixture manifest checked into the repo
- verifier tests that reproduce `referenceHash`, `inputHash`, and `outputHash`
- negative tests for unsupported canonicalization version, reference-hash mismatch, invalid numeric material, and metadata-only stability
- documentation explaining which parts certify canonical replay material and which parts certify full operation result parity
- no public envelope revision

Execution-side verification:

- `cargo test --manifest-path packages/engine-rs/Cargo.toml`
- verifier-specific test command
- `npm run test` if the verifier or manifest reader is TypeScript-based

## Completion Target

Engine 28 closed after an implementation independent from the Rust replay helpers reproduced the canonical fixture hashes and classified failures under the Engine 22/23 replay policy without changing the public engine boundary.
