# Gamification Notes

## Current Baseline

- Gamification is already modeled as a deterministic, engine-owned layer in the Rust reference crate.
- Current state uses `xp`, `level`, and deterministic reward inputs that remain replayable from structured fields.
- Gamification stays biasing-only and cannot override safety, injury, fatigue, or equipment constraints.

## XP Rules

- XP is deterministic and split into three parts:
  - completion quality base XP
  - adherence streak bonus
  - progression bonus
- Baseline quality values:
  - `complete_clean` -> 15 XP
  - `complete_compromised` -> 10 XP
  - `partial` -> 5 XP
  - `missed` -> 0 XP
- Streak bonus is bounded and capped at 5 XP.
- Progression bonus is 5 XP for `overload` and 0 XP for `maintain`, `regress`, or `swap`.
- The total reward is the sum of those pieces and is applied to the current XP total.

## Level Rule

- Leveling uses a deterministic XP threshold function.
- Current thresholds:
  - level 1: 0-49 XP
  - level 2: 50-99 XP
  - level 3: 100-199 XP
  - level 4: 200-349 XP
  - level 5: 350-549 XP
  - level 6: 550-799 XP
  - level 7 and above continue in deterministic 300-XP bands: 800, 1100, 1400, and so on
- `levelUpIndicator` is true only when the new XP total crosses a threshold.

## Patch Conventions

- State patches are semantic and engine-owned only.
- Allowed top-level buckets:
  - `progressionState`
  - `readinessState`
  - `gamificationState`
- `progressionState` is keyed by stable exercise IDs, not DB rows or array indices.
- `readinessState` and `gamificationState` are merged as engine-owned buckets.
- The patch does not encode app persistence shapes or storage diffs.

## Invariants

- Same input state, same seed, and same rule version must produce the same patch.
- Gamification counters are monotonic unless a future explicit reset rule says otherwise.
- No wall clock, locale, environment variable, or unordered iteration may affect the reward or patch output.
- The patch must remain replayable from the structured fields alone.

## Current Gaps

- Spec 03 still needs the final decision-log and selection rules that describe how gamification contributes without becoming a control layer.
- Spec 04 still needs the final replay-receipt and tie-break policy details that may reference gamification-derived outputs.
- Spec 05 still needs any replay fixtures that pin XP and level transitions at boundaries.
- No new gamification dimensions should be added until the engine normalization and replay specs settle.

## Next Handoff

- Keep gamification deterministic and biasing-only.
- Preserve the current XP, level, and patch semantics unless a later spec explicitly changes them.
- Avoid adding social, economy, achievement, or narrative layers in this branch.
