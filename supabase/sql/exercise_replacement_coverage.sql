-- Read-only planning-candidate coverage audit.
--
-- This reports catalog alternatives; it does not certify a clinical or
-- injury-safe substitution and it does not make the legacy engines auto-swap.
-- Equipment profiles are illustrative explicit inventories. Inner arrays are
-- AND requirements, outer arrays are OR alternatives, and [] means unknown.

select
  count(*) filter (where is_active) as active_exercises,
  count(*) filter (where is_active and replacement_family is null) as missing_family,
  count(*) filter (where is_active and equipment_options = '[]'::jsonb) as unknown_equipment,
  count(*) filter (where is_active and variant_group is null) as implicit_variant_group
from public.exercises;

with profiles(profile, equipment) as (
  values
    ('home_bodyweight'::text, array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter'
    ]::text[]),
    ('home_band', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'band', 'anchor', 'high_anchor'
    ]::text[]),
    ('home_dumbbell', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'dumbbell', 'bench', 'step'
    ]::text[]),
    ('gym', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'band', 'anchor', 'high_anchor', 'dumbbell', 'bench', 'adjustable_bench',
      'preacher_bench', 'step', 'barbell', 'rack', 'cable', 'machine',
      'kettlebell', 'fat_grip', 'smith_machine', 'plate', 'rope', 'rope_attachment',
      'cuff_attachment', 'landmine', 'ankle_weight', 'sliders',
      'sliding_surface', 'pull_up_bar', 'neutral_grip_pull_up_bar', 'dip_bars',
      'battle_ropes', 'bike', 'bicycle', 'elliptical', 'jump_rope',
      'stair_climber', 'stairs', 'treadmill', 'pool', 'foam_roller',
      'lacrosse_ball', 'glute_ham_developer', 'nordic_bench', 'stick',
      'ab_crunch_machine', 'assisted_dip_machine', 'assisted_pull_up_machine',
      'belt_squat_machine', 'chest_press_machine', 'donkey_calf_machine',
      'hack_squat_machine', 'hip_abduction_machine', 'hip_adduction_machine',
      'hip_thrust_machine', 'lat_pulldown_machine', 'lateral_raise_machine',
      'leg_extension_machine', 'leg_press_machine', 'lying_leg_curl_machine',
      'pec_deck_machine', 'pullover_machine', 'row_machine',
      'seated_calf_machine', 'seated_leg_curl_machine',
      'shoulder_press_machine', 'shrug_machine', 'standing_calf_machine',
      't_bar_row_machine'
    ]::text[])
),
sources as (
  select
    profile.profile,
    exercise.*,
    exercise.equipment_options <> '[]'::jsonb
      and exists (
        select 1
        from jsonb_array_elements(exercise.equipment_options) option
        where not exists (
          select 1
          from jsonb_array_elements_text(option) requirement
          where not (requirement = any(profile.equipment))
        )
      ) as source_available
  from profiles profile
  cross join public.exercises exercise
  where exercise.is_active
    and exercise.replacement_family is not null
),
coverage as (
  select
    source.profile,
    source.id,
    source.source_available,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) as replacement_count,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.tracking_mode = source.tracking_mode
    ) as same_tracking_count
  from sources source
  left join sources candidate
    on candidate.profile = source.profile
   and candidate.source_available
   and candidate.category = source.category
   and candidate.replacement_family = source.replacement_family
   and coalesce(candidate.variant_group, candidate.slug)
       <> coalesce(source.variant_group, source.slug)
  group by source.profile, source.id, source.source_available
)
-- profiled_sources is the current active+family denominator (201 in the
-- current planned catalog), independent of whether the source itself is usable
-- with the profile. source_available reports that separate fact.
select
  profile,
  count(*) as profiled_sources,
  count(*) filter (where source_available) as source_available,
  count(*) filter (where not source_available) as source_unavailable,
  count(*) filter (where replacement_count = 0) as zero_replacements,
  count(*) filter (where replacement_count = 1) as one_replacement,
  count(*) filter (where replacement_count >= 2) as two_plus_replacements,
  count(*) filter (where same_tracking_count = 0) as zero_same_tracking,
  count(*) filter (where same_tracking_count = 1) as one_same_tracking,
  count(*) filter (where same_tracking_count >= 2) as two_plus_same_tracking
from coverage
group by profile
order by profile;

