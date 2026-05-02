# Scoring and Progression Notes

## Current Baseline

- The Rust MVP currently evidences exercise-level candidate enumeration, deterministic hard filtering, score breakdown fields, seeded tie-band selection, and the typed public rejection codes `injury_blocked`, `fatigue_blocked`, and `no_valid_candidates`.
- `packages/engine-rs/src/constraints.rs` also defines string constants for `equipment_blocked` and `lock_required`, but the current typed Rust boundary and `plan_session` path do not make those codes reachable end-to-end.
- Current `plan_session` behavior preserves reference iteration order before scoring, prefers requested focus family first, and widens to cross-family fallback only when the preferred bucket is empty.
- Current hard-filter evidence is strongest for `blockedMovementPatterns`, the active-limitation push shortcut, and severe systemic-fatigue blocking on push candidates. `muscleFatigue` is normalized V1 state but is not yet a closed generic hard-block rule.
- Current Rust decision logs still model `inputsUsed` as string arrays rather than structured source-path references.

## Decisions Made

- Locked the Wave 1 candidate pipeline order as: resolve scope, enumerate reference candidates, project typed descriptors, attach stateful context, evaluate hard constraints, apply permitted widening, materialize post-filter candidate set.
- Narrowed active Wave 1 hard-constraint families to injury safety, closed-V1 systemic-fatigue safety, and exact-exercise progression-driven explicit disqualifiers so the spec stays implementable against `engine_02`.
- Deferred equipment availability and lock requirements until a future boundary revision adds canonical availability or lock inputs.
- Deferred request or policy exclusion lists, generic safety deny-lists, source-lineage exclusions, recovery-policy unsafe markers, and generic local-fatigue demand-profile blocking because V1 does not carry canonical inputs for them.
- Froze class bias, novelty, adherence, goal bias, and non-threshold readiness signals as non-blocking inputs that may influence scoring later but never candidate eligibility.
- Froze `explicit_disqualifier` as an internal hard-block code only for the exact `exerciseId` whose progression record says `currentAction = swap`.
- Closed widening authority to preferred-family-first, then cross-family fallback from normalized `request.sessionFocus`. No policy-controlled widening, lock-controlled widening, or archetype-controlled widening is part of closed V1.
- Kept candidate hard-block evidence, widening traces, and richer input references as semantic or internal trace requirements only; exact public `decisionLog` serialization is deferred to `engine_04`.
- Kept current public `plan_session` rejection reachability to `injury_blocked`, `fatigue_blocked`, and `no_valid_candidates`.
- Made operation-level rejection precedence deterministic: emit `fatigue_blocked` only when fatigue is universal across the exhausted hard-blocked pool, else `injury_blocked` when injury is universal, else `no_valid_candidates`.
- Locked pre-score ordering to reference-order preservation with no mixing of preferred and widened buckets; widened survivors keep original order and stable ID fallback only applies when upstream canonicalization already collapsed keyed-container ambiguity.
- Froze `blockedCandidateIds` ordering to ascending stable `candidateId` strings for rejection-envelope replay stability.
- Required retained metadata for both surviving and rejected candidates so `engine_04` can score and log without reconstructing pipeline context.
- Folded in the addendum by making progression-driven `swap` an exact-exercise exclusion only, with deterministic widening preserving movement intent through the current V1 focus-family-first then cross-family fallback rule.

## Open Questions

- What canonical boundary fields should carry equipment availability or lock requirements when those families are eventually activated.
- Whether a future boundary revision should close a canonical mapping from `muscleFatigue` bucket IDs to hard-block candidate rules.
- What exact public `decisionLog` serialization `engine_04` should choose for candidate hard-block evidence, widening traces, and input references.

## Next Handoff

- `engine_04` can now assume a fixed pre-score candidate set, active hard-block taxonomy, and retained metadata contract for the current MVP boundary.
- If context is tight for a successor worker, start from the closed decisions in `docs/archive/specs/engine_03_candidate_pipeline_and_constraints.md` and only inspect Rust files for downstream implementation drift, not to reopen pipeline order.
- Any follow-up implementation work should treat the current Rust behavior as partially aligned: injury/fatigue public rejection flow and focus-family-first widening are evidenced, while exact-exercise explicit-disqualifier handling and richer trace emission remain downstream alignment tasks.
- Equipment and lock blocking are not current Wave 1 `plan_session` responsibilities under `engine_01` plus `engine_02`; they stay future boundary work unless those specs change first.
