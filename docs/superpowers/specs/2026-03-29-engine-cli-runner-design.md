# Engine CLI Runner Design

## Goal

Add a temporary in-crate CLI for `packages/engine-rs` so named deterministic fixtures can be executed manually without the app shell.

## Scope

In scope:
- A Rust binary under `packages/engine-rs/src/bin/`
- Named built-in fixtures only
- Full pretty-printed public input JSON and output JSON in one run
- Clear non-zero failure behavior for invalid fixture names and engine errors

Out of scope:
- Arbitrary JSON file input
- App-shell integration
- Browser or frontend work
- Long-term transport or adapter surface changes

## Interface

Command shape:

```powershell
cd packages/engine-rs
cargo run --bin inspect_engine -- <fixture-name>
```

Behavior:
- Accept one required fixture-name argument
- Resolve it against a stable fixture catalog
- Run either `plan_session` or `complete_session`
- Print the full input JSON and full output JSON, pretty-printed
- Exit with code `1` for unknown fixtures or engine errors

Initial fixture catalog:
- `plan-baseline`
- `plan-no-solution`
- `plan-injury-blocked`
- `plan-severe-fatigue`
- `complete-baseline`
- `complete-compromised`
- `complete-partial`
- `complete-missed`

## Structure

The CLI should not duplicate fixture construction already used by tests. Shared fixture builders should be extracted from test-only support into a normal crate module so both tests and the CLI can depend on the same canonical public inputs.

Planned structure:
- `packages/engine-rs/src/fixtures.rs`
  - shared named fixture builders
  - fixture catalog for CLI lookup
- `packages/engine-rs/src/bin/inspect_engine.rs`
  - simple argument parsing
  - fixture resolution
  - engine invocation
  - pretty-printing of input and output JSON

Tests should continue to use the shared fixture builders rather than maintain a second copy.

## Failure Handling

- Unknown fixture:
  - print the unknown name
  - print the supported fixture list
  - exit non-zero
- Engine invalid input or invalid output:
  - print the error text
  - exit non-zero
- Serialization failure:
  - treat as fatal and exit non-zero

## Testing

Add focused tests that cover:
- fixture catalog names resolve and execute the expected operation
- CLI valid fixture path exits successfully and prints both input and output sections
- CLI invalid fixture path exits non-zero and prints supported fixture names

This runner is intentionally temporary and inspection-focused. It exists to exercise the public Rust boundary manually without introducing a new permanent runtime layer.
