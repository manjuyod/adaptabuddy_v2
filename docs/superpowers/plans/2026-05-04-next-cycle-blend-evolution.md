# Next-Cycle Blend Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `advance_cycle` evolve the user's actual blended program selection, baselines, fatigue, injury constraints, and adherence signals into a replayable next-cycle request.

**Architecture:** Keep `advance_cycle` pure and deterministic in `packages/engine-rs`. The app should pass the current initialized-cycle context as normalized request/reference data; Rust should derive next-cycle blend changes and emit decision-log evidence without querying live DB state.

**Tech Stack:** Rust engine (`packages/engine-rs`), TypeScript contracts (`packages/contracts`), Next.js app service/API (`apps/web`), Supabase-backed normalized cycle tables, Vitest, Cargo tests, Playwright for beta gates.

---

## Context

Current status:

- `initialize_cycle` now supports true multi-program blending, strength baselines, fatigue volume caps, injury-aware swaps/regressions/removals, and challenge progression preservation.
- `advance_cycle` currently ranks a season and emits a generic hard-coded `nextCycleRequest`.
- Feedback `FDB-20260504-003` tracks the user-visible gap: a blended first cycle may not evolve into a personalized blended next cycle.

Out of scope for this slice:

- New database-owned engine rules.
- Hidden Rust DB lookups.
- New class archetypes.
- Major onboarding UI redesign.
- Replacing the existing rank/award model.

## File Map

- Modify: `packages/engine-rs/src/adaptation/advance_cycle.rs`
  - Replace hard-coded next-cycle request construction with deterministic blend evolution helpers.
  - Add decision-log entries for blend retention, fatigue adjustment, injury carry-forward, and baseline carry-forward.
- Modify: `packages/engine-rs/src/boundary.rs`
  - Accept optional `currentCycleRequest`, `programAdaptationInputs`, or equivalent normalized fields in `advance_cycle` request validation.
  - Keep unknown-field rejection.
- Modify: `packages/engine-rs/src/fixtures.rs`
  - Add blended-cycle advance fixtures that include powerlifting, bench, and push-up challenge context.
- Modify: `packages/engine-rs/tests/advance_cycle.rs`
  - Add deterministic tests for personalized next-cycle evolution.
- Modify: `packages/contracts/src/cycles.ts`
  - Extend `AdvanceCycleRequestSchema` only after Rust boundary shape is settled.
- Modify: `packages/contracts/tests/smoke.test.ts`
  - Add schema smoke coverage for the personalized next-cycle fields.
- Modify: `apps/web/src/modules/cycles/service.ts`
  - Pass current initialized-cycle context, program mix, adaptation inputs, injuries, fatigue, and completion signals into Rust `advance_cycle`.
- Modify: `apps/web/tests/initialize-cycle-service.test.ts` or create `apps/web/tests/advance-cycle-service.test.ts`
  - Verify the app passes the blend context into the engine and persists the returned next-cycle preview.
- Modify: `docs/operations/wave_7_beta_feedback_log.md`
  - Link the implementation result back to `FDB-20260504-003`.

## Task 1: Add Replay Fixture For Blended Season Advancement

**Files:**

- Modify: `packages/engine-rs/src/fixtures.rs`
- Modify: `packages/engine-rs/tests/advance_cycle.rs`

- [ ] **Step 1: Write the failing blended advance test**

Add a test shaped like:

