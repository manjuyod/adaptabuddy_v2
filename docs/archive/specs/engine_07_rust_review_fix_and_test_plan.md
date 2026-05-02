# Rust Engine Review Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-risk correctness and determinism issues found in the Rust engine review, then add the missing regression coverage and a concrete end-to-end test backlog for the app shell.

**Architecture:** Keep the engine-first boundary intact. Fixes should land in `packages/engine-rs` first, with contract validation tightened at the edge, replay/hash semantics made truthful, and test-only fixture shortcuts removed from runtime code. E2E work remains downstream and should verify the public boundary and app integration without letting live Supabase availability make the default test lane red.

**Tech Stack:** Rust crate in `packages/engine-rs`, Serde JSON envelopes, cargo integration tests, Vitest in `apps/web`, Playwright for browser E2E.

---

## Status

- `State`: Proposed
- `Priority`: High
- `Mode`: Review-driven fix and test plan

## Dependencies

- `specs/engine_01_boundary_contracts.md`
- `specs/engine_04_scoring_selection_and_decision_logs.md`
- `specs/engine_05_testing_and_replay.md`
- `specs/engine_06_isolated_engine_implementation.md`

## Scope

### In Scope

- Rust engine fixes for review findings in `packages/engine-rs`
- New and updated Rust tests for replay, validation, and regression coverage
- Test-lane recommendations for app/API/browser end-to-end coverage
- CI/test-lane separation guidance for live Supabase checks

### Out of Scope

- Direct app-shell implementation changes
- Supabase project repair
- DB schema changes
- WASM/FFI transport work
- Reopening engine domain-model decisions outside the specific fixes below

## Fix List

1. Replay hashes must use the algorithm they claim to use, or the receipt label must change.
2. Remove fixture-specific runtime branches from `complete_session` and `recommended_session_id`.
3. Tighten boundary validation so accepted public input cannot trigger internal `expect`-based panics.
4. Reject semantically empty `complete_session` payloads instead of mutating fallback progression records.
5. Resolve the `completedAt` contract mismatch: either make it truly required everywhere or support it as optional everywhere.

## Test List

1. Add regression coverage for replay-hash algorithm correctness and stability.
2. Add regression coverage proving fixture seeds no longer alter production behavior.
3. Add boundary tests for invalid `seededTieBreakBand` values and empty completion payloads.
4. Add public API tests for whichever `completedAt` contract is chosen.
5. Add an app-shell E2E backlog that separates offline deterministic checks from live Supabase/manual checks.

## File Map

- Modify: `packages/engine-rs/src/rng.rs`
- Modify: `packages/engine-rs/src/adaptation/mod.rs`
- Modify: `packages/engine-rs/src/adaptation/complete_session.rs`
- Modify: `packages/engine-rs/src/derivations.rs`
- Modify: `packages/engine-rs/src/boundary.rs`
- Modify: `packages/engine-rs/tests/replay_hashes.rs`
- Modify: `packages/engine-rs/tests/public_api_failures.rs`
- Modify: `packages/engine-rs/tests/complete_session.rs`
- Modify: `packages/engine-rs/tests/complete_session_properties.rs`
- Modify: `packages/engine-rs/tests/plan_session.rs`
- Modify: `packages/engine-rs/tests/goldens/plan_session_baseline.json`
- Modify: `packages/engine-rs/tests/goldens/complete_session_baseline.json`
- Reference only: `apps/web/tests/supabase-smoke.test.ts`
- Reference only: `apps/web/tests/supabase-auth-smoke.test.ts`
- Reference only: `apps/web/tests/supabase-e2e-verification.test.ts`
- Reference only: `apps/web/tests/e2e-session-flow.test.ts`

## Task Plan

### Task 1: Make Replay Hash Semantics Truthful

**Files:**
- Modify: `packages/engine-rs/src/rng.rs`
- Modify: `packages/engine-rs/src/adaptation/mod.rs`
- Modify: `packages/engine-rs/tests/replay_hashes.rs`
- Modify: `packages/engine-rs/tests/goldens/plan_session_baseline.json`
- Modify: `packages/engine-rs/tests/goldens/complete_session_baseline.json`

- [ ] **Step 1: Write failing tests for replay hash shape and determinism**

Add tests that assert:
- the `inputHash` and `outputHash` format matches the chosen algorithm label
- the same canonical material still hashes identically across repeated runs
- different material still changes the hash

- [ ] **Step 2: Run the focused failing tests**

