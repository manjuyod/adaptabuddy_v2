# Engine CLI Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a temporary fixture-backed CLI binary for `packages/engine-rs` that runs the public engine boundary and prints full input/output JSON for named scenarios.

**Architecture:** Reuse the existing public fixture shapes by moving reusable builders into a shared crate module and letting both tests and the CLI depend on that module. Keep the CLI thin: fixture lookup, operation dispatch, and pretty-printed JSON output only.

**Tech Stack:** Rust crate binary target, serde/serde_json, cargo integration tests.

---

## File Map

- Create: `packages/engine-rs/src/fixtures.rs`
- Create: `packages/engine-rs/src/bin/inspect_engine.rs`
- Modify: `packages/engine-rs/src/lib.rs`
- Modify: `packages/engine-rs/tests/support/fixtures.rs`
- Create: `packages/engine-rs/tests/inspect_engine.rs`

### Task 1: Add CLI-Facing Tests First

**Files:**
- Create: `packages/engine-rs/tests/inspect_engine.rs`

- [ ] **Step 1: Write the failing catalog test**

Assert that the exposed fixture names resolve, build a valid `EngineInputV1`, and run the correct public operation.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `cargo test --test inspect_engine fixture_catalog`
Expected: FAIL because the shared fixture catalog does not exist yet.

- [ ] **Step 3: Write the failing CLI behavior test**

Assert that:
- a valid fixture exits successfully
- stdout contains `INPUT` and `OUTPUT`
- an invalid fixture exits non-zero and prints supported fixture names

- [ ] **Step 4: Run the focused test to verify it fails**

Run: `cargo test --test inspect_engine cli_`
Expected: FAIL because the binary does not exist yet.

### Task 2: Extract Shared Fixture Builders

**Files:**
- Create: `packages/engine-rs/src/fixtures.rs`
- Modify: `packages/engine-rs/src/lib.rs`
- Modify: `packages/engine-rs/tests/support/fixtures.rs`

- [ ] **Step 1: Move reusable public fixture builders into the crate**

Export the named fixture builders needed by both tests and the CLI.

- [ ] **Step 2: Update test support to reuse the shared module**

Keep any test-only helper logic in `tests/support/fixtures.rs`, but remove duplicated fixture definitions that now belong in `src/fixtures.rs`.

- [ ] **Step 3: Run the focused tests**

Run: `cargo test --test inspect_engine fixture_catalog`
Expected: still FAIL until the CLI binary exists, but the shared fixture module compiles.

### Task 3: Implement the `inspect_engine` Binary

**Files:**
- Create: `packages/engine-rs/src/bin/inspect_engine.rs`

- [ ] **Step 1: Add minimal argument parsing**

Support exactly one positional fixture argument.

- [ ] **Step 2: Add fixture lookup and operation dispatch**

Resolve the fixture name and route to `plan_session` or `complete_session`.

- [ ] **Step 3: Pretty-print input and output JSON**

Print both sections in one run using the public envelope types.

- [ ] **Step 4: Implement non-zero failure paths**

Handle unknown fixture names and engine errors with clear stderr output.

- [ ] **Step 5: Run the focused tests**

Run: `cargo test --test inspect_engine`
Expected: PASS

### Task 4: Final Verification

**Files:**
- No code changes

- [ ] **Step 1: Run focused engine verification**

Run: `cargo test --test inspect_engine && cargo test plan_session && cargo test complete_session`
Expected: PASS

- [ ] **Step 2: Manually run the CLI**

Run: `cargo run --bin inspect_engine -- plan-baseline`
Expected: pretty-printed `INPUT` and `OUTPUT` JSON on stdout.

- [ ] **Step 3: Verify invalid fixture handling**

Run: `cargo run --bin inspect_engine -- not-a-fixture`
Expected: non-zero exit and supported fixture list on stderr.
