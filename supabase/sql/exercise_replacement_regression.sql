-- Run after local migrations and seed as postgres:
-- psql -v ON_ERROR_STOP=1 -f supabase/sql/exercise_replacement_regression.sql
-- All fixtures are rolled back; existing application rows are not changed.
begin;

-- Shape checks must reject flat arrays, non-string requirements, and empty
-- alternatives. An empty outer array remains the explicit "unknown" value.
do $$
begin
  begin
    insert into public.exercises (
      slug, name, movement_pattern, category, equipment_options
    ) values (
      'regression_flat_equipment_options', 'Regression flat options', 'test',
      'strength', '["bodyweight"]'::jsonb
    );
    raise exception 'Flat equipment options were accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercises (
      slug, name, movement_pattern, category, equipment_options
    ) values (
      'regression_nonstring_equipment_options', 'Regression nonstring options', 'test',
      'strength', '[["dumbbell", 2]]'::jsonb
    );
    raise exception 'Non-string equipment requirement was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercises (
      slug, name, movement_pattern, category, equipment_options
    ) values (
      'regression_empty_equipment_alternative', 'Regression empty alternative', 'test',
      'strength', '[[]]'::jsonb
    );
    raise exception 'Empty equipment alternative was accepted';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.exercises (
  slug, name, movement_pattern, category, tracking_mode, replacement_family,
  equipment_options, variant_group, is_bodyweight, is_active
)
values
  (
    'regression_replacement_source', 'Regression Replacement Source', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["bodyweight"], ["barbell", "bench"]]'::jsonb,
    'regression_press_source', false, true
  ),
  (
    'regression_replacement_bodyweight', 'Regression Bodyweight Press', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["bodyweight"]]'::jsonb,
    'regression_press_bodyweight', true, true
  ),
  (
    'regression_replacement_bodyweight_alias', 'Regression Bodyweight Press Alias', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["bodyweight"]]'::jsonb,
    'regression_press_bodyweight', true, true
  ),
  (
    'regression_replacement_dumbbell', 'Regression Dumbbell Press', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["dumbbell", "bench"]]'::jsonb,
    'regression_press_dumbbell', false, true
  ),
  (
    'regression_replacement_duration', 'Regression Timed Press', 'horizontal_press',
    'strength', 'duration', 'press_horizontal',
    '[["bodyweight"]]'::jsonb,
    'regression_press_duration', true, true
  ),
  (
    'regression_replacement_same_variant', 'Regression Same Variant', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["bodyweight"]]'::jsonb,
    'regression_press_source', true, true
  ),
  (
    'regression_replacement_other_category', 'Regression Other Category', 'horizontal_press',
    'pilates', 'reps', 'press_horizontal',
    '[["bodyweight"]]'::jsonb,
    'regression_press_pilates', true, true
  ),
  (
    'regression_replacement_barbell', 'Regression Barbell Press', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["barbell", "bench"]]'::jsonb,
    'regression_press_barbell', true, true
  ),
  (
    'regression_replacement_unknown_equipment', 'Regression Unknown Equipment', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[]'::jsonb,
    'regression_press_unknown', false, true
  ),
  (
    'regression_replacement_machine_source', 'Regression Machine Source', 'horizontal_press',
    'strength', 'reps', 'press_horizontal',
    '[["chest_press_machine"]]'::jsonb,
    'regression_press_machine', false, true
  );

do $$
declare
  source_exercise_id integer;
  bodyweight_candidates integer;
  bodyweight_same_tracking integer;
  dumbbell_without_bench integer;
  dumbbell_with_bench integer;
  missing_bar_candidates integer;
  unknown_equipment_candidates integer;
  unavailable_source_available boolean;
  unavailable_source_candidates integer;