Run: `cargo test replay_hashes -- --nocapture`
Expected: FAIL before implementation if the receipt label and algorithm no longer agree.

- [ ] **Step 3: Implement the minimal hash fix**

Choose one path and apply it consistently:
- preferred: implement real SHA-256 hashing and keep the `sha256:` prefix
- fallback: rename the prefix and any related wording away from `sha256`

Do not leave the current mismatch in place.

- [ ] **Step 4: Regenerate or update goldens and replay assertions**

Update only the expected replay receipt fields affected by the hash change.

- [ ] **Step 5: Re-run focused tests**

Run: `cargo test replay_hashes`
Expected: PASS

### Task 2: Remove Fixture-Specific Runtime Logic

**Files:**
- Modify: `packages/engine-rs/src/adaptation/complete_session.rs`
- Modify: `packages/engine-rs/src/derivations.rs`
- Modify: `packages/engine-rs/tests/complete_session.rs`
- Modify: `packages/engine-rs/tests/plan_session.rs`
- Modify: `packages/engine-rs/tests/goldens/plan_session_baseline.json`
- Modify: `packages/engine-rs/tests/goldens/complete_session_baseline.json`

- [ ] **Step 1: Add failing regression tests for fixture leakage**

Add tests that prove:
- seed-specific branches do not alter production behavior
- `recommended_session_id` is derived generically rather than special-cased for the baseline fixture
- `complete_session` action selection depends on inputs, not a hard-coded test seed

- [ ] **Step 2: Run the focused tests**

Run: `cargo test plan_session:: && cargo test complete_session::`
Expected: at least the new regression coverage fails before the runtime shortcuts are removed.

- [ ] **Step 3: Remove the runtime shortcuts**

Delete:
- the `is_cycle_variant_input` branch in `packages/engine-rs/src/adaptation/complete_session.rs`
- the baseline-specific `recommended_session_id` special case in `packages/engine-rs/src/derivations.rs`

Replace them with generic deterministic logic only.

- [ ] **Step 4: Update goldens and tests to the generic output**

Keep determinism, but stop coupling runtime behavior to fixture names.

- [ ] **Step 5: Re-run the focused suites**

Run: `cargo test plan_session && cargo test complete_session`
Expected: PASS

### Task 3: Tighten Boundary Validation to Eliminate Panicable Inputs

**Files:**
- Modify: `packages/engine-rs/src/boundary.rs`
- Modify: `packages/engine-rs/tests/public_api_failures.rs`
- Modify: `packages/engine-rs/tests/plan_session.rs`

- [ ] **Step 1: Add failing validation tests**

Add public API rejection tests for:
- negative `seededTieBreakBand`
- non-finite or invalid numeric policy values if they can enter through JSON
- any plan input shape that can empty the tie-break pool while still passing boundary validation

- [ ] **Step 2: Run the focused validation tests**

Run: `cargo test public_api_failures`
Expected: FAIL before validation is tightened.

- [ ] **Step 3: Implement minimal boundary constraints**

Validate at parse time that:
- `seededTieBreakBand >= 0`
- policy numeric fields are finite and within the intended deterministic bounds

The public API should return `EngineError::InvalidInput`, not panic internally.

- [ ] **Step 4: Add a no-panic regression**

Add a test that sends the previously panicable payload through `engine_rs::plan_session` and asserts it returns an invalid-input error.

- [ ] **Step 5: Re-run the focused suites**

Run: `cargo test public_api_failures && cargo test plan_session`
Expected: PASS

### Task 4: Reject Semantically Empty Completion Payloads

**Files:**
- Modify: `packages/engine-rs/src/boundary.rs`
- Modify: `packages/engine-rs/tests/public_api_failures.rs`
- Modify: `packages/engine-rs/tests/complete_session_properties.rs`

- [ ] **Step 1: Add failing public API tests**

Add rejection tests for:
- `session.exercises = []`
- `session.exercises[*].sets = []`

These should fail at the public boundary, not flow into fallback exercise mutation.

- [ ] **Step 2: Run the focused tests**

Run: `cargo test public_api_failures`
Expected: FAIL before the validation rule is added.

- [ ] **Step 3: Tighten request validation**

Update `validate_complete_session_request` so the request must include:
- at least one exercise
- at least one set per exercise

- [ ] **Step 4: Add a defensive runtime assertion test**

If a malformed typed input is still constructed in an internal-only path, assert that the runtime behavior is explicit and documented rather than silently mutating `"bench-press"` by default.