```rust
#[test]
fn advance_cycle_preserves_and_evolves_blended_program_context() {
    let output = advance_cycle(&fixtures::advance_cycle_blended_power_bench_pushup_input())
        .expect("advance_cycle should personalize blended next cycle");

    let request = &output.result["nextCycleRequest"];
    let selected_programs = request["selectedPrograms"].as_array().expect("selected programs");
    let program_ids = selected_programs
        .iter()
        .map(|program| program["programId"].as_str().expect("program id"))
        .collect::<std::collections::HashSet<_>>();

    assert!(program_ids.contains("program-powerlifting"));
    assert!(program_ids.contains("program-bench"));
    assert!(program_ids.contains("program-challenge"));
    assert_eq!(request["profile"]["injuryMuscleGroupSlugs"], serde_json::json!(["quads"]));
    assert_eq!(request["programAdaptationInputs"]["challengeBaselines"]["push_up"]["maxReps"], serde_json::json!(20));
    assert_eq!(request["programAdaptationInputs"]["strengthBaselines"]["bench_press"]["estimatedOneRepMax"], serde_json::json!(100));
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test advance_cycle advance_cycle_preserves_and_evolves_blended_program_context
```

Expected: fail because the current `advance_cycle` emits generic `program-strength` and `program-hypertrophy`.

- [ ] **Step 3: Add the fixture**

Build the fixture from the current initialize-cycle blend test shape:

- `program-powerlifting` with squat/deadlift slots.
- `program-bench` with bench main work.
- `program-challenge` with `100_pushups` adaptive template and `push_up` baseline 20.
- high fatigue and `quads` injury constraint.
- strength baselines: squat 225, deadlift 225, bench press 100, overhead press 75.

- [ ] **Step 4: Re-run the failing test**

Expected: still fail until implementation exists, but fixture compiles.

## Task 2: Define The `advance_cycle` Request Context Boundary

**Files:**

- Modify: `packages/engine-rs/src/boundary.rs`
- Modify: `packages/contracts/src/cycles.ts`
- Modify: `packages/contracts/tests/smoke.test.ts`

- [ ] **Step 1: Add Rust boundary tests for accepted and rejected fields**

Test that `advance_cycle` accepts:

- `currentCycleRequest`
- `programAdaptationInputs`
- `completedSessionCount`
- `missedSessionCount`
- existing rank signal fields

Test that unknown fields still reject.

- [ ] **Step 2: Update Rust validation**

Keep `advance_cycle` request validation strict. Add only the fields needed for deterministic next-cycle evolution.

- [ ] **Step 3: Update TypeScript contract schema**

Extend `AdvanceCycleRequestSchema` with the same optional context fields.

- [ ] **Step 4: Run contract and Rust boundary checks**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test advance_cycle
npm run test --workspace @adaptabuddy/contracts
```

Expected: pass.

## Task 3: Implement Deterministic Blend Evolution In Rust

**Files:**

- Modify: `packages/engine-rs/src/adaptation/advance_cycle.rs`
- Modify: `packages/engine-rs/tests/advance_cycle.rs`

- [ ] **Step 1: Add tests for rank-driven weight changes**

Expected behavior:

- `S`/`A`: preserve selected programs and slightly favor highest-adherence/highest-weight programs.
- `B`: preserve blend with conservative weights.
- `C`/`D`: preserve required challenge/adaptive family, reduce non-required volume, and keep injuries/fatigue conservative.

- [ ] **Step 2: Add tests for fatigue and injury carry-forward**

Expected behavior:

- severe/high fatigue keeps or lowers `fatiguePreference`.
- injury constraints carry into the next request.
- no unsafe exercise selection is performed inside `advance_cycle`; detailed swaps remain `initialize_cycle` responsibility.

- [ ] **Step 3: Replace `build_next_cycle_request(recommended_class_choice)`**

Introduce helpers:

- `read_current_cycle_request(input) -> Option<&Value>`
- `evolve_selected_program_weights(current, rank, signals) -> Value`
- `evolve_profile(current, rank, recovery_signal) -> Value`
- `carry_program_adaptation_inputs(current, input) -> Value`
- `build_personalized_next_cycle_request(input, recommended_class_choice, season_rank) -> Value`

- [ ] **Step 4: Preserve compatibility fallback**

If no current-cycle context is present, emit the current generic request so old callers keep working.

- [ ] **Step 5: Add decision-log evidence**

Add entries with stable rule IDs:

- `advance_cycle_next_blend_retention_v1`
- `advance_cycle_next_fatigue_adjustment_v1`
- `advance_cycle_next_injury_carry_forward_v1`
- `advance_cycle_next_baseline_carry_forward_v1`

- [ ] **Step 6: Run Rust tests**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test advance_cycle
cargo test --manifest-path packages/engine-rs/Cargo.toml
```

