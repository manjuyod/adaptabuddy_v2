# Exercise replacement coverage — 2026-10-03

**The defined catalog and Rust API acceptance checks pass.** Local Supabase now
contains **356 exercises: 349 active, 340 eligible for replacement browsing**,
62 muscle groups and 787 anatomy associations. This pass added **128 exercises**
to the previous 228-record catalog, corrected existing metadata, classified
every active record, and implemented catalog-backed Rust replacement routes.

“Complete” means at least two distinct alternatives per eligible exercise
**within each supported equipment profile**. Equipment-only exceptions remain
explicit. This does not establish clinical suitability, equivalent difficulty,
or interchangeable load/dosage for every candidate.

## Acceptance contract

The independent contract has **264 checks: 66 category/family pairs across four
fixed inventories**. All **226 required cells pass**. The other **38 cells**
document unavailable equipment and have zero physically available variants.
A pool of one or two variants cannot be waived.

| Inventory | Required families passing | Equipment exceptions | Failures |
| --- | ---: | ---: | ---: |
| Household supports | 45 / 45 | 21 | 0 |
| Supports + bands and anchors | 55 / 55 | 11 | 0 |
| Supports + dumbbells, fixed bench and step | 60 / 60 | 6 | 0 |
| Explicit full gym inventory | 66 / 66 | 0 | 0 |

Each required cell has at least **three distinct available variant groups**,
leaving two after excluding the source's entire group. Aliases count once.
Sources stay in the denominator when their own equipment is unavailable;
only candidate equipment is filtered.

Household supports are `bodyweight`, `chair`, `wall`, `table`, `doorway`, and
`stable_counter`. Bands add `band`, `anchor`, and `high_anchor`; the dumbbell
profile adds `dumbbell`, `bench`, and `step`. Gym equipment lists each specific
machine, bar, attachment and implement. A generic `machine` token does not grant
every machine; ordinary chairs are not assumed to be rated dip benches or steps.
Exact inventories and family-specific exceptions are stored in
`exercise_replacement_profiles` and `exercise_replacement_coverage_requirements`.

## Raw coverage

These counts include **all 340 eligible sources**, including exercises requiring
equipment absent from the selected inventory. The zeros correspond to explicit
unsupported cells; no supported cell has a zero/one shortfall.

| Inventory | Zero candidates | Exactly one | At least two | At least two with identical tracking mode |
| --- | ---: | ---: | ---: | ---: |
| Household supports | 132 | 0 | 208 | 93 |
| Bands and anchors | 40 | 0 | 300 | 162 |
| Dumbbells, bench and step | 26 | 0 | 314 | 181 |
| Full gym | 0 | 0 | 340 | 256 |

Exceptions include hanging leg raises without a bar, step-ups without a suitable
step, tool-assisted glute self-massage without a roller/ball, and loaded pulling
without its required resistance/support setup. These describe the curated
catalog and fixed inventories, not a claim that no other variation could exist.
The API returns an empty list instead of silently changing the training goal.

For the **same 201 previously profiled sources**, additions and intentional
equipment/variant corrections improved coverage as follows:

| Inventory | Zero before → after | At least two before → after |
| --- | ---: | ---: |
| Household supports | 110 → 81 | 49 → 120 |
| Bands and anchors | 51 → 18 | 71 → 183 |
| Dumbbells, bench and step | 51 → 13 | 96 → 188 |
| Full gym | 25 → 0 | 148 → 201 |

## Additions and corrections

The 128 additions comprise **78 strength, 25 stretching, 12 Pilates, 8 mobility,
3 balance and 2 recovery** exercises. Cardio already had a sufficient pool of
concrete modalities. Current active category totals:

| Category | Active records |
| --- | ---: |
| Strength | 250 |
| Stretching | 41 |
| Pilates | 21 |
| Cardio | 14 |
| Mobility | 12 |
| Balance | 8 |
| Recovery | 3 |

Strength additions address ankle, calf, knee, hip, core, pressing, pulling,
rotator-cuff and wrist actions. Non-strength additions cover the Pilates,
balance and stretch families, plus hip/thoracic mobility and glute self-massage.
Variants differ in support, joint position, resistance or contraction; simple
synonyms and left/right labels do not inflate coverage.

The lower-body migration stages 33 rows: **32 new** and the existing
`copenhagen_hip_adduction`, whose chair-supported equipment is corrected.
The upper-body migration adds 46 and clarifies the existing bench dip as the
straight-leg version. Eleven previously unprofiled legacy movements receive
families/equipment/variants. Generic Romanian deadlift shares the barbell-RDL
group; sissy-squat anatomy is corrected to knee-extension work.

All additions have source URLs, original brief cues, qualitative anatomy and
tracking metadata. Adaptations not fully established by their exact source
retain `review_status = 'needs_review'` with provenance notes. That technique
review status is separate from replacement eligibility, which establishes the
functional browsing family and equipment, not clinical validation. Many legacy
technique records also still need editorial review. Rehabilitation dosages and
injury severity thresholds are not imported as universal prescriptions.
Non-strength anatomy contributes zero strength volume; strength weights remain
qualitative legacy heuristics, not percentages or EMG measurements.

## Explicit classifications

