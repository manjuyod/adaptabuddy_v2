begin;

alter table public.exercises
  add column replacement_family text,
  add column equipment_options jsonb not null default '[]'::jsonb,
  add column variant_group text;

alter table public.exercises
  add constraint exercises_replacement_family_nonempty_check
    check (replacement_family is null or btrim(replacement_family) <> ''),
  add constraint exercises_variant_group_nonempty_check
    check (variant_group is null or btrim(variant_group) <> ''),
  add constraint exercises_equipment_options_shape_check
    check (
      jsonb_typeof(equipment_options) = 'array'
      and not jsonb_path_exists(
        equipment_options,
        'strict $[*] ? (@.type() != "array")'
      )
      and not jsonb_path_exists(
        equipment_options,
        'strict $[*] ? (@.size() == 0)'
      )
      and not jsonb_path_exists(
        equipment_options,
        'strict $[*][*] ? (@.type() != "string")'
      )
      and not jsonb_path_exists(
        equipment_options,
        'strict $[*][*] ? (@ == "")'
      )
    );

comment on column public.exercises.replacement_family is
  'Curated functional-action family used to find same-function replacements within a category.';
comment on column public.exercises.equipment_options is
  'Equipment alternatives as OR-of-AND string arrays. [] means unknown; bodyweight must be explicit.';
comment on column public.exercises.variant_group is
  'Exercises in the same variant group are not independent replacement choices.';

commit;
