# Exercise catalog audit — 2026-10-03

This records the initial cleanup. The later
[replacement-coverage audit](exercise-replacement-coverage.md) expands the
catalog to 356 entries, satisfies its supported home/gym coverage contract, and
implements catalog-backed Rust replacement routes. Counts and runtime limits
below describe this initial cleanup stage, not the current completed catalog.

Scope: the local Supabase reference catalog and imported program templates.
No hosted database, personal workout history, authentication data, or Rust API
behavior is changed by these migrations.

## Findings and changes

The populated local database contained 151 exercises, 60 muscle groups, 380
exercise-muscle associations, 11 programs, 15 program days, and 82 slots. The
old reset seed recreated only three exercises and no muscle associations.

The catalog data migration preserves those 151 exercise slugs, adds 30 entries,
and makes targeted corrections to 47 existing entries. It adds `neck_flexors`
to the existing muscle vocabulary. Existing exercise and muscle IDs survive
the upgrade: inserts and relationships resolve by slug. Existing aliases,
exercise variants, and history are retained; seven `of_choice` placeholder
records become inactive rather than being deleted.

Confirmed repairs include:

- Leg press: squat pattern and quadriceps/gluteal targets instead of chest,
  anterior deltoids, and triceps.
- Lying/seated leg curls and Nordic hamstring curl: hamstring targets instead
  of biceps; machine or secured Nordic equipment instead of dumbbells.
- Leg extension: knee extension and quadriceps instead of `unknown`/upper body.
- Plate-loaded neck curl: neck flexion instead of elbow flexion/biceps.
  Its technique and prescription remain explicitly unreviewed.
- Chest fly variants: horizontal adduction and isolation, without triceps
  extension credit. Shoulder presses, upright rows, and several broad
  upper/lower-body mappings receive more specific anatomical targets.
- Hip thrust: flatten nested equipment. Dead bug: unloaded trunk control.
  Goblet squat: remove the barbell from the equipment alternatives.
- Corresponding injury-filter targets and replacement movement hints are
  repaired with the anatomy. The legacy severity thresholds are retained,
  documented as unvalidated, and are not medical recommendations.
- Imported flex slots identify their source exercise through
  `prescription.source.canonical_name`. Their copied movement, equipment, and
  muscle targets are corrected without changing sets, reps, RIR, or schedules.

Five reference-table sequences were still at `1` despite existing exercise IDs
up to 171 and program-slot IDs up to 14,003,009. The data migration advances each sequence to at least its actual
table maximum before inserts; it never moves an already-ahead counter backward.
PostgreSQL sequence advances are not rolled back, so failed/repeated runs may
leave harmless gaps.

## Added coverage

| Category | Additions |
| --- | --- |
| Stretching | Standing calf, bent-knee calf, standing quadriceps, supine hamstring, knee-to-chest, seated hip rotation, standing outer-hip, crossover shoulder, passive shoulder external rotation |
| Pilates | Pelvic tilt, heel slide, bent-knee fallout, shoulder bridge, clam, one-leg stretch, supported hundred, side-lying leg lift, curl-up |
| Cardio | Brisk walking, jogging, outdoor cycling, swimming laps, aerobic dance, stair walking |
| Balance | Supported single-leg balance, heel-to-toe walk, sideways walking |
| Mobility | Shoulder pendulum |
| Strength / seed compatibility | Bodyweight squat, dumbbell row |

The seed-compatible dumbbell-row slug overlaps existing DB-row variants. It is
marked for review; merging IDs would require checking historical references.
The existing banded internal-rotation stretch is categorized as stretching but
its particular technique still needs review.

After applying locally: 181 total exercises, 174 active, 61 muscle groups, and
423 associations. Active coverage is 131 strength, 10 stretching, 9 Pilates,
14 cardio, 5 balance, 4 mobility, and 1 recovery entry. There are 29 fully
source-checked new records; 152 legacy or partially reviewed records retain
`needs_review` rather than implying a complete technique review.

## Catalog semantics

`category` separates strength, stretching, Pilates, cardio, mobility, balance,
and recovery. It is independent of `movement_pattern`. New stretching and
Pilates entries use their own patterns so legacy strength-slot matching does
not treat them as press, squat, or hinge substitutes.

`tracking_mode` describes intended recording: repetitions, repetitions per
side, duration, duration per side, or duration with optional distance. Duration
means elapsed seconds; it does not specify a required exercise dose. These
fields are catalog metadata; the current Rust/Android logging contracts have
not been extended to consume them.

`instructions` contains original brief cues, and `source_urls` records evidence
for the exercise or anatomical correction. `review_status = reviewed` means
the supplied catalog metadata was checked against those references; it does
not mean clinical validation. Partially corrected and otherwise legacy records
remain `needs_review`. `catalog_notes` is public, client-readable editorial
context under the existing catalog read policy. Never store confidential notes
there, and do not present it as workout coaching.

