-- Run after local migrations and seed as postgres:
-- psql -v ON_ERROR_STOP=1 -f supabase/sql/exercise_catalog_regression.sql
-- All fixtures are rolled back; existing application rows are not changed.
begin;

do $$
declare
  missing_categories text[];
begin
  select array_agg(required.category order by required.category)
  into missing_categories
  from unnest(array[
    'strength', 'stretching', 'pilates', 'cardio', 'mobility', 'balance', 'recovery'
  ]) as required(category)
  where not exists (
    select 1
    from public.exercises e
    where e.category = required.category and e.is_active
  );

  if missing_categories is not null then
    raise exception 'Active exercise catalog is missing categories: %', missing_categories;
  end if;

  if (select count(*) from public.exercises) < 181 then
    raise exception 'Expanded exercise catalog rows were lost';
  end if;

  if exists (
    select 1 from unnest(array[
      'heel_cord_stretch', 'bent_knee_calf_stretch', 'standing_quadriceps_stretch',
      'supine_hamstring_stretch', 'knee_to_chest_stretch', 'seated_hip_rotation_stretch',
      'standing_it_band_region_stretch', 'crossover_shoulder_stretch',
      'passive_shoulder_external_rotation_stretch', 'pilates_pelvic_tilt',
      'pilates_heel_slide', 'pilates_bent_knee_fallout', 'pilates_shoulder_bridge',
      'pilates_clam', 'pilates_one_leg_stretch', 'pilates_hundred',
      'pilates_side_lying_leg_lift', 'pilates_curl_up', 'brisk_walk', 'jogging',
      'outdoor_cycling', 'swimming_laps', 'aerobic_dance', 'stair_walking',
      'supported_single_leg_balance', 'heel_to_toe_walk', 'sideways_walking',
      'shoulder_pendulum', 'bodyweight_squat', 'dumbbell_row'
    ]) required(slug)
    where not exists (select 1 from public.exercises e where e.slug=required.slug and e.is_active)
  ) then
    raise exception 'A required catalog addition is missing or inactive';
  end if;

  if exists (
    select 1 from public.program_slots ps
    where (ps.prescription #>> '{source,canonical_name}' = 'Leg Press'
           and (ps.movement_pattern <> 'squat' or not ps.muscle_targets ? 'quads' or ps.muscle_targets ? 'chest'))
       or (ps.prescription #>> '{source,canonical_name}' = 'Leg Extension'
           and (ps.movement_pattern <> 'knee_extension' or not ps.muscle_targets ? 'quads'))
  ) then
    raise exception 'Imported program templates retain incorrect leg exercise metadata';
  end if;

  if exists (
    select 1 from public.program_slots ps join public.exercises e on e.id=ps.locked_exercise_id
    where not e.tags @> ps.tags_required
  ) then
    raise exception 'A locked exercise does not satisfy its required template tags';
  end if;

  if (select last_value from public.exercises_id_seq) < (select max(id) from public.exercises)
     or (select last_value from public.muscle_groups_id_seq) < (select max(id) from public.muscle_groups)
     or (select last_value from public.programs_id_seq) < (select max(id) from public.programs)
     or (select last_value from public.program_days_id_seq) < (select max(id) from public.program_days)
     or (select last_value from public.program_slots_id_seq) < (select max(id) from public.program_slots) then
    raise exception 'A reference-table sequence is behind its table IDs';
  end if;

  if exists (
    select 1
    from public.exercises
    where is_active
      and (slug ~ 'of_choice' or movement_pattern = 'unknown')
  ) then
    raise exception 'Placeholder or unknown-pattern exercises remain active';
  end if;

  if exists (
    select 1
    from public.exercises e
    where jsonb_typeof(e.equipment) <> 'array'
       or jsonb_path_exists(e.equipment, 'strict $[*] ? (@.type() != "string")')
       or jsonb_typeof(e.aliases) <> 'array'
       or jsonb_path_exists(e.aliases, 'strict $[*] ? (@.type() != "string")')
       or jsonb_typeof(e.tags) <> 'array'
       or jsonb_path_exists(e.tags, 'strict $[*] ? (@.type() != "string")')
       or jsonb_typeof(e.instructions) <> 'array'
       or jsonb_path_exists(e.instructions, 'strict $[*] ? (@.type() != "string")')
       or jsonb_typeof(e.source_urls) <> 'array'
       or jsonb_path_exists(e.source_urls, 'strict $[*] ? (@.type() != "string")')
  ) then
    raise exception 'Exercise catalog contains a malformed JSON string array';
  end if;

  if exists (
    select 1
    from public.program_slots ps
    where jsonb_typeof(ps.equipment_allowed) <> 'array'
       or jsonb_path_exists(ps.equipment_allowed, 'strict $[*] ? (@.type() != "string")')
  ) then
    raise exception 'Program slot equipment contains a malformed JSON string array';
  end if;

  if exists (
    select 1
    from public.exercises e
    left join public.exercise_muscle_map emm on emm.exercise_id = e.id
    where emm.exercise_id is null
  ) then
    raise exception 'An exercise has no anatomy mapping';
  end if;

  if exists (
    select 1
    from public.exercise_muscle_map emm
    join public.exercises e on e.id = emm.exercise_id
    where (e.category = 'strength' and emm.contribution = 0)
       or (e.category <> 'strength' and emm.contribution <> 0)
  ) then
    raise exception 'Exercise contribution semantics do not match its category';
  end if;

  if not exists (
    select 1
    from public.exercises e
    join public.exercise_muscle_map emm on emm.exercise_id = e.id
    join public.muscle_groups mg on mg.id = emm.muscle_group_id
    where e.slug = 'leg_press' and mg.slug = 'quads'
  ) or exists (
    select 1
    from public.exercises e
    join public.exercise_muscle_map emm on emm.exercise_id = e.id
    join public.muscle_groups mg on mg.id = emm.muscle_group_id
    where e.slug = 'leg_press'
      and (mg.slug = 'chest' or mg.slug like 'chest\_%' escape '\'
        or mg.slug = 'triceps' or mg.slug like 'triceps\_%' escape '\')
  ) then
    raise exception 'Leg press anatomy is not quad-focused or still targets pressing muscles';
  end if;

  if (
    select count(distinct e.slug)
    from public.exercises e
    join public.exercise_muscle_map emm on emm.exercise_id = e.id
    join public.muscle_groups mg on mg.id = emm.muscle_group_id
    where e.slug in ('lying_leg_curl', 'seated_leg_curl', 'nordic_ham_curl')
      and mg.slug = 'hamstrings'
  ) <> 3 or exists (
    select 1
    from public.exercises e
    join public.exercise_muscle_map emm on emm.exercise_id = e.id
    join public.muscle_groups mg on mg.id = emm.muscle_group_id
    where e.slug in ('lying_leg_curl', 'seated_leg_curl', 'nordic_ham_curl')
      and (mg.slug = 'biceps' or mg.slug like 'biceps\_%' escape '\')
  ) then
    raise exception 'Hamstring curl anatomy is incomplete or still targets biceps';
  end if;

  if not exists (
    select 1
    from public.exercises e
    join public.exercise_muscle_map emm on emm.exercise_id = e.id
    join public.muscle_groups mg on mg.id = emm.muscle_group_id
    where e.slug = 'leg_extension'
      and e.movement_pattern = 'knee_extension'
      and mg.slug = 'quads'
  ) then
    raise exception 'Leg extension is not classified as knee extension targeting quads';
  end if;

  if exists (
    select 1
    from public.exercises e
    join public.exercise_muscle_map emm on emm.exercise_id = e.id
    join public.muscle_groups mg on mg.id = emm.muscle_group_id
    where e.slug = 'plate_loaded_neck_curls'
      and (mg.slug = 'biceps' or mg.slug like 'biceps\_%' escape '\')
  ) then
    raise exception 'Neck curl still targets biceps';
  end if;

  if not exists (
    select 1 from public.exercises where review_status = 'reviewed'
  ) or exists (
    select 1
    from public.exercises
    where review_status = 'reviewed'
      and (jsonb_array_length(instructions) = 0 or jsonb_array_length(source_urls) = 0)
  ) then
    raise exception 'Reviewed catalog entries need nonempty instructions and source URLs';
  end if;

  if exists (
    select 1
    from public.exercises e
    cross join lateral jsonb_array_elements(e.contraindications) item
    cross join lateral jsonb_array_elements_text(
      coalesce(item->'target'->'muscle_group_ids', '[]'::jsonb)
    ) target_id
    left join public.muscle_groups mg on mg.id = target_id::text::integer
    where mg.id is null
  ) then
    raise exception 'A contraindication references a missing muscle group';
  end if;

  if exists (
    select 1
    from public.exercises e
    cross join lateral jsonb_array_elements(e.contraindications) item
    cross join lateral jsonb_array_elements_text(
      coalesce(item->'target'->'muscle_group_ids', '[]'::jsonb)
    ) target_id
    join public.muscle_groups mg on mg.id = target_id::text::integer
    where e.slug in ('lying_leg_curl', 'seated_leg_curl', 'nordic_ham_curl')
      and mg.slug in ('biceps', 'biceps_long_head', 'biceps_short_head')
  ) then
    raise exception 'A hamstring curl contraindication still targets biceps';
  end if;
end;
$$;

-- New writes must reject malformed JSON and out-of-range anatomy weights,
-- including while the legacy constraints are still NOT VALID.
do $$
begin
  begin
    insert into public.exercises (
      id, slug, name, movement_pattern, equipment, category, tracking_mode
    ) values (
      2147483000, 'regression_bad_equipment', 'Regression bad equipment', 'test',
      '[["bodyweight"]]'::jsonb, 'strength', 'reps'
    );
    raise exception 'Malformed equipment was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.exercises
    set source_urls = '[123]'::jsonb
    where slug = 'back_squat';
    raise exception 'Non-string source URL was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercise_muscle_map (
      exercise_id, muscle_group_id, role, contribution
    )
    select exercise.id, muscle.id, 'stabilizer', 1.001
    from public.exercises exercise
    cross join public.muscle_groups muscle
    where exercise.slug = 'back_squat'
      and not exists (
        select 1
        from public.exercise_muscle_map existing
        where existing.exercise_id = exercise.id
          and existing.muscle_group_id = muscle.id
      )
    limit 1;
    raise exception 'Out-of-range muscle contribution was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- Reference tables remain readable and immutable to authenticated clients.
set local role authenticated;
select count(*) from public.exercises;
do $$
begin
  if not exists (select 1 from public.exercises where slug='pilates_hundred' and is_active) then
    raise exception 'Authenticated client cannot read the expanded catalog';
  end if;
  begin
    insert into public.exercises (slug, name, movement_pattern)
    values ('regression_client_write', 'Regression client write', 'test');
    raise exception 'Authenticated client mutated the exercise catalog';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
