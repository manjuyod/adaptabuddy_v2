# Wave 12: Product Shell Re-entry

## Goal

Return to `apps/web` only after CLI Season Loop evidence is stable enough to support user-facing product work.

## Status

- `State`: Complete
- `Priority`: Medium
- `Depends On`:
  - `docs/specs/wave_10_cli_season_loop_harness.md`
  - `docs/specs/wave_11_simulation_evidence_and_balance_triage.md`

## Primary Work

- Convert stable Season Loop evidence into user-facing UI and support/debug workflows.
- Ensure rank, awards, and next-season recommendation presentation matches validated engine output.
- Add release-candidate gates that reference local CLI evidence before live Supabase E2E, authenticated analytics, or Playwright browser verification.
- Keep app-shell responsibilities separate from deterministic engine decisions.

## Exit Criteria

- Product-shell changes are backed by Wave 10/11 evidence.
- Release-candidate gates or checklists explicitly reference Wave 10/11 CLI evidence before live Supabase E2E, authenticated analytics, or Playwright browser verification.
- Release-gate documentation preserves replay receipt expectations and route-level evidence requirements for support.
- Live beta validation resumes as downstream release evidence, not as the first proof that the loop works.

## Completion Evidence

- Wave 11 baseline: `docs/operations/wave_11_cli_simulation_evidence.md`
- Release checklist update: `docs/operations/deployment_verification_checklist.md`
- Release evidence pack update: `docs/operations/private_beta_release_evidence_pack.md`
- Release runbook update: `docs/operations/release_operations_runbook.md`
- Result: CLI Season Loop evidence is now a required pre-live gate before live Supabase E2E, authenticated analytics, or Playwright browser verification.

## Out Of Scope

- Engine-boundary changes without a completed decision memo.
- Treating DB rows or UI copy as canonical engine state.
