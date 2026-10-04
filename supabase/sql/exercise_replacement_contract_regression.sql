-- Run after all replacement coverage migrations and data as postgres.
-- Fixtures roll back; no existing application rows are changed.
begin;

do $$
begin
  begin
    insert into public.exercises (
      slug, name, movement_pattern, replacement_status
    ) values (
      'regression_invalid_replacement_status', 'Regression invalid status',
      'test', 'invalid'
    );
    raise exception 'Invalid replacement status was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercises (
      slug, name, movement_pattern, replacement_status
    ) values (
      'regression_protocol_without_reason', 'Regression protocol without reason',
      'test', 'protocol'
    );
    raise exception 'Protocol exclusion without a reason was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercises (
      slug, name, movement_pattern, replacement_status, replacement_reason
    ) values (
      'regression_eligible_with_reason', 'Regression eligible with reason',
      'test', 'eligible', 'Should not be present'
    );
    raise exception 'Eligible exercise with an exclusion reason was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercise_replacement_profiles (
      slug, equipment_inventory, description
    ) values (
      'regression_flat_profile', '"bodyweight"'::jsonb, 'Invalid flat profile'
    );
    raise exception 'Non-array profile inventory was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercise_replacement_profiles (
      slug, equipment_inventory, description
    ) values (
      'regression_nonstring_profile', '["bodyweight", 2]'::jsonb,
      'Invalid non-string profile'
    );
    raise exception 'Non-string profile inventory was accepted';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.exercise_replacement_profiles (
  slug, equipment_inventory, description
) values (
  'regression_contract_profile',
  '["bodyweight"]'::jsonb,
  'Regression-only bodyweight inventory'
);

do $$
begin
  begin
    insert into public.exercise_replacement_coverage_requirements (
      category, replacement_family, profile_slug, expectation,
      minimum_variant_groups
    ) values (
      'strength', 'regression_minimum_too_low', 'regression_contract_profile',
      'required', 2
    );
    raise exception 'Required coverage below three variants was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercise_replacement_coverage_requirements (
      category, replacement_family, profile_slug, expectation
    ) values (
      'strength', 'regression_missing_required_minimum',
      'regression_contract_profile', 'required'
    );
    raise exception 'Required coverage without a minimum was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.exercise_replacement_coverage_requirements (
      category, replacement_family, profile_slug, expectation
    ) values (
      'strength', 'regression_unsupported_without_reason',
      'regression_contract_profile', 'unsupported_equipment'
    );
    raise exception 'Unsupported coverage without a reason was accepted';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.exercises (
  slug, name, movement_pattern, category, tracking_mode,
  replacement_family, equipment_options, variant_group,
  replacement_status, replacement_reason, is_active
)
values
  ('regression_contract_complete_a', 'Regression complete A', 'test',
   'strength', 'reps', 'regression_complete', '[["bodyweight"]]'::jsonb,
   'regression_complete_a', 'eligible', null, true),
  ('regression_contract_complete_a_alias', 'Regression complete A alias', 'test',
   'strength', 'reps', 'regression_complete', '[["bodyweight"]]'::jsonb,
   'regression_complete_a', 'eligible', null, true),
  ('regression_contract_complete_b', 'Regression complete B', 'test',
   'strength', 'reps', 'regression_complete', '[["bodyweight"]]'::jsonb,
   'regression_complete_b', 'eligible', null, true),
  ('regression_contract_complete_c', 'Regression complete C', 'test',
   'strength', 'duration', 'regression_complete', '[["bodyweight"]]'::jsonb,
   'regression_complete_c', 'eligible', null, true),
  ('regression_contract_machine_source', 'Regression machine source', 'test',
   'strength', 'reps', 'regression_complete', '[["machine"]]'::jsonb,
   'regression_complete_machine', 'eligible', null, true),
  ('regression_contract_other_category', 'Regression other category', 'test',
   'pilates', 'reps', 'regression_complete', '[["bodyweight"]]'::jsonb,
   'regression_complete_pilates', 'eligible', null, true),
  ('regression_contract_short_a', 'Regression short A', 'test',
   'strength', 'reps', 'regression_short', '[["bodyweight"]]'::jsonb,
   'regression_short_a', 'eligible', null, true),
  ('regression_contract_short_b', 'Regression short B', 'test',
   'strength', 'reps', 'regression_short', '[["bodyweight"]]'::jsonb,
   'regression_short_b', 'eligible', null, true),
  ('regression_contract_unsupported_candidate', 'Regression unsupported candidate', 'test',
   'strength', 'reps', 'regression_unsupported_has_candidate',
   '[["bodyweight"]]'::jsonb, 'regression_unsupported_candidate',
   'eligible', null, true),
  ('regression_contract_specialist_candidate', 'Regression specialist candidate', 'test',
   'strength', 'reps', 'regression_specialist_hidden',
   '[["bodyweight"]]'::jsonb, 'regression_specialist_candidate',
   'specialist_review', 'Requires specialist review for replacement planning.', true);

