# Wave 11 CLI Simulation Evidence

This record closes `Wave 11: Simulation Evidence And Balance Triage` for the initial Wave 10 CLI harness pass.

## Scope

- Evidence source: `season_loop_backtest`
- Harness spec: `docs/specs/wave_10_cli_season_loop_harness.md`
- Wave 11 spec: `docs/specs/wave_11_simulation_evidence_and_balance_triage.md`
- Commit baseline: `00f8246`
- Environment: local developer machine

## Commands

```bash
cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario all --cycles 5
cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario s-rank --cycles 1
cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario a-rank --cycles 1
cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario b-rank --cycles 1
cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario c-rank --cycles 1
cargo run --quiet --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario d-rank --cycles 1
cargo test --manifest-path packages/engine-rs/Cargo.toml --test season_loop_backtest
```

## Evidence Summary

| Scenario | Exit | Schema | Cycle count | Archetypes | Rank timeline | Invariant failures | Replay summaries |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: |
| `all` | 0 | `engine.v1` | 5 | 5 | `S, A, B, C, D` | 0 | 5 |
| `s-rank` | 0 | `engine.v1` | 1 | 1 | `S` | 0 | 1 |
| `a-rank` | 0 | `engine.v1` | 1 | 1 | `A` | 0 | 1 |
| `b-rank` | 0 | `engine.v1` | 1 | 1 | `B` | 0 | 1 |
| `c-rank` | 0 | `engine.v1` | 1 | 1 | `C` | 0 | 1 |
| `d-rank` | 0 | `engine.v1` | 1 | 1 | `D` | 0 | 1 |

Focused CLI test result:

```text
7 passed; 0 failed
```

## Triage

| ID | Classification | Severity | Owner | Status | Evidence | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `W11-CLI-001` | `deterministic-engine-behavior` | `low` | `user` | `closed` | All supported rank scenarios emitted expected ranks, replay summaries, and zero invariant failures. | No engine-boundary spec needed. |
| `W11-CLI-002` | `replay-debuggability` | `low` | `user` | `closed` | Every scenario emitted replay receipt summary fields. | Replay evidence is sufficient for Wave 12 re-entry planning. |
| `W11-CLI-003` | `app-shell` | `low` | `user` | `actionable` | CLI evidence exists, but release checklists do not yet reference it as a product-shell gate. | Carry into Wave 12. |

## Balance Notes

- Current rank fixtures cover the expected S/A/B/C/D spread.
- No invariant failure was observed for next-cycle request compatibility.
- No policy tuning or fixture-gap issue was found in this initial evidence pass.
- This evidence validates the headless CLI harness and engine fixture surface. It does not validate browser, Supabase, RLS, or deployment behavior.

## Decision

- Wave 11 evidence status: `sufficient_for_product_shell_reentry`
- New engine spec decision: `no_engine_spec`
- Wave 12 handoff: add product-shell/release-gate references to Wave 10/11 CLI evidence before live Supabase or browser E2E is treated as release confidence.