All 349 active records have a replacement classification. The nine excluded
records remain in the catalog with specific reasons:

- **Protocols (2):** `hiit`, `zone_2_cardio`; choose a concrete cardio modality
  and intensity prescription first.
- **Sequences (4):** `hip_flexion_rotation`, `hip_stability_lunge_sequence`,
  `rdl_stability_sequence`, `t_bar_row_kelso_shrug`; components/order are
  unspecified or combine movements that need separate prescriptions.
- **Specialist review (3):** `banded_internal_rotation_stretch`,
  `plate_loaded_neck_curls`, `db_calf_jumps`; technique, anchor, loading or
  landing details are insufficiently specified for replacement selection.

Seven previously retired placeholders remain inactive. No active replacement
classification remains `unreviewed`.

## Rust integration

- `GET /api/v0/me/workouts/exercises` reads active catalog slugs. Existing
  `/api/v0/workouts/exercises` and `/workouts/exercises` aliases retain their
  string-array shape; the old five-name list is removed.
- `GET /api/v0/me/workouts/exercises/:id/replacements` returns authenticated,
  owner-checked candidates for a planned exercise, filtering actual equipment,
  category, family, variants and explicit slug/family/muscle exclusions.
- `POST` to the same replacement path revalidates the selection and applies an
  explicit prescription atomically to the owned planned exercise.

Equipment is **OR-of-AND**: `[["barbell","bench","rack"]]` requires all three;
`[["dumbbell"],["kettlebell"]]` accepts either. Unknown equipment excludes a
candidate; bodyweight never bypasses requirements. Variants return once.
Muscle exclusions consider all active eligible aliases within a variant group,
so an incompletely mapped alias cannot bypass the exclusion.

Reps, reps per side, duration, duration per side, and duration+distance have
explicit validated fields/units. The requested mode must match the selected
catalog exercise. There is no inferred dose/load conversion. Prescriptions
round-trip through saved plans, including changed tracking modes. Exercise IDs
and existing caution notes are retained. Day/exercise locks and the session
foreign key serialize replacement against workout start; any existing session
blocks mutation of that day's exercises.

RLS and ownership boundaries remain intact. A partial category/family/variant
index supports candidate selection. Coverage-contract metadata is backend-only.
See [API contracts](../api/api-contracts.md) for request fields and error codes.

The Android replacement picker is outside this pass. Starter plan generation
remains an MVP template, now using canonical catalog slugs; this is not a full
equipment-aware generator. Deferred web/legacy engines are unchanged. Clinical,
difficulty, fatigue and automatic prescription matching remain separate work.

## Verification

Migrations through `20261003126000` are applied to **local Supabase only, without
a reset**. All previous 228 exercise IDs/creation times and the counts/content
of 58 other public/Auth tables are preserved. Existing workout history is
unchanged. Intended reference corrections are listed above; reference metadata
is not claimed byte-identical.

Verified on disposable PostgreSQL **15.19** and local Supabase **17.6**:

- Fresh ordered migrations/seed; catalog, replacement, contract and MVP storage
  SQL regressions; RLS/grant checks.
- Data-migration/seed replay preserves complete exercise/mapping data and IDs.
  Deliberately removing a required variant fails the gate and rolls back.
- All 264 coverage checks pass; local Supabase lint reports no schema errors.
- Rust formatting, check, clippy with warnings denied, and the full default
  test suite pass. PostgreSQL API/storage tests were explicitly run, including
  six replacement-boundary tests covering auth, ownership, equipment, aliases,
  exclusions, tracking units, cautions and concurrent writes.
- Importer compatibility tests pass; the destructive importer was not run
  against the populated database.

```powershell
Get-Content 'supabase/sql/exercise_replacement_contract_audit.sql' -Raw |
  docker exec -i supabase_db_adaptabuddy-local psql -U postgres -d postgres -v ON_ERROR_STOP=1
Get-Content 'supabase/sql/exercise_replacement_contract_regression.sql' -Raw |
  docker exec -i supabase_db_adaptabuddy-local psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

The audit is read-only; regression fixtures roll back. Run Rust/failure-injection
database tests only in the disposable harness in
[Supabase validation](../../scripts/supabase/README.md). Backups, checksums,
comparison inputs and outputs are retained under
`%TEMP%/adaptabuddy-completion-20261003/`.

## Reference examples

- [AAOS shoulder conditioning](https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/)
- [AAOS knee conditioning](https://www.orthoinfo.org/recovery/knee-conditioning-program/)
- [NHS knee exercises](https://www.leedsth.nhs.uk/patients/resources/knee-exercises/)
- [NASM plank variations](https://www.nasm.org/resource-center/blog/training/the-plank-coaching-progressions-and-variations-for-every-client)
- [ACE scapular stabilization](https://www.acefitness.org/resources/everyone/exercise-library/249/prone-scapular-shoulder-stabilization-series-i-y-t-w-o-formation/)
- [NHS Pilates exercises](https://plr.cht.nhs.uk/download/1314/Pilates%20Exercises%20A4)
- [OpenStax upper-limb anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs)
- [OpenStax lower-limb anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs)

Per-exercise references and qualifications are stored in `source_urls` and
`catalog_notes`.