begin
  select id into strict source_exercise_id
  from public.exercises
  where slug = 'regression_replacement_source';

  with profile(equipment) as (values (array['bodyweight', 'wall', 'chair']::text[])),
  candidates as (
    select candidate.*
    from public.exercises source
    cross join profile
    join public.exercises candidate
      on candidate.is_active
     and candidate.category = source.category
     and candidate.replacement_family = source.replacement_family
     and coalesce(candidate.variant_group, candidate.slug)
         <> coalesce(source.variant_group, source.slug)
    where source.id = source_exercise_id
      and candidate.equipment_options <> '[]'::jsonb
      and exists (
        select 1
        from jsonb_array_elements(candidate.equipment_options) option
        where not exists (
          select 1
          from jsonb_array_elements_text(option) requirement
          where not (requirement = any(profile.equipment))
        )
      )
  )
  select
    count(distinct coalesce(variant_group, slug)),
    count(distinct coalesce(variant_group, slug)) filter (where tracking_mode = 'reps')
  into bodyweight_candidates, bodyweight_same_tracking
  from candidates;

  if bodyweight_candidates <> 2 or bodyweight_same_tracking <> 1 then
    raise exception 'Bodyweight coverage did not exclude variants/category/equipment or separate tracking modes: %, %',
      bodyweight_candidates, bodyweight_same_tracking;
  end if;

  with profile(equipment) as (values (array['bodyweight', 'dumbbell']::text[]))
  select count(*) into dumbbell_without_bench
  from public.exercises candidate cross join profile
  where candidate.slug = 'regression_replacement_dumbbell'
    and candidate.equipment_options <> '[]'::jsonb
    and exists (
      select 1 from jsonb_array_elements(candidate.equipment_options) option
      where not exists (
        select 1 from jsonb_array_elements_text(option) requirement
        where not (requirement = any(profile.equipment))
      )
    );

  with profile(equipment) as (values (array['bodyweight', 'dumbbell', 'bench']::text[]))
  select count(*) into dumbbell_with_bench
  from public.exercises candidate cross join profile
  where candidate.slug = 'regression_replacement_dumbbell'
    and candidate.equipment_options <> '[]'::jsonb
    and exists (
      select 1 from jsonb_array_elements(candidate.equipment_options) option
      where not exists (
        select 1 from jsonb_array_elements_text(option) requirement
        where not (requirement = any(profile.equipment))
      )
    );

  if dumbbell_without_bench <> 0 or dumbbell_with_bench <> 1 then
    raise exception 'Equipment option members are not being treated as AND requirements';
  end if;

  with profile(equipment) as (values (array['bodyweight', 'bench']::text[]))
  select count(*) into missing_bar_candidates
  from public.exercises candidate cross join profile
  where candidate.slug = 'regression_replacement_barbell'
    and candidate.is_bodyweight
    and exists (
      select 1 from jsonb_array_elements(candidate.equipment_options) option
      where not exists (
        select 1 from jsonb_array_elements_text(option) requirement
        where not (requirement = any(profile.equipment))
      )
    );

  if missing_bar_candidates <> 0 then
    raise exception 'is_bodyweight bypassed an explicit missing barbell requirement';
  end if;

  with profile(equipment) as (values (array[
    'bodyweight', 'wall', 'chair', 'band', 'anchor', 'dumbbell', 'bench',
    'step', 'barbell', 'rack', 'cable', 'machine'
  ]::text[]))
  select count(*) into unknown_equipment_candidates
  from public.exercises candidate cross join profile
  where candidate.slug = 'regression_replacement_unknown_equipment'
    and exists (
      select 1 from jsonb_array_elements(candidate.equipment_options) option
      where not exists (
        select 1 from jsonb_array_elements_text(option) requirement
        where not (requirement = any(profile.equipment))
      )
    );

  if unknown_equipment_candidates <> 0 then
    raise exception 'Unknown equipment was treated as a free equipment option';
  end if;

  with profile(equipment) as (values (
    array['bodyweight', 'chair', 'wall', 'table', 'doorway', 'stable_counter']::text[]
  )),
  source as (
    select exercise.*,
      exists (
        select 1 from jsonb_array_elements(exercise.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (requirement = any(profile.equipment))
        )
      ) as source_available
    from public.exercises exercise cross join profile
    where exercise.slug = 'regression_replacement_machine_source'
  ),
  candidates as (
    select candidate.*
    from source cross join profile
    join public.exercises candidate
      on candidate.is_active
     and candidate.category = source.category
     and candidate.replacement_family = source.replacement_family
     and coalesce(candidate.variant_group, candidate.slug)
         <> coalesce(source.variant_group, source.slug)
    where candidate.equipment_options <> '[]'::jsonb
      and exists (
        select 1 from jsonb_array_elements(candidate.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (requirement = any(profile.equipment))
        )
      )
  )
  select
    (select source_available from source),
    count(distinct coalesce(variant_group, slug))
  into unavailable_source_available, unavailable_source_candidates
  from candidates;

  if unavailable_source_available or unavailable_source_candidates = 0 then
    raise exception 'Unavailable sources were not audited against available candidates: %, %',
      unavailable_source_available, unavailable_source_candidates;
  end if;
