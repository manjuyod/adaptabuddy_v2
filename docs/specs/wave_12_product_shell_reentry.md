# Wave 12: Product Shell Re-entry

## Goal

Return to `apps/web` only after CLI Season Loop evidence is stable enough to support user-facing product work.

## Status

- `State`: Later
- `Priority`: Medium
- `Depends On`:
  - `docs/specs/wave_10_cli_season_loop_harness.md`
  - `docs/specs/wave_11_simulation_evidence_and_balance_triage.md`

## Primary Work

- Convert stable Season Loop evidence into user-facing UI and support/debug workflows.
- Ensure rank, awards, and next-season recommendation presentation matches validated engine output.
- Add release-candidate gates that reference local CLI evidence before live Supabase or browser E2E.
- Keep app-shell responsibilities separate from deterministic engine decisions.

## Exit Criteria

- Product-shell changes are backed by Wave 10/11 evidence.
- Release-candidate gates or checklists explicitly reference Wave 10/11 CLI evidence before live Supabase or browser E2E evidence.
- UI and API behavior preserve replay receipts and route-level evidence for support.
- Live beta validation resumes as downstream release evidence, not as the first proof that the loop works.

## Out Of Scope

- Engine-boundary changes without a completed decision memo.
- Treating DB rows or UI copy as canonical engine state.
