# Rust Engine Integration Notes

## Current Baseline

- The Rust reference crate remains the execution baseline for the engine-first MVP, with public flow `EngineInputV1 -> plan_session/complete_session -> EngineOutputV1`.
- As of March 28, 2026, `cargo test -q` in `packages/engine-rs` is green after aligning the shared hard-block path, permitted widening, and the universal collapse rule.
- `plan_session` now emits structured `inputsUsed[]`, explicit `scope` and `filter` trace entries that preserve engine reference order, one `score` entry per scored survivor, tie-band details on `tie_break`, and explicit `final_selection` details while keeping the public score families fixed to `progressionNeed`, `fatigueCompatibility`, `classBias`, and `novelty`.
- `plan_session` now derives `filter.details.blocked[]` and `result.blockedCandidateIds` from the same shared hard-block evaluation in `constraints.rs`, respects the fatigue block threshold during filtering, widens before rejecting, and uses the family-universality collapse rule for universal fatigue or injury pools.
- Exact-exercise `swap` exclusions now use the stable `explicit_disqualifier` hard-block code with the `progression_swap_required_exact_exercise` detail code.
- Rejection-path scope logging now records exhausted preferred scope truthfully when widening is attempted but still yields no survivors, and injury hard-block detail codes now distinguish blocked-pattern versus active-limitation shortcut causes.
- Added an end-to-end `fatigue_blocked` rejection case at the `plan_session` layer that verifies widening, family-filtered blocked IDs, and rejection-log coherence.
- `complete_session` now emits structured `classify`, `state_update`, and `award_xp` entries, including progression, readiness, gamification, and canonical retained `recentCompletions` trace detail, while keeping `statePatch` ownership limited to `progressionState`, `readinessState`, and `gamificationState`.
- Replay receipts remain on the existing public envelope and field set; this wave tightened field semantics and baseline coverage without introducing a new public version.

## Decisions Made

- Closed public V1 soft-score categories to exactly `progressionNeed`, `fatigueCompatibility`, `classBias`, and `novelty`.
- Closed rule hierarchy to: hard constraints and widening first, then co-primary progression and fatigue or recovery scoring, then bounded class bias, then bounded novelty, then seeded top-band selection.
- Closed `fatigueCompatibility` as the public V1 home for recovery-budget semantics; recovery budgeting is required conceptually but not serialized as its own score field.
- Closed seeded selection to the current Rust-aligned top-band model: rank by total descending then `candidateId` ascending, form the eligible band from `policySnapshot.seededTieBreakBand`, and use deterministic seeded choice only inside that band.
- Closed public V1 `decisionLog` ordering and schema, including structured `inputsUsed[]`, required `scope` and `state_update` entries, candidate-level hard-block records, full score entries for scored survivors, and explicit tie-band details.
- Closed public `replayReceipt` field meanings and clarified what is already closed versus still open: field names and semantic membership are closed, canonical bytes and final hash algorithm are still open.
- Implemented the closed `engine_04` contract in Rust without changing `EngineInputV1` or `EngineOutputV1`.
- Centralized hard-block evaluation in `packages/engine-rs/src/constraints.rs` and made `plan_session` consume that shared result for filtering, logging, widening, and rejection collapse.
- Kept semantic patch ownership boundaries closed to `progressionState`, `readinessState`, and `gamificationState`; retained `recentCompletions` as trace detail rather than a public state-patch bucket in this wave.
- Kept the legacy helper surface in `packages/engine-rs/src/logging.rs` as a non-runtime convenience layer; it is not the source of truth for the public decision-log envelope.
- Promoted the richer `plan_session` and `complete_session` envelopes to the canonical JSON goldens so the new trace shape is now the baseline rather than an implementation-only detail.

## Open Questions

- Whether the eventual cross-language numeric policy should freeze fixed-point semantics for public score totals or only require implementation-local determinism within a `ruleVersion`.
- Whether a future boundary revision should promote any currently deferred soft-score concepts, such as movement balance or adherence trend, into separate public score categories.
- Whether future cross-language replay closure should promote canonical serialized bytes and hash algorithm details into a stricter public replay specification.

## Next Handoff

- Treat `docs/archive/specs/engine_04_scoring_selection_and_decision_logs.md` as the closed source of truth for scoring, selection, public logs, and replay receipts.
- Any downstream Rust work should treat the current golden envelopes and property tests as the locked Wave 1 baseline and should not reopen the score-family hierarchy or seeded-selection policy without a new spec change.
- Follow-on replay work should start from the remaining serialization and cross-language determinism questions, not from trace-shape gaps that are now closed.
- If another worker needs to continue from here under context pressure, start from the green `cargo test -q` baseline and re-read the golden outputs plus the property tests before proposing envelope changes.

## Pending Review Findings

- None recorded yet for the post-alignment green baseline.