insert into public.exercise_replacement_coverage_requirements (
  category, replacement_family, profile_slug, expectation,
  minimum_variant_groups, reason
)
values
  ('strength', 'regression_complete', 'regression_contract_profile',
   'required', 3, null),
  ('strength', 'regression_short', 'regression_contract_profile',
   'required', 3, null),
  ('strength', 'regression_unsupported_empty', 'regression_contract_profile',
   'unsupported_equipment', null,
   'No bodyweight option exists for this regression family.'),
  ('strength', 'regression_unsupported_has_candidate',
   'regression_contract_profile', 'unsupported_equipment', null,
   'This row must fail because a bodyweight candidate exists.'),
  ('strength', 'regression_specialist_hidden',
   'regression_contract_profile', 'unsupported_equipment', null,
   'This row must fail because status cannot hide available equipment.');

do $$
declare
  complete_variants integer;
  short_variants integer;
  unsupported_empty_variants integer;
  unsupported_with_candidate_variants integer;
  machine_source_available boolean;
  machine_source_alternatives integer;
  specialist_physical_variants integer;
begin
  with profile as (
    select equipment_inventory
    from public.exercise_replacement_profiles
    where slug = 'regression_contract_profile'
  ),
  candidates as (
    select exercise.*
    from public.exercises exercise cross join profile
    where exercise.is_active
      and exercise.replacement_status = 'eligible'
      and exercise.category = 'strength'
      and exercise.equipment_options <> '[]'::jsonb
      and exists (
        select 1 from jsonb_array_elements(exercise.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (profile.equipment_inventory ? requirement)
        )
      )
  )
  select
    count(distinct coalesce(variant_group, slug)) filter (
      where replacement_family = 'regression_complete'
    ),
    count(distinct coalesce(variant_group, slug)) filter (
      where replacement_family = 'regression_short'
    ),
    count(distinct coalesce(variant_group, slug)) filter (
      where replacement_family = 'regression_unsupported_empty'
    ),
    count(distinct coalesce(variant_group, slug)) filter (
      where replacement_family = 'regression_unsupported_has_candidate'
    )
  into complete_variants, short_variants, unsupported_empty_variants,
       unsupported_with_candidate_variants
  from candidates;

  if complete_variants <> 3
     or short_variants <> 2
     or unsupported_empty_variants <> 0
     or unsupported_with_candidate_variants <> 1 then
    raise exception 'Coverage contract fixture counts are wrong: %, %, %, %',
      complete_variants, short_variants, unsupported_empty_variants,
      unsupported_with_candidate_variants;
  end if;

  with profile as (
    select equipment_inventory
    from public.exercise_replacement_profiles
    where slug = 'regression_contract_profile'
  ),
  source as (
    select exercise.*,
      exists (
        select 1 from jsonb_array_elements(exercise.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (profile.equipment_inventory ? requirement)
        )
      ) as source_available
    from public.exercises exercise cross join profile
    where exercise.slug = 'regression_contract_machine_source'
  ),
  candidates as (
    select candidate.*
    from source cross join profile
    join public.exercises candidate
      on candidate.is_active
     and candidate.replacement_status = 'eligible'
     and candidate.category = source.category
     and candidate.replacement_family = source.replacement_family
     and coalesce(candidate.variant_group, candidate.slug)
         <> coalesce(source.variant_group, source.slug)
    where candidate.equipment_options <> '[]'::jsonb
      and exists (
        select 1 from jsonb_array_elements(candidate.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (profile.equipment_inventory ? requirement)
        )
      )
  )
  select
    (select source_available from source),
    count(distinct coalesce(variant_group, slug))
  into machine_source_available, machine_source_alternatives
  from candidates;

  if machine_source_available or machine_source_alternatives <> 3 then
    raise exception 'Unavailable source did not retain three home alternatives: %, %',
      machine_source_available, machine_source_alternatives;
  end if;

  with profile as (
    select equipment_inventory
    from public.exercise_replacement_profiles
    where slug = 'regression_contract_profile'
  )
  select count(distinct coalesce(exercise.variant_group, exercise.slug))
  into specialist_physical_variants
  from public.exercises exercise cross join profile
  where exercise.is_active
    and exercise.replacement_family = 'regression_specialist_hidden'
    and exercise.equipment_options <> '[]'::jsonb
    and exists (
      select 1 from jsonb_array_elements(exercise.equipment_options) option
      where not exists (
        select 1 from jsonb_array_elements_text(option) requirement
        where not (profile.equipment_inventory ? requirement)
      )
    );

  if specialist_physical_variants <> 1 then
    raise exception 'Specialist status hid a physically available variant';
  end if;
