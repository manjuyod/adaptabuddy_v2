# Engine 08 Hippocampus

## Status

- `complete`

## Acceptance targets

- `initialize_cycle` is supported by the public Rust boundary.
- Invalid intake payloads fail as `EngineError::InvalidInput`.
- Replay receipts stay stable across repeated identical runs.
- Output contains a fully expanded macrocycle session list.

## Owned files / lane

- `Lane R`
- `packages/engine-rs/**`
- Primary focus: `initialize_cycle` public boundary and deterministic output contract

## Verified commands

- `cd packages/engine-rs && cargo test --test initialize_cycle --test public_api_failures`
- `cd packages/engine-rs && cargo test`

## Open findings

- None.

## Next exact action

- None. Reopen only if the public `initialize_cycle` contract changes.

## Handoff log

- `2026-03-29`: File created by coordinator. Initial status set to `review-pending`.
- `2026-03-29`: Added focused public invalid-input coverage for `initialize_cycle`, including nested shape failures, slot-bound ordering, oversized integer rejection, and invalid `slotType` rejection.
- `2026-03-29`: Final Rust verification passed after the boundary hardening.