- [ ] **Step 5: Re-run the focused suites**

Run: `cargo test public_api_failures && cargo test complete_session_properties`
Expected: PASS

### Task 5: Resolve the `completedAt` Contract Mismatch

**Files:**
- Modify: `packages/engine-rs/src/boundary.rs`
- Modify: `packages/engine-rs/src/adaptation/complete_session.rs`
- Modify: `packages/engine-rs/tests/public_api_failures.rs`
- Modify: `packages/engine-rs/tests/complete_session_properties.rs`
- Modify: `packages/engine-rs/tests/replay_hashes.rs`

- [ ] **Step 1: Decide and document the contract**

Pick one:
- Option A: `completedAt` is required; remove the fallback-to-`effective_at` behavior from runtime code and tests.
- Option B: `completedAt` is optional; update boundary validation so the public API accepts omission and runtime derives from `determinism.effective_at`.

Preferred direction: Option B, because the runtime and current tests already model that behavior.

- [ ] **Step 2: Write or update failing tests for the chosen contract**

Cover:
- public API behavior
- replay hash behavior
- recent completion ordering behavior

- [ ] **Step 3: Implement the minimal contract-alignment fix**

Ensure the public boundary, runtime behavior, and replay tests all describe the same rule.

- [ ] **Step 4: Re-run the focused suites**

Run: `cargo test complete_session_properties && cargo test replay_hashes && cargo test public_api_failures`
Expected: PASS

### Task 6: Full Rust Verification

**Files:**
- No code changes

- [ ] **Step 1: Run the full Rust suite**

Run: `cargo test`
Expected: PASS with all Rust unit, integration, and doc tests green.

- [ ] **Step 2: Sanity-check the touched review risks**

Confirm in output and code review that:
- no test-only seed shortcuts remain in runtime files
- replay receipt wording matches the actual hash algorithm
- malformed policy/request payloads fail as `InvalidInput`

## End-to-End Test Backlog

### Lane 1: Offline Deterministic Contract E2E

Purpose: default CI-safe lane that does not require live Supabase.

- Add a fixture-driven API test that sends canonical `plan_session` and `complete_session` payloads through the app boundary and asserts exact engine envelope shape.
- Add an end-to-end state-loop test that executes `plan -> complete -> next plan` through the public API surface with fixed fixtures and exact replay receipt assertions.
- Add negative-path API E2E for deterministic rejection, invalid payload rejection, and replay-hash stability on metadata-only changes.

### Lane 2: Browser Product-Flow E2E

Purpose: app-shell integration confidence using deterministic or disposable test data.

- Add a Playwright happy path for onboarding, generating a session, completing it, and verifying the next recommendation/history view.
- Add a Playwright negative path for blocked or constrained sessions so the user-facing rejection state is covered.
- Keep browser E2E independent from the live production Supabase project whenever possible.

### Lane 3: Live Supabase Verification

Purpose: manual or explicitly gated environment verification only.

- Keep `apps/web/tests/supabase-smoke.test.ts`, `apps/web/tests/supabase-auth-smoke.test.ts`, and `apps/web/tests/supabase-e2e-verification.test.ts` out of the default green lane.
- Gate live checks behind an explicit env flag or separate npm script so `npm run test` is not red because of DNS or credential issues.
- Require clear preconditions: valid `SUPABASE_URL`, reachable host, known test user, and service-role access where applicable.

## Acceptance Criteria

- The top review findings are translated into executable tasks with exact file targets.
- The plan includes both fix work and regression test work.
- The plan preserves the engine-first rule: Rust boundary and runtime first, app-shell E2E second.
- The default Rust verification command remains `cargo test`.
- The app E2E backlog separates deterministic CI-safe coverage from live-environment verification.

## Verification Commands

- `cargo test replay_hashes`
- `cargo test public_api_failures`
- `cargo test plan_session`
- `cargo test complete_session`
- `cargo test complete_session_properties`
- `cargo test`
- `npm run test`

## Notes

- Current evidence shows `cargo test` in `packages/engine-rs` passes.
- Current evidence shows `npm run test` at repo root fails only in live Supabase tests under `apps/web` because `vezfyhbrrpokheqipepa.supabase.co` returned `getaddrinfo ENOTFOUND`.
- Because user instructions in this session did not request additional delegation for this spec-writing turn, the plan-review subagent step from the planning skill was not used here.
