# Engine 22 Hippocampus

## Status

- `complete`

## Completed spec

- Archived numbered spec: `docs/archive/specs/engine_22_canonical_replay_serialization_and_numeric_policy.md`

## Completion Summary

- Engine 22 closed the replay-policy gap for the Rust MVP boundary without changing `EngineInputV1`, `EngineOutputV1`, or the public operation set.
- The Rust engine now enforces accepted canonicalization versions, accepting `canon-replay-v1` and the legacy `canon-v1` alias.
- Replay hashes now use canonical JSON bytes and SHA-256 `sha256:<lowercase-hex>` formatting.
- The engine recomputes and verifies `determinism.referenceHash` before execution.
- Replay-relevant numeric inputs now get hash-safe fixed-point validation, and score outputs are quantized before public output and hashing.
- Existing Rust goldens and fixtures were promoted away from placeholder reference hashes.

## Remaining Handoff

- Cross-language replay certification remains future work until another implementation exists and can run against the Engine 22 fixture bundle.
- App API/UI, DB, contract-package, `stats_json`, and typed domain-event work remain outside Engine 22.