Muscle roles are qualitative. Existing strength contributions (`1`, `0.5`)
remain heuristic application weights, not percentages, EMG measurements, or
validated estimates of training stimulus. Non-strength categories have zero
contribution, retaining anatomical labels without assigning hypertrophy volume
through legacy reporting. This does not imply that Pilates or cardio have no
strength benefits. Swimming anatomy is particularly dependent on the stroke.
No calorie coefficients or personalized rehabilitation prescriptions are added.

Embedded contraindication muscle IDs are regenerated from portable muscle
slugs when the migration runs. This prevents incorrect injury targets on a
fresh database whose serial IDs differ from the imported development database.
The sources do not validate the old injury-severity scoring algorithm.

## Integrity and efficiency

The schema adds strict JSON checks, allowed categories/tracking modes, muscle
role/contribution bounds, program range checks, and slot-lock consistency.
Legacy checks are validated only after the data repairs. PostgreSQL JSONPath
checks use **strict** mode because lax mode silently unwraps nested arrays.

The partial `(category, name, id) WHERE is_active` index supports ordered catalog
browsing. Existing slug, equipment/tag GIN, and muscle association indexes remain.
No speedup is claimed for this small catalog, and no redundant movement-pattern
index is added. There were no orphaned associations or exact duplicate slugs.

Zero-slot challenge and hypertrophy programs are intentionally generated from
metadata; they are not missing static program days to fabricate. Existing
equipment lists also mix alternatives and combined requirements, which needs a
separate consumer-aware design before enforcing equipment eligibility.

## Reproduction and validation

Apply migrations with `npx supabase migration up --local`. Run:

```powershell
npx supabase db lint --local --fail-on warning
Get-Content -LiteralPath 'supabase/sql/exercise_catalog_regression.sql' -Raw |
  docker exec -i supabase_db_adaptabuddy-local psql -U postgres -d postgres -v ON_ERROR_STOP=1
```

The SQL regression rolls back fixtures. It checks anatomy repairs, category
coverage, portable injury targets, sequence position, rejected malformed
writes, and authenticated read/write permissions. Existing RLS is preserved.
Use the disposable database workflow in `scripts/supabase/README.md` to validate
all migrations plus seed and replay the data migration without resetting a
populated development database. Upgrade testing additionally loads the prior
six-table reference dump before the two catalog migrations.

Local application and catalog regression passed. Supabase lint reported no
schema errors; every catalog constraint is validated, and the program-template
integrity check reports zero issues. All 151 prior exercise IDs were retained,
and before/after checksums matched for 32 non-reference/Auth tables. No database
reset was used. The six reference tables were backed up before application to
`%TEMP%/adaptabuddy-catalog-20261003/catalog-before.sql`.

The running local database reported PostgreSQL 17.6 although `config.toml`
specifies major version 15. The migrations were also exercised against
disposable PostgreSQL 15.19 and 16 databases. This audit does not change the
running server or resolve that environment configuration discrepancy.

The migration carries the exercise/muscle snapshot, so resets reproduce the
expanded catalog. It does not snapshot all imported programs; `seed.sql` still
provides the development smoke program. The legacy remote-data importer now
replays its old-schema dump at the explicit pre-catalog migration boundary,
then applies newer migrations to repair and expand the catalog. It rejects
new-format exercise dumps and missing boundary files before database commands.
It remains a destructive local replacement command, not a validation command;
it was tested with mocked process calls and was not run on the populated stack.

At this initial audit stage, the Rust workout list and starter-plan generator were hardcoded in
`backend/crates/workouts/src/lib.rs`. Catalog-backed API listing, category
filters, and timed/distance logging remain follow-up integration work.

## Sources

- [ACE seated leg press](https://www.acefitness.org/resources/everyone/exercise-library/154/seated-leg-press/)
- [AAOS knee conditioning](https://www.orthoinfo.org/recovery/knee-conditioning-program/)
- [AAOS hip conditioning](https://www.orthoinfo.org/recovery/hip-conditioning-program/)
- [AAOS foot and ankle conditioning](https://www.orthoinfo.org/recovery/foot-and-ankle-conditioning-program/)
- [AAOS shoulder conditioning](https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/)
- [NHS Calderdale and Huddersfield Pilates](https://www.cht.nhs.uk/services/clinical-services/physiotherapy-outpatients/the-low-back/pilates)
- [NHS Fife abdominal exercises](https://www.nhsfife.org/services/all-services/patient-advice/stage-two-exercises-for-your-tummy-muscles/)
- [NHS balance exercises](https://www.nhs.uk/live-well/exercise/balance-exercises/)
- [American Heart Association aerobic activities](https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/endurance-exercise-aerobic)
- [OpenStax lower-limb anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs)
- [OpenStax upper-limb anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs)
- [OpenStax head, neck, and back anatomy](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back)
