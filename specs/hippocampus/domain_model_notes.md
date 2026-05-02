# Domain Model Notes

## Current Baseline

- The Rust reference crate remains the current implementation baseline for the engine-first MVP boundary.
- The public envelopes stay `EngineInputV1` and `EngineOutputV1`.
- The current MVP operation surface remains `initialize_cycle`, `plan_session`, and `complete_session`.
- The Rust boundary already parses typed `referenceSnapshot`, `stateSnapshot`, and `policySnapshot`, while `request`, `metadata`, and `events` remain JSON envelope values.
- `stateSnapshot` is already modeled in Rust as athlete profile, readiness, injury, performance, progression, gamification, active program, and recent completions.

## Decisions Made

- `engine_02` is now decision-complete for normalization without changing the public envelope.
- The addendum is treated as normative input, but V1 freezes the concrete `stateSnapshot` buckets to:
  - `athleteProfile`
  - `readinessState`
  - `injuryState`
  - `performanceState`
  - `progressionState`
  - `gamificationState`
  - `activeProgramState`
  - `recentCompletions`
- For V1, bounded recent completion summaries live only in top-level `stateSnapshot.recentCompletions`; overlapping addendum wording under `performanceState` is deferred rather than duplicated into the envelope.
- `athleteProfile.trainingAge` is the canonical V1 experience field. `experienceLevel`, `age`, and `sex` stay out of the normalized V1 snapshot.
- `gamificationState` is frozen to `xp`, `level`, and `adherenceStreak` for V1.
- `recentCompletions` is explicitly a bounded replay bucket:
  - partition by `exerciseId`
  - sort each bucket by `completedAt` descending so later UTC instants are more recent, then by normalized `quality` token lexicographically ascending
  - keep the first three entries per bucket
  - re-sort the retained entries by `exerciseId`, `completedAt`, `quality` lexicographically ascending for the final hashed canonical array
- Canonical units are app-owned before invocation:
  - height in centimeters
  - bodyweight and lifted weight in kilograms
  - counts and indices as non-negative integers
  - RPE and RIR as bounded integers when present
- Canonical timestamps are explicit UTC RFC3339 strings ending in `Z`, with `determinism.effectiveAt` as the authoritative decision-time input.
- `plan_session.request.programId` and `plan_session.request.microcycleIndex` must match `stateSnapshot.activeProgramState.programId` and `stateSnapshot.activeProgramState.currentMicrocycle` exactly; mismatch is invalid canonical input and is rejected before engine execution.
- In V1, `complete_session.session.seed` is a duplicated provenance copy of top-level `determinism.seed`, not an independent sub-seed. Mismatch is invalid canonical input and is rejected before engine execution.
- Deterministic ordering is now locked:
  - sort reference arrays by `id`
  - sort progression records by `exerciseId`
  - truncate `recentCompletions` per exercise before the final canonical sort
  - sort the retained `recentCompletions` entries by `exerciseId`, `completedAt`, `quality`
  - use ordered maps for `muscleFatigue` and `knownLifts`
- Stable string `id` is the authoritative join key. Slugs are descriptive reference metadata only and are required only for reference exercises/programs.
- Replay-hash field expectations are now fixed and implemented for the Rust MVP:
  - `determinism.referenceHash` must match the normalized `referenceSnapshot` under the Engine 22 canonical replay serialization and hash policy
  - mismatch is a canonicalization failure, not a log-only condition
  - `inputHash` covers the outcome-relevant canonical input
  - `metadata` and free-text notes are excluded
  - canonical JSON serialization, SHA-256 hash formatting, and hash-safe numeric policy are closed by `engine_22`
- App persistence shapes, DB rows, transport wrappers, and `users.stats_json` are explicitly excluded from the canonical engine boundary.

## Open Questions

- Cross-language replay certification remains open until another implementation exists and is checked against the Engine 22 fixture bundle.
- `policySnapshot` still has no public `policyVersion` field; the replay receipt version remains implementation-owned for now.
- The addendum mentions richer progression counters and gamification milestone state, but those remain deferred until a later boundary revision explicitly models them.

## Next Handoff

- `engine_03` can now assume the normalized input buckets, unit policy, timestamp policy, and ordering rules are fixed for Wave 1.
- `engine_03` should not introduce source-precedence fallbacks for duplicated program, microcycle, or seed fields; the normalization contract now rejects mismatches instead.
- `engine_22` closes the canonical serialization, replay-hash algorithm, and numeric representation policy for the Rust MVP baseline.
- Any downstream Rust or TypeScript alignment work should preserve the frozen `EngineInputV1` / `EngineOutputV1` envelope and avoid backfilling app persistence shapes into the boundary.
