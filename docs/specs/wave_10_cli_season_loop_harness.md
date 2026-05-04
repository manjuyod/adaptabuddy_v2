# Wave 10: CLI Season Loop Harness

## Goal

Promote the headless Season Loop harness into the active confidence gate before further frontend or live-beta expansion.

The target is a deterministic CLI workflow that can answer: does the local Season Loop behave consistently across archetypes, ranks, awards, next-cycle requests, and replay material?

## Status

- `State`: Active
- `Priority`: High
- `Depends On`:
  - `docs/specs/engine_30_headless_season_loop_and_backtest_harness.md`
  - `docs/specs/wave_9_season_loop_product_shell.md`

## Boundary

Wave 10 is engine-harness and developer workflow work.

It does not revise the public Rust envelope names. It should not introduce Supabase, auth, app persistence, browser, or React dependencies. The CLI consumes deterministic fixtures and public engine operations only.

## Primary Work

- Harden `packages/engine-rs/src/bin/season_loop_backtest.rs` into a useful CLI harness.
- Add scenario selection for rank/archetype fixtures.
- Add cycle count controls with clear validation errors.
- Emit deterministic JSON reports with rank, awards, next-cycle request, invariant failures, and replay receipt summaries.
- Add npm script entry points for running the harness from the repo root.
- Document the local CLI workflow and expected evidence shape.

## CLI Shape

The harness should support:

```bash
cargo run --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --cycles 5
cargo run --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario all --cycles 5
cargo run --manifest-path packages/engine-rs/Cargo.toml --bin season_loop_backtest -- --scenario s-rank --cycles 1
npm run engine:season-loop
```

The initial implementation should stay small and standard-library based unless argument parsing becomes meaningfully complex.

## Scenario Catalog

The initial scenario catalog is rank-fixture backed. `all` includes every supported scenario in deterministic catalog order.

| Scenario ID | Rank target | Fixture source | Included in `all` |
| --- | --- | --- | --- |
| `s-rank` | `S` | `fixtures::advance_cycle_s_rank_input` | yes |
| `a-rank` | `A` | `fixtures::advance_cycle_a_rank_input` | yes |
| `b-rank` | `B` | `fixtures::advance_cycle_b_rank_input` | yes |
| `c-rank` | `C` | `fixtures::advance_cycle_c_rank_input` | yes |
| `d-rank` | `D` | `fixtures::advance_cycle_d_rank_input` | yes |

## Report Shape

The JSON report should include:

- `schemaVersion`
- `generatedAt` or explicit deterministic report metadata that cannot affect engine output
- `cycleCount`
- `scenarioFilter`
- `archetypes`
- `rankTimeline`
- `awards`
- `nextCycleRequests`
- `replayReceipts`
- `invariantFailures`

Each archetype entry should also include its rank, awards, next-cycle request, replay receipt, and replay receipt summary. The report must remain deterministic for the same inputs. If a timestamp is included, it must be caller supplied or clearly excluded from replay comparison.

## Invariants

Wave 10 must prove:

- supported scenario names are discoverable
- invalid scenario names fail clearly
- invalid cycle counts fail clearly
- `all` runs every supported fixture
- emitted `nextCycleRequest` values are accepted by `initialize_cycle`
- output is deterministic for identical CLI arguments
- invariant failures are represented as structured JSON, not only stderr text

## Verification

Required focused gate:

```bash
cargo test --manifest-path packages/engine-rs/Cargo.toml --test season_loop_backtest
```

Required engine gate:

```bash
npm run test:engine
```

## Exit Criteria

- `season_loop_backtest` behaves as a deterministic CLI harness, not a one-off fixture printer.
- Root npm scripts expose the harness.
- Focused CLI tests cover success, filtering, argument failures, and deterministic output.
- The roadmap can hand Wave 11 a stable report format for balance and evidence triage.

## Out Of Scope

- New app UI.
- Live Supabase verification.
- DB schema changes.
- New engine operation names.
- Policy tuning beyond what is needed to expose evidence.
