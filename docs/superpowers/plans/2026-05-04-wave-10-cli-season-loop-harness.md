# Wave 10 CLI Season Loop Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `season_loop_backtest` into the active CLI confidence gate for local Season Loop behavior.

**Architecture:** Keep the harness inside `packages/engine-rs` and reuse public engine operations plus existing fixtures. Add a small argument parser, stable scenario catalog, deterministic JSON report shape, focused CLI tests, and root npm scripts.

**Tech Stack:** Rust 2021, serde/serde_json, cargo integration tests, npm scripts.

---

## File Map

- Modify: `packages/engine-rs/src/bin/season_loop_backtest.rs`
- Modify: `packages/engine-rs/tests/season_loop_backtest.rs`
- Modify: `package.json`
- Modify: `docs/specs/wave_10_cli_season_loop_harness.md` if implementation details differ from the accepted spec

### Task 1: Lock CLI Argument Behavior

**Files:**
- Modify: `packages/engine-rs/tests/season_loop_backtest.rs`

- [ ] **Step 1: Add failing tests for explicit args**

Cover:
- `--cycles 5`
- `--scenario all --cycles 5`
- `--scenario s-rank --cycles 1`
- invalid scenario exits non-zero
- invalid cycle count exits non-zero

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test season_loop_backtest
```

Expected: FAIL until the binary supports named flags.

### Task 2: Implement Minimal Argument Parsing

**Files:**
- Modify: `packages/engine-rs/src/bin/season_loop_backtest.rs`

- [ ] **Step 1: Add a small `Config` parser**

Support:
- default `scenario = all`
- default `cycles = supported scenario count`
- `--scenario <all|s-rank|a-rank|b-rank|c-rank|d-rank>`
- `--cycles <positive integer>`
- legacy positional cycle count only if preserving old behavior is cheap

- [ ] **Step 2: Add clear usage errors**

Return non-zero with stderr for unknown flags, missing values, invalid scenarios, and zero/invalid cycle counts.

- [ ] **Step 3: Run focused test**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test season_loop_backtest
```

Expected: argument tests pass or expose report-shape gaps for Task 3.

### Task 3: Stabilize Report Shape

**Files:**
- Modify: `packages/engine-rs/src/bin/season_loop_backtest.rs`
- Modify: `packages/engine-rs/tests/season_loop_backtest.rs`

- [ ] **Step 1: Emit deterministic report metadata**

Include:
- `schemaVersion`
- `cycleCount`
- `scenarioFilter`
- `archetypes`
- `rankTimeline`
- `awards`
- `nextCycleRequests`
- `replayReceipts`
- `invariantFailures`

- [ ] **Step 2: Add per-archetype evidence fields**

For each archetype include rank, awards, next-cycle request, replay receipt, and stable replay receipt summary fields from `advance_cycle` output when present.

- [ ] **Step 3: Add deterministic output test**

Run the same CLI args twice and assert parsed JSON equality.

- [ ] **Step 4: Run focused test**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test season_loop_backtest
```

Expected: PASS.

### Task 4: Add Root Script Entry Points

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `engine:season-loop` script**

Command:

```json
"engine:season-loop": "cargo run --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario all"
```

- [ ] **Step 2: Run script manually**

Run:

```bash
npm run engine:season-loop -- --cycles 5
```

Expected: JSON report on stdout and exit code 0.

### Task 5: Verification

**Files:**
- No code changes

- [ ] **Step 1: Run focused CLI tests**

Run:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test season_loop_backtest
```

Expected: PASS.

- [ ] **Step 2: Run engine test gate**

Run:

```bash
npm run test:engine
```

Expected: PASS.

- [ ] **Step 3: Run harness command**

Run:

```bash
npm run engine:season-loop -- --cycles 5
```

Expected: deterministic JSON report with empty `invariantFailures`.