end;
$$;

-- These assertions intentionally fail after only the schema migration. They
-- verify that the catalog data migration installed the concrete coverage rows
-- and their primary anatomy mappings.
do $$
begin
  if exists (
    with required(family, minimum_variants) as (
      values
        ('knee_flexion'::text, 6),
        ('knee_extension', 4),
        ('shoulder_external_rotation', 2),
        ('shoulder_internal_rotation', 2),
        ('wrist_flexion', 2),
        ('wrist_extension', 2)
    )
    select 1
    from required
    where (
      select count(distinct coalesce(exercise.variant_group, exercise.slug))
      from public.exercises exercise
      where exercise.is_active
        and exercise.category = 'strength'
        and exercise.replacement_family = required.family
    ) < required.minimum_variants
  ) then
    raise exception 'Required knee, rotator-cuff, or forearm replacement families are incomplete';
  end if;

  if exists (
    with expected(slug, family, primary_muscle) as (
      values
        ('standing_hamstring_curl'::text, 'knee_flexion'::text, 'hamstrings'::text),
        ('standing_band_leg_curl', 'knee_flexion', 'hamstrings'),
        ('seated_bodyweight_knee_extension', 'knee_extension', 'quads'),
        ('seated_band_knee_extension', 'knee_extension', 'quads'),
        ('band_external_rotation', 'shoulder_external_rotation', 'rotator_cuff'),
        ('side_lying_dumbbell_external_rotation', 'shoulder_external_rotation', 'rotator_cuff'),
        ('band_internal_rotation', 'shoulder_internal_rotation', 'rotator_cuff'),
        ('side_lying_dumbbell_internal_rotation', 'shoulder_internal_rotation', 'rotator_cuff'),
        ('band_wrist_flexion', 'wrist_flexion', 'forearms_flexors'),
        ('dumbbell_wrist_flexion', 'wrist_flexion', 'forearms_flexors'),
        ('band_wrist_extension', 'wrist_extension', 'forearms_extensors'),
        ('dumbbell_wrist_extension', 'wrist_extension', 'forearms_extensors')
    )
    select 1
    from expected
    left join public.exercises exercise
      on exercise.slug = expected.slug
     and exercise.is_active
     and exercise.category = 'strength'
     and exercise.replacement_family = expected.family
     and exercise.equipment_options <> '[]'::jsonb
    left join public.exercise_muscle_map mapping
      on mapping.exercise_id = exercise.id and mapping.role = 'primary'
    left join public.muscle_groups muscle
      on muscle.id = mapping.muscle_group_id
     and muscle.slug = expected.primary_muscle
    group by expected.slug
    having count(muscle.id) = 0
  ) then
    raise exception 'Required replacement exercises or primary anatomy mappings are missing';
  end if;
end;
$$;

rollback;
