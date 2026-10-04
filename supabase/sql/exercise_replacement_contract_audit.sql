-- Read-only acceptance audit for replacement coverage.
-- Planning candidates are not clinical or injury-safe substitutions.

select
  replacement_status,
  count(*) filter (where is_active) as active_count,
  count(*) filter (where not is_active) as inactive_count
from public.exercises
group by replacement_status
order by replacement_status;

select
  slug,
  category,
  replacement_family,
  replacement_status,
  replacement_reason
from public.exercises
where is_active
  and (
    replacement_status = 'unreviewed'
    or (
      replacement_status = 'eligible'
      and (
        replacement_family is null
        or equipment_options = '[]'::jsonb
        or variant_group is null
      )
    )
  )
order by replacement_status, category, replacement_family, slug;

-- Raw zero/one results remain visible regardless of the requirement outcome.
-- Sources are every active profiled row, even when their own equipment is not
-- in the profile. Candidates must be active, eligible, and profile-available.
with sources as (
  select
    profile.slug as profile_slug,
    profile.equipment_inventory,
    source.*,
    source.equipment_options <> '[]'::jsonb
      and exists (
        select 1 from jsonb_array_elements(source.equipment_options) option
        where not exists (
          select 1 from jsonb_array_elements_text(option) requirement
          where not (profile.equipment_inventory ? requirement)
        )
      ) as source_available
  from public.exercise_replacement_profiles profile
  cross join public.exercises source
  where source.is_active and source.replacement_family is not null
),
raw_coverage as (
  select
    source.profile_slug,
    source.id,
    source.source_available,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) as replacement_count,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.tracking_mode = source.tracking_mode
    ) as same_tracking_count
  from sources source
  left join public.exercises candidate
    on candidate.is_active
   and candidate.replacement_status = 'eligible'
   and candidate.category = source.category
   and candidate.replacement_family = source.replacement_family
   and coalesce(candidate.variant_group, candidate.slug)
       <> coalesce(source.variant_group, source.slug)
   and candidate.equipment_options <> '[]'::jsonb
   and exists (
     select 1 from jsonb_array_elements(candidate.equipment_options) option
     where not exists (
       select 1 from jsonb_array_elements_text(option) requirement
       where not (source.equipment_inventory ? requirement)
     )
   )
  group by source.profile_slug, source.id, source.source_available
)
select
  raw.profile_slug,
  source.category,
  source.replacement_family,
  source.slug,
  source.replacement_status,
  source.replacement_reason,
  raw.source_available,
  source.tracking_mode,
  raw.replacement_count,
  raw.same_tracking_count
from raw_coverage raw
join public.exercises source on source.id = raw.id
where raw.replacement_count <= 1 or raw.same_tracking_count <= 1
order by
  raw.profile_slug,
  raw.replacement_count,
  raw.same_tracking_count,
  source.category,
  source.replacement_family,
  source.slug;

with actual as (
  select
    requirement.category,
    requirement.replacement_family,
    requirement.profile_slug,
    requirement.expectation,
    requirement.minimum_variant_groups,
    requirement.reason,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
        and candidate.replacement_status = 'eligible'
    ) as eligible_variant_groups,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
    ) as physically_available_variant_groups,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
        and candidate.replacement_status = 'eligible'
        and candidate.tracking_mode = 'reps'
    ) as reps_variant_groups,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
        and candidate.replacement_status = 'eligible'
        and candidate.tracking_mode = 'reps_each_side'
    ) as reps_each_side_variant_groups,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
        and candidate.replacement_status = 'eligible'
        and candidate.tracking_mode = 'duration'
    ) as duration_variant_groups,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
        and candidate.replacement_status = 'eligible'
        and candidate.tracking_mode = 'duration_each_side'
    ) as duration_each_side_variant_groups,
    count(distinct coalesce(candidate.variant_group, candidate.slug)) filter (
      where candidate.id is not null
        and candidate.replacement_status = 'eligible'
        and candidate.tracking_mode = 'duration_distance'
    ) as duration_distance_variant_groups
  from public.exercise_replacement_coverage_requirements requirement
  join public.exercise_replacement_profiles profile
    on profile.slug = requirement.profile_slug
  left join public.exercises candidate
    on candidate.is_active
   and candidate.category = requirement.category
   and candidate.replacement_family = requirement.replacement_family
   and candidate.equipment_options <> '[]'::jsonb
   and exists (
     select 1 from jsonb_array_elements(candidate.equipment_options) option
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
    requirement.minimum_variant_groups,
    requirement.reason
)
select
  *,
  case
    when expectation = 'required'
      and eligible_variant_groups >= minimum_variant_groups
      then 'required_pass'
    when expectation = 'required'
      then 'required_shortfall'
    when expectation = 'unsupported_equipment'
      and physically_available_variant_groups = 0
      then 'expected_unsupported'
    else 'unsupported_has_candidates'
  end as contract_result
from actual
order by
  case
    when expectation = 'required'
      and eligible_variant_groups < minimum_variant_groups then 0
    when expectation = 'unsupported_equipment'
      and physically_available_variant_groups <> 0 then 1
    else 2
  end,
  category,
  replacement_family,
  profile_slug;

-- Missing rows are contract failures. Expectations are never inferred from
-- candidate counts.
with profiled_families as (
  select distinct category, replacement_family
  from public.exercises
  where is_active and replacement_family is not null
)
select
  family.category,
  family.replacement_family,
  profile.slug as missing_profile_slug
from profiled_families family
cross join public.exercise_replacement_profiles profile
left join public.exercise_replacement_coverage_requirements requirement
  on requirement.category = family.category
 and requirement.replacement_family = family.replacement_family
 and requirement.profile_slug = profile.slug
where requirement.profile_slug is null
order by family.category, family.replacement_family, profile.slug;

select requirement.*
from public.exercise_replacement_coverage_requirements requirement
where not exists (
  select 1
  from public.exercises exercise
  where exercise.is_active
    and exercise.category = requirement.category
    and exercise.replacement_family = requirement.replacement_family
)
order by requirement.category, requirement.replacement_family, requirement.profile_slug;

select
  profile.slug,
  item.value as duplicated_equipment_token,
  count(*) as occurrences
from public.exercise_replacement_profiles profile
cross join lateral jsonb_array_elements_text(profile.equipment_inventory) item(value)
group by profile.slug, item.value
having count(*) > 1
order by profile.slug, item.value;