end;
$$;

delete from public.exercise_replacement_coverage_requirements
where profile_slug = 'regression_contract_profile';
delete from public.exercise_replacement_profiles
where slug = 'regression_contract_profile';
delete from public.exercises
where slug like 'regression_contract_%';

do $$
begin
  if exists (
    select 1
    from public.exercises
    where is_active and replacement_status = 'unreviewed'
  ) then
    raise exception 'Active replacement records remain unreviewed';
  end if;

  if exists (
    select 1
    from public.exercises
    where is_active
      and replacement_status = 'eligible'
      and (
        replacement_family is null
        or equipment_options = '[]'::jsonb
        or variant_group is null
      )
  ) then
    raise exception 'Eligible replacement record has incomplete family, equipment, or variant metadata';
  end if;

  if (select count(*) from public.exercise_replacement_profiles) <> 4
     or exists (
       with expected(slug, equipment_inventory) as (
         values
           ('home_bodyweight'::text,
            '["bodyweight","chair","wall","table","doorway","stable_counter"]'::jsonb),
           ('home_band',
            '["bodyweight","chair","wall","table","doorway","stable_counter","band","anchor","high_anchor"]'::jsonb),
           ('home_dumbbell',
            '["bodyweight","chair","wall","table","doorway","stable_counter","dumbbell","bench","step"]'::jsonb),
           ('gym',
            '["bodyweight","chair","wall","table","doorway","stable_counter","band","anchor","high_anchor","dumbbell","bench","adjustable_bench","preacher_bench","step","barbell","rack","cable","machine","kettlebell","fat_grip","smith_machine","plate","rope","rope_attachment","cuff_attachment","landmine","ankle_weight","sliders","sliding_surface","pull_up_bar","neutral_grip_pull_up_bar","dip_bars","battle_ropes","bike","bicycle","elliptical","jump_rope","stair_climber","stairs","treadmill","pool","foam_roller","lacrosse_ball","glute_ham_developer","nordic_bench","stick","ab_crunch_machine","assisted_dip_machine","assisted_pull_up_machine","belt_squat_machine","chest_press_machine","donkey_calf_machine","hack_squat_machine","hip_abduction_machine","hip_adduction_machine","hip_thrust_machine","lat_pulldown_machine","lateral_raise_machine","leg_extension_machine","leg_press_machine","lying_leg_curl_machine","pec_deck_machine","pullover_machine","row_machine","seated_calf_machine","seated_leg_curl_machine","shoulder_press_machine","shrug_machine","standing_calf_machine","t_bar_row_machine"]'::jsonb)
       )
       select 1
       from expected
       left join public.exercise_replacement_profiles profile using (slug)
       where profile.slug is null
          or not (profile.equipment_inventory @> expected.equipment_inventory)
          or not (expected.equipment_inventory @> profile.equipment_inventory)
          or jsonb_array_length(profile.equipment_inventory)
             <> jsonb_array_length(expected.equipment_inventory)
     )
  then
    raise exception 'Replacement equipment profiles differ from the explicit contract';
  end if;

  if exists (
    select 1
    from public.exercise_replacement_profiles profile
    where jsonb_array_length(profile.equipment_inventory) <> (
      select count(distinct item)
      from jsonb_array_elements_text(profile.equipment_inventory) item
    )
  ) then
    raise exception 'Replacement profile contains duplicate equipment tokens';
  end if;

  if exists (
    with profiled_families as (
      select distinct category, replacement_family
      from public.exercises
      where is_active and replacement_family is not null
    )
    select 1
    from profiled_families family
    cross join public.exercise_replacement_profiles profile
    left join public.exercise_replacement_coverage_requirements requirement
      on requirement.category = family.category
     and requirement.replacement_family = family.replacement_family
     and requirement.profile_slug = profile.slug
    where requirement.profile_slug is null
  ) then
    raise exception 'Profiled family is missing an explicit profile coverage requirement';
  end if;

  if exists (
    select 1
    from public.exercise_replacement_coverage_requirements requirement
    where not exists (
      select 1
      from public.exercises exercise
      where exercise.is_active
        and exercise.category = requirement.category
        and exercise.replacement_family = requirement.replacement_family
    )
  ) then
    raise exception 'Coverage requirement does not map to an active profiled family';
  end if;

  if exists (
    with actual as (
      select
        requirement.category,
        requirement.replacement_family,
        requirement.profile_slug,
        requirement.expectation,
        requirement.minimum_variant_groups,
        count(distinct coalesce(exercise.variant_group, exercise.slug)) filter (
          where exercise.id is not null
            and exercise.replacement_status = 'eligible'
        ) as eligible_variant_groups,
        count(distinct coalesce(exercise.variant_group, exercise.slug)) filter (
          where exercise.id is not null
        ) as physically_available_variant_groups
      from public.exercise_replacement_coverage_requirements requirement
      join public.exercise_replacement_profiles profile
        on profile.slug = requirement.profile_slug
      left join public.exercises exercise
        on exercise.is_active
       and exercise.category = requirement.category
       and exercise.replacement_family = requirement.replacement_family
       and exercise.equipment_options <> '[]'::jsonb
       and exists (
         select 1 from jsonb_array_elements(exercise.equipment_options) option
         where not exists (
           select 1 from jsonb_array_elements_text(option) equipment_requirement
           where not (profile.equipment_inventory ? equipment_requirement)
         )
       )
      group by
        requirement.category,
        requirement.replacement_family,
        requirement.profile_slug,
        requirement.expectation,
        requirement.minimum_variant_groups
    )
    select 1
    from actual
    where (expectation = 'required'
           and eligible_variant_groups < minimum_variant_groups)
       or (expectation = 'unsupported_equipment'
           and physically_available_variant_groups <> 0)
  ) then
    raise exception 'Replacement coverage contract has a required shortfall or invalid unsupported waiver';
  end if;
end;
$$;

-- Acceptance metadata is backend-only, even though exercise references remain
-- publicly readable under the existing reference-catalog policy.
do $$
declare table_name text;
begin
  foreach table_name in array array['exercise_replacement_profiles', 'exercise_replacement_coverage_requirements'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||table_name)::regclass)
       or has_table_privilege('anon', 'public.'||table_name, 'select')
       or has_table_privilege('authenticated', 'public.'||table_name, 'select')
       or has_table_privilege('authenticated', 'public.'||table_name, 'insert,update,delete')
       or not has_table_privilege('service_role', 'public.'||table_name, 'select') then
      raise exception 'Coverage-contract RLS/grants changed for %', table_name;
    end if;
  end loop;
end $$;

rollback;
