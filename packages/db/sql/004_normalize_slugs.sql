-- Normalize slugs to lowercase underscore format.
-- Also remap program_slots.muscle_targets keys to new muscle_group slugs.

begin;

-- Build mapping for muscle_group slugs so JSON keys can be remapped safely.
create temp table muscle_slug_map as
select
  slug as old_slug,
  lower(trim(both '_' from regexp_replace(slug, '[^a-zA-Z0-9]+', '_', 'g'))) as new_slug
from public.muscle_groups
where slug <> lower(trim(both '_' from regexp_replace(slug, '[^a-zA-Z0-9]+', '_', 'g')));

-- Update exercises slugs.
update public.exercises
set slug = lower(trim(both '_' from regexp_replace(slug, '[^a-zA-Z0-9]+', '_', 'g')))
where slug <> lower(trim(both '_' from regexp_replace(slug, '[^a-zA-Z0-9]+', '_', 'g')));

-- Update muscle_groups slugs.
update public.muscle_groups
set slug = m.new_slug
from muscle_slug_map m
where public.muscle_groups.slug = m.old_slug;

-- Update programs slugs.
update public.programs
set slug = lower(trim(both '_' from regexp_replace(slug, '[^a-zA-Z0-9]+', '_', 'g')))
where slug <> lower(trim(both '_' from regexp_replace(slug, '[^a-zA-Z0-9]+', '_', 'g')));

-- Remap muscle_targets JSON keys.
update public.program_slots
set muscle_targets = (
  select coalesce(
    jsonb_object_agg(coalesce(m.new_slug, e.key), e.value),
    '{}'::jsonb
  )
  from jsonb_each(public.program_slots.muscle_targets) as e(key, value)
  left join muscle_slug_map m on m.old_slug = e.key
);

commit;