Expected: pass.

## Task 4: Integrate App Service Context Passing

**Files:**

- Modify: `apps/web/src/modules/cycles/service.ts`
- Test: `apps/web/tests/advance-cycle-service.test.ts` or extend existing cycle service tests.

- [ ] **Step 1: Write a service test**

Assert that `handleAdvanceCycle` or the current cycle-advance service passes:

- active program mix
- initialized selected program templates
- `programAdaptationInputs`
- injury slugs
- fatigue preference
- season completion signals

into the Rust runner.

- [ ] **Step 2: Implement minimal service mapping**

Use normalized app-owned persisted rows as reference input only. Do not let DB rows become engine boundary types.

- [ ] **Step 3: Verify persistence still works**

Assert the returned `nextCycleRequest` and `nextCyclePreview` are persisted/read as before.

- [ ] **Step 4: Run app tests**

Run:

```bash
npm run test --workspace apps/web -- tests/advance-cycle-service.test.ts
npm run typecheck --workspace apps/web
```

Expected: pass.

## Task 5: Add Replay/Backtest Observation For The Beta Scenario

**Files:**

- Modify: `packages/engine-rs/tests/advance_cycle.rs`
- Modify or add: `docs/operations/wave_7_beta_feedback_log.md`
- Optional modify: existing season-loop/backtest docs if the current harness stores scenario manifests.

- [ ] **Step 1: Add a deterministic replay stability test**

Run `advance_cycle` twice with the blended fixture and assert identical JSON output and replay hashes.

- [ ] **Step 2: Add an initialize compatibility test**

Feed the personalized `nextCycleRequest` back into `initialize_cycle` with matching reference snapshot data.

Expected: initialize succeeds and selected programs still include powerlifting, bench, and challenge work.

- [ ] **Step 3: Add feedback closure evidence**

Update `FDB-20260504-003` after tests pass:

- status: `closed`
- decision: `closed_after_personalized_advance_cycle`
- replay reference: new fixture/test name

- [ ] **Step 4: Run focused beta rehearsal**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test advance_cycle
cargo test --manifest-path packages/engine-rs/Cargo.toml --test initialize_cycle initialize_cycle_
npm run test --workspace apps/web -- tests/advance-cycle-service.test.ts
```

Expected: pass.

## Task 6: Final Verification

**Files:**

- No additional files unless failures require fixes.

- [ ] **Step 1: Run full local quality**

Run:

```bash
npm run ci:quality
```

Expected: pass.

- [ ] **Step 2: Run live beta gates if app integration changed**

Run:

```bash
$env:RUN_SUPABASE_E2E_VERIFICATION='1'; npm run test --workspace apps/web -- tests/supabase-e2e-verification.test.ts
$env:RUN_PLAYWRIGHT_E2E='1'; npm run test:e2e:playwright
```

Expected: pass.

- [ ] **Step 3: Run GitNexus change detection before commit**

Run GitNexus `detect_changes` and verify affected scope matches `advance_cycle`, contracts, and cycle service.

- [ ] **Step 4: Commit**

Commit message:

```bash
git commit -m "feat: personalize next-cycle blend evolution"
```

## Acceptance Criteria

- `advance_cycle` keeps the user's selected blend when current-cycle context is provided.
- Required adaptive/challenge programs survive season advancement.
- Strength and challenge baselines carry into the next request.
- Injury constraints and fatigue signals shape the next request at the profile/volume-intent level.
- Generic fallback behavior remains for callers that do not provide context.
- `nextCycleRequest` remains `initialize_cycle` compatible.
- Decision logs explain each replayable next-cycle evolution rule.
- Feedback `FDB-20260504-003` is closed with replay/test evidence.
