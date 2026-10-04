-- Local development seed for Supabase CLI resets.
-- Do not create normal test users here. Tests should create users through
-- Supabase Auth Admin so auth.users, JWTs, triggers, and public.users stay aligned.

-- The complete exercise/muscle catalog is versioned in the 2026100310*
-- migrations. Do not overwrite its corrected anatomy, categories or metadata
-- with the former three-exercise smoke fixture during a reset.

insert into public.programs (
  slug,
  name,
  program_type,
  min_days_per_week,
  max_days_per_week,
  default_days_per_week,
  description,
  metadata,
  is_active
)
values (
  'general_health_foundation',
  'General Health Foundation',
  'hybrid',
  3,
  5,
  4,
  'Starter training template for local development and API smoke checks.',
  '{}'::jsonb,
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  program_type = excluded.program_type,
  min_days_per_week = excluded.min_days_per_week,
  max_days_per_week = excluded.max_days_per_week,
  default_days_per_week = excluded.default_days_per_week,
  description = excluded.description,
  metadata = excluded.metadata,
  is_active = excluded.is_active;

with program_row as (
  select id from public.programs where slug = 'general_health_foundation'
)
insert into public.program_days (program_id, day_index, name, theme_tags)
select id, 0, 'Full Body A', '["full_body"]'::jsonb
from program_row
on conflict do nothing;

with day_row as (
  select pd.id
  from public.program_days pd
  join public.programs p on p.id = pd.program_id
  where p.slug = 'general_health_foundation'
    and pd.day_index = 0
),
exercise_row as (
  select id from public.exercises where slug = 'push_up'
)
insert into public.program_slots (
  program_day_id,
  slot_index,
  slot_type,
  lock_type,
  locked_exercise_id,
  movement_pattern,
  equipment_allowed,
  tags_required,
  tags_blocked,
  sets_min,
  sets_max,
  reps_min,
  reps_max,
  rir_min,
  rir_max,
  muscle_targets,
  prescription,
  is_optional
)
select
  day_row.id,
  0,
  'main',
  'locked',
  exercise_row.id,
  'push',
  '["bodyweight"]'::jsonb,
  '["pushup"]'::jsonb,
  '[]'::jsonb,
  2,
  4,
  6,
  12,
  1,
  3,
  '{"chest": 1.0}'::jsonb,
  '{"tempo": "controlled"}'::jsonb,
  false
from day_row
cross join exercise_row
on conflict do nothing;
