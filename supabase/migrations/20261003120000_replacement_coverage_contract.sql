begin;

alter table public.exercises
  add column replacement_status text not null default 'unreviewed',
  add column replacement_reason text;

alter table public.exercises
  add constraint exercises_replacement_status_check
    check (replacement_status in (
      'eligible', 'protocol', 'sequence', 'specialist_review', 'unreviewed'
    )),
  add constraint exercises_replacement_reason_nonempty_check
    check (replacement_reason is null or btrim(replacement_reason) <> ''),
  add constraint exercises_replacement_status_reason_check
    check (
      (replacement_status = 'eligible' and replacement_reason is null)
      or replacement_status = 'unreviewed'
      or (
        replacement_status in ('protocol', 'sequence', 'specialist_review')
        and replacement_reason is not null
      )
    );

comment on column public.exercises.replacement_status is
  'Editorial eligibility for replacement planning; unreviewed is never selectable.';
comment on column public.exercises.replacement_reason is
  'Required justification for protocol, sequence, and specialist-review exclusions.';

-- The existing curated cohort is eligible. Remaining active rows stay
-- unreviewed until the follow-on classification migration supplies explicit
-- exclusion statuses and reasons.
update public.exercises
set replacement_status = 'eligible', replacement_reason = null
where is_active
  and replacement_family is not null
  and equipment_options <> '[]'::jsonb;

create table public.exercise_replacement_profiles (
  slug text primary key,
  equipment_inventory jsonb not null,
  description text not null,
  constraint exercise_replacement_profiles_slug_nonempty_check
    check (btrim(slug) <> ''),
  constraint exercise_replacement_profiles_description_nonempty_check
    check (btrim(description) <> ''),
  constraint exercise_replacement_profiles_equipment_shape_check
    check (
      jsonb_typeof(equipment_inventory) = 'array'
      and jsonb_array_length(equipment_inventory) > 0
      and not jsonb_path_exists(
        equipment_inventory,
        'strict $[*] ? (@.type() != "string")'
      )
      and not jsonb_path_exists(
        equipment_inventory,
        'strict $[*] ? (@ == "")'
      )
    )
);

comment on table public.exercise_replacement_profiles is
  'Explicit equipment inventories used by the replacement coverage contract.';
comment on column public.exercise_replacement_profiles.equipment_inventory is
  'Flat JSON string array of equipment the profile owns; tokens match exactly.';

create table public.exercise_replacement_coverage_requirements (
  category text not null,
  replacement_family text not null,
  profile_slug text not null references public.exercise_replacement_profiles(slug)
    on update cascade on delete restrict,
  expectation text not null,
  minimum_variant_groups smallint,
  reason text,
  primary key (category, replacement_family, profile_slug),
  constraint exercise_replacement_requirements_category_nonempty_check
    check (btrim(category) <> ''),
  constraint exercise_replacement_requirements_family_nonempty_check
    check (btrim(replacement_family) <> ''),
  constraint exercise_replacement_requirements_expectation_check
    check (expectation in ('required', 'unsupported_equipment')),
  constraint exercise_replacement_requirements_reason_nonempty_check
    check (reason is null or btrim(reason) <> ''),
  constraint exercise_replacement_requirements_contract_check
    check (
      (
        expectation = 'required'
        and minimum_variant_groups is not null
        and minimum_variant_groups >= 3
        and reason is null
      )
      or (
        expectation = 'unsupported_equipment'
        and minimum_variant_groups is null
        and reason is not null
      )
    )
);

comment on table public.exercise_replacement_coverage_requirements is
  'Independent category/family/profile acceptance contract; unsupported rows require zero candidates.';
comment on column public.exercise_replacement_coverage_requirements.minimum_variant_groups is
  'Required distinct candidate variants. Values below three are forbidden.';

alter table public.exercise_replacement_profiles enable row level security;
alter table public.exercise_replacement_coverage_requirements enable row level security;

revoke all on table
  public.exercise_replacement_profiles,
  public.exercise_replacement_coverage_requirements
from anon, authenticated, public;

grant select on table
  public.exercise_replacement_profiles,
  public.exercise_replacement_coverage_requirements
to service_role;

commit;
