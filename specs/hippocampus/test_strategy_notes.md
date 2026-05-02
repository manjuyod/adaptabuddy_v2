# Rust Engine Test Strategy Notes

## Current Baseline

- The Rust reference crate is the Wave 1 evidence source for `engine_05`.
- Current module coverage includes `boundary`, `constraints`, `progression`, `scoring`, `gamification`, `rng`, and `logging`.
- Current integration coverage includes `plan_session`, `complete_session`, `state_update_loop`, `replay_hashes`, `public_api_failures`, `plan_session_properties`, `complete_session_properties`, and `replay_chain`.
- Two full JSON goldens already exist: one named `plan_session` baseline and one named `complete_session` baseline, and both pin the current derived replay hashes rather than placeholder hashes.
- As of March 28, 2026, `cargo test -q` in `packages/engine-rs` is green with the current replay and trace suite.
- As of March 29, 2026, an explicit ignored Monte Carlo lane exists in `packages/engine-rs/tests/monte_carlo.rs`; it samples valid `plan_session`, invalid `plan_session`, valid `complete_session`, invalid `complete_session`, and replay-chain scenarios and writes failure artifacts to `tmp/engine-monte-carlo/latest-failures.json` when an invariant breaks.
- Current replay coverage now proves identical-input stability, metadata insensitivity, plan reference-order insensitivity, `effectiveAt` sensitivity for both `plan_session` and `complete_session`, `ruleVersion` sensitivity, seed variation, microcycle variation, canonicalization-version variation for `plan_session`, completion-classification variation, note-only non-material `complete_session` variants, canonically equivalent `recentCompletions` replay-chain stability, and closed-loop `complete -> patch -> next plan` determinism. The derived replay-hash path is now exercised directly with no placeholder shortcut, including metadata-only and note-only exclusion checks on non-baseline inputs.
- Current public-boundary coverage already rejects malformed request shapes, invalid scalar ranges, invalid datetimes, and unknown fields, and accepts the canonical nullable `complete_session` request shape.
- The first Monte Carlo run surfaced a meaningful boundary defect: `plan_session` accepted empty `programId` and empty `sessionFocus` strings, which allowed malformed `recommendedSessionId` values like `-upper-push-m2`. The boundary now rejects both as invalid public input.
- The current baseline now includes explicit scenarios for public rejection-summary precedence, candidate-level rejection trace retention, widening-transition trace assertions, canonical `recentCompletions` window ordering, the public `complete_session` level-up threshold, closed-loop replay, and baseline-golden promotion of the richer public logs.

## Decisions Made

- Wave 1 fixture classes are now fixed as: baseline decision, hard-constraint or rejection, stateful outcome, threshold, non-material variant, material replay variant, replay-chain, and public-boundary validation fixtures.
- Full goldens are reserved for the two named baseline public envelopes. New scenarios default to partial assertions unless they are intentionally promoted to canonical baselines.
- Partial assertions are now the default policy for branch behavior, typed rejection codes, public rejection-summary precedence, candidate-pipeline trace coverage, state-patch bucket boundaries, decision-log ordering, metadata insensitivity, free-text-note insensitivity, reference-backed identifiers, monotonic gamification behavior, canonical `recentCompletions` window behavior, and closed-loop replay guarantees.
- Replay policy is now explicit: same canonical input plus the same seed and version metadata must reproduce the same output; metadata-only changes and `complete_session` free-text note changes must not perturb outputs or authoritative replay hashes; seed, `effectiveAt`, `ruleVersion`, cycle, canonicalization-version, and classification changes are material replay inputs; malformed public inputs must fail before engine execution. `outputHash` now tracks public output material, while note-only request fields stay excluded from `inputHash`.
- The replay-hash field membership is closed by `engine_02`, and Engine 22 closes the Rust MVP canonical byte serialization, SHA-256 hash policy, reference-hash verification, canonicalization-version enforcement, and hash-safe numeric policy.
- The stateful progression and gamification loop is now part of required engine coverage, not optional integration coverage. Required behavior includes all four completion outcomes, progression action branching, XP and streak updates, bounded class bias, fatigue-aware planning changes, the required public `complete_session` level-up threshold path, canonical `recentCompletions` window handling, deterministic next-plan reconstruction from the semantic state patch, and closed-loop replay. The stronger `recentCompletions` patch-driven propagation claim remains outside the current public patch surface.
- Audit note: the spec draft had stale wording that still implied explicit `effectiveAt` coverage was pending; the actual baseline now includes a `complete_session` effectiveAt replay-hash regression test, so that contradiction is resolved.
- Regression policy is now split between contract regressions, which require loud failures and spec plus test updates, and heuristic regressions, which may allow tuning changes so long as invariant and replay guarantees hold.

## Open Questions

- Cross-language replay certification against the completed Engine 22 canonical replay policy.
- Broader future permutation coverage beyond the current Wave 1 fixture set.

## Next Handoff

- Treat `docs/archive/specs/engine_05_testing_and_replay.md` as the normative Wave 1 policy document for test strategy and replay scope.
- If downstream Rust alignment work is scheduled, preserve the current property-test and golden-test coverage as the minimum floor; new scenarios should extend the suite without weakening the partial-assertion policy.
- Do not expand full-golden coverage casually. Additive scenarios should begin as partial assertions unless the team intentionally wants a new canonical baseline.
- Treat canonical serialization, hash-algorithm policy, and numeric policy as closed for the Rust MVP by Engine 22; add future tests only when implementation scope or cross-language certification expands.

## Pending Review Findings

- None recorded for the current baseline after the effectiveAt replay coverage fix.