with profiles(profile, equipment) as (
  values
    ('home_bodyweight'::text, array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter'
    ]::text[]),
    ('home_band', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'band', 'anchor', 'high_anchor'
    ]::text[]),
    ('home_dumbbell', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'dumbbell', 'bench', 'step'
    ]::text[]),
    ('gym', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'band', 'anchor', 'high_anchor', 'dumbbell', 'bench', 'adjustable_bench',
      'preacher_bench', 'step', 'barbell', 'rack', 'cable', 'machine',
      'kettlebell', 'fat_grip', 'smith_machine', 'plate', 'rope', 'rope_attachment',
      'cuff_attachment', 'landmine', 'ankle_weight', 'sliders',
      'sliding_surface', 'pull_up_bar', 'neutral_grip_pull_up_bar', 'dip_bars',
      'battle_ropes', 'bike', 'bicycle', 'elliptical', 'jump_rope',
      'stair_climber', 'stairs', 'treadmill', 'pool', 'foam_roller',
      'lacrosse_ball', 'glute_ham_developer', 'nordic_bench', 'stick',
      'ab_crunch_machine', 'assisted_dip_machine', 'assisted_pull_up_machine',
      'belt_squat_machine', 'chest_press_machine', 'donkey_calf_machine',
      'hack_squat_machine', 'hip_abduction_machine', 'hip_adduction_machine',
      'hip_thrust_machine', 'lat_pulldown_machine', 'lateral_raise_machine',
      'leg_extension_machine', 'leg_press_machine', 'lying_leg_curl_machine',
      'pec_deck_machine', 'pullover_machine', 'row_machine',
      'seated_calf_machine', 'seated_leg_curl_machine',
      'shoulder_press_machine', 'shrug_machine', 'standing_calf_machine',
      't_bar_row_machine'
    ]::text[])
),
sources as (
  select
    profile.profile,
    exercise.*,
    exercise.equipment_options <> '[]'::jsonb
      and exists (
        select 1 from jsonb_array_elements(exercise.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (requirement = any(profile.equipment))
        )
      ) as source_available
  from profiles profile
  cross join public.exercises exercise
  where exercise.is_active and exercise.replacement_family is not null
),
coverage as (
  select
    source.profile,
    source.id,
    source.source_available,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) as replacement_count,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.tracking_mode = source.tracking_mode
    ) as same_tracking_count
  from sources source
  left join sources candidate
    on candidate.profile = source.profile
   and candidate.source_available
   and candidate.category = source.category
   and candidate.replacement_family = source.replacement_family
   and coalesce(candidate.variant_group, candidate.slug)
       <> coalesce(source.variant_group, source.slug)
  group by source.profile, source.id, source.source_available
)
select
  coverage.profile,
  coverage.source_available,
  exercise.category,
  exercise.replacement_family,
  exercise.slug,
  exercise.tracking_mode,
  coverage.replacement_count,
  coverage.same_tracking_count
from coverage
join public.exercises exercise on exercise.id = coverage.id
where coverage.replacement_count <= 1 or coverage.same_tracking_count <= 1
order by
  coverage.profile,
  coverage.replacement_count,
  coverage.same_tracking_count,
  exercise.category,
  exercise.replacement_family,
  exercise.slug;

with profiles(profile, equipment) as (
  values
    ('home_bodyweight'::text, array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter'
    ]::text[]),
    ('home_band', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'band', 'anchor', 'high_anchor'
    ]::text[]),
    ('home_dumbbell', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'dumbbell', 'bench', 'step'
    ]::text[]),
    ('gym', array[
      'bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter',
      'band', 'anchor', 'high_anchor', 'dumbbell', 'bench', 'adjustable_bench',
      'preacher_bench', 'step', 'barbell', 'rack', 'cable', 'machine',
      'kettlebell', 'fat_grip', 'smith_machine', 'plate', 'rope', 'rope_attachment',
      'cuff_attachment', 'landmine', 'ankle_weight', 'sliders',
      'sliding_surface', 'pull_up_bar', 'neutral_grip_pull_up_bar', 'dip_bars',
      'battle_ropes', 'bike', 'bicycle', 'elliptical', 'jump_rope',
      'stair_climber', 'stairs', 'treadmill', 'pool', 'foam_roller',
      'lacrosse_ball', 'glute_ham_developer', 'nordic_bench', 'stick',
      'ab_crunch_machine', 'assisted_dip_machine', 'assisted_pull_up_machine',
      'belt_squat_machine', 'chest_press_machine', 'donkey_calf_machine',
      'hack_squat_machine', 'hip_abduction_machine', 'hip_adduction_machine',
      'hip_thrust_machine', 'lat_pulldown_machine', 'lateral_raise_machine',
      'leg_extension_machine', 'leg_press_machine', 'lying_leg_curl_machine',
      'pec_deck_machine', 'pullover_machine', 'row_machine',
      'seated_calf_machine', 'seated_leg_curl_machine',
      'shoulder_press_machine', 'shrug_machine', 'standing_calf_machine',
      't_bar_row_machine'
    ]::text[])
),
sources as (
  select
    profile.profile,
    exercise.*,
    exercise.equipment_options <> '[]'::jsonb
      and exists (
        select 1 from jsonb_array_elements(exercise.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (requirement = any(profile.equipment))
        )
      ) as source_available
  from profiles profile
  cross join public.exercises exercise
  where exercise.is_active and exercise.replacement_family is not null
),
coverage as (
  select
    source.profile,
    source.id,
    source.source_available,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) as replacement_count,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.tracking_mode = source.tracking_mode
    ) as same_tracking_count
  from sources source
  left join sources candidate
    on candidate.profile = source.profile
   and candidate.source_available
   and candidate.category = source.category
   and candidate.replacement_family = source.replacement_family
   and coalesce(candidate.variant_group, candidate.slug)
       <> coalesce(source.variant_group, source.slug)
  group by source.profile, source.id, source.source_available
),
primary_muscles as (
  select mapping.exercise_id, muscle.slug
  from public.exercise_muscle_map mapping
  join public.muscle_groups muscle on muscle.id = mapping.muscle_group_id
  where mapping.role = 'primary'
)
select
  coverage.profile,
  exercise.category,
  exercise.replacement_family,
  exercise.movement_pattern,
  primary_muscles.slug as primary_muscle,
  count(distinct coverage.id) as profiled_sources,
  count(distinct coverage.id) filter (where coverage.source_available) as source_available,
  count(distinct coverage.id) filter (where coverage.replacement_count = 0) as zero_replacements,
  count(distinct coverage.id) filter (where coverage.replacement_count = 1) as one_replacement,
  count(distinct coverage.id) filter (where coverage.same_tracking_count = 0) as zero_same_tracking
from coverage
join public.exercises exercise on exercise.id = coverage.id
left join primary_muscles on primary_muscles.exercise_id = coverage.id
group by
  coverage.profile,
  exercise.category,
  exercise.replacement_family,
  exercise.movement_pattern,
  primary_muscles.slug
order by
  coverage.profile,
  exercise.category,
  exercise.replacement_family,
  exercise.movement_pattern,
  primary_muscles.slug;
