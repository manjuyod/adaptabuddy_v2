# Complete exercise replacement coverage implementation plan

**Goal:** Satisfy the catalog and Rust replacement requirements in
`docs/data/exercise-replacement-coverage.md` with source-backed exercises,
independent coverage gates, and owner-checked runtime selection.

**Architecture:** Supabase holds reference exercises, explicit equipment
requirements, classification, and a coverage contract. Rust reads that catalog
and applies replacements only to owned, unstarted plans using an explicit
prescription. PostgreSQL transactions protect history and concurrent writes.

**Constraints:** Preserve existing IDs and user data. Do not reset the populated
local database or access a hosted database. Do not use duplicate names or
unrelated movements to satisfy counts. Do not infer clinical safety or silently
convert repetitions into duration. Preserve RLS and typed authentication.

## Acceptance

- Every active record has an explicit reviewed replacement classification.
- Every eligible category/family has an independently specified expectation for
  all four existing equipment inventories.
- Required inventories contain at least three distinct available variant groups,
  leaving at least two alternatives after excluding the original variant.
- Unsupported inventories must have zero candidates and a specific equipment
  explanation; one or two candidates cannot be waived.
- Raw zero/one counts remain visible alongside the contract result.
- Catalog-backed Rust routes filter equipment, category, family, duplicate
  variants, and caller exclusions. Mutation uses verified ownership, protects
  started/history rows, and validates the new prescription.
- Fresh install, populated upgrade, replay, RLS, ownership, race, and invalid
  input tests pass, plus the repository's complete Rust quality gate.

## Work and ownership

1. Database specialist: new `20261003120000` contract/status migration and
   independent audit/regression SQL. Test thresholds before additions.
2. Root: source research, strength alternatives, classification of legacy rows,
   and `20261003122000` data migration. Preserve original reference IDs.
3. Catalog researcher: `20261003123000` non-strength alternatives, covering
   stretches, Pilates, balance, mobility, and supported recovery techniques.
4. Root: `20261003124000` explicit requirement/inventory data, iterate until all
   gates pass without weakening expectations, and document remaining physical
   constraints.
5. Rust specialist: `backend/**`, API contracts, and a coordinated `20261003121000`
   prescription migration if needed. Use focused new modules and meaningful
   API/storage tests. Perform GitNexus impact checks before symbol edits.
6. Root: run isolated PostgreSQL validation, review API/security/data changes,
   apply only pending migrations locally, verify preservation and actual API
   behavior, update the coverage document with final measured results.

The Android interface and deferred web/legacy engines are outside this change;
the canonical Rust endpoints provide the runtime integration requested by the
coverage document. No commit or deployment is part of this task.

## Completed validation

Applied locally through `20261003126000` without a reset: 128 additions, 356
total exercises, 349 active and 340 replacement-eligible. All 264 independent
family/profile checks pass (226 required; 38 equipment-only exceptions).
Fresh PostgreSQL 15.19 migrations, replay, deliberate missing-variant failure,
RLS/storage regressions, local PostgreSQL 17.6 validation, the Rust quality gate,
and explicit PostgreSQL API/storage tests pass. Prior exercise IDs/creation
times and checksums of 58 other public/Auth tables are preserved. See the
coverage report for measurements, classifications and scope limits.
