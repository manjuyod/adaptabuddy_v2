-- Local development seed for Supabase CLI resets.
-- Do not create normal test users here. Tests should create users through
-- Supabase Auth Admin so auth.users, JWTs, triggers, and public.users stay aligned.

insert into public.muscle_groups (slug, name)
values
  ('chest', 'Chest'),
  ('back', 'Back'),
  ('legs', 'Legs'),
  ('shoulders', 'Shoulders'),
  ('core', 'Core')
on conflict (slug) do update
set name = excluded.name;

insert into public.exercises (
  slug,
  name,
  movement_pattern,
  equipment,
  is_bodyweight,
  aliases,
  tags,
  media,
  contraindications,
  is_active
)
values
  ('push_up', 'Push-up', 'horizontal_push', '["bodyweight"]'::jsonb, true, '[]'::jsonb, '["push"]'::jsonb, '{}'::jsonb, '[]'::jsonb, true),
  ('bodyweight_squat', 'Bodyweight Squat', 'squat', '["bodyweight"]'::jsonb, true, '[]'::jsonb, '["legs"]'::jsonb, '{}'::jsonb, '[]'::jsonb, true),
  ('dumbbell_row', 'Dumbbell Row', 'horizontal_pull', '["dumbbell"]'::jsonb, false, '[]'::jsonb, '["pull"]'::jsonb, '{}'::jsonb, '[]'::jsonb, true)
on conflict (slug) do update
set
  name = excluded.name,
  movement_pattern = excluded.movement_pattern,
  equipment = excluded.equipment,
  is_bodyweight = excluded.is_bodyweight,
  tags = excluded.tags,
  is_active = excluded.is_active;

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
  'horizontal_push',
  '["bodyweight"]'::jsonb,
  '["push"]'::jsonb,
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
