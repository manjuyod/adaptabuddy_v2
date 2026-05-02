# Engine 28 Replay Certification

Use this page when checking the Engine 28 cross-language replay certification bundle. It is an operations reference only; the canonical engine direction remains in the architecture and numbered spec documents.

## Artifacts

| Artifact | Location | Purpose |
| --- | --- | --- |
| Replay certification manifest | `packages/engine-rs/fixtures/replay-certification/engine_28_manifest.json` | Checked-in Engine 28 fixture bundle generated from the Rust engine. |
| TypeScript verifier | `packages/contracts/src/replay-certification.ts` | Independent TypeScript hash and policy verifier used by the contracts tests. |

## What Is Certified

The Engine 28 bundle certifies that the TypeScript verifier can reproduce the Rust fixture material for the checked-in replay cases:

- `referenceHash` derivation from canonical `referenceSnapshot` material.
- `inputHash` derivation from canonical replay input material.
- `outputHash` derivation from canonical replay output material, with `replayReceipt` excluded from the output hash material.
- Exclusion of app/runtime-only material from input hashes:
  - `metadata`
  - complete-session session notes
  - complete-session set notes
- Failure classification for verifier errors, including unsupported canonicalization versions, reference hash mismatches, invalid numeric material, metadata-only stability mismatches, and hash mismatches.

## What Is Not Certified

The bundle does not certify:

- A full independent TypeScript reimplementation of `initialize_cycle`, `plan_session`, or `complete_session`.
- Heuristic parity outside the checked Rust public outputs.
- Any app database, API route, auth, or UI behavior.

## Commands

Run from the repository root:

```bash
node scripts/generate-engine-28-replay-manifest.mjs
npm run test --workspace @adaptabuddy/contracts -- replay-certification
cargo test --manifest-path packages/engine-rs/Cargo.toml
```

The manifest command regenerates `packages/engine-rs/fixtures/replay-certification/engine_28_manifest.json` from Rust `inspect_engine` output. Follow it with the verifier commands: the contracts command verifies the TypeScript replay certification logic and the checked-in Engine 28 manifest, and the cargo command keeps the Rust engine fixture and replay behavior covered by the engine test suite.

## Envelope Note

Engine 28 did not change the public engine envelope. The replay certification slice checks canonical material and hashes for the existing public inputs and outputs; it does not add public engine fields.
