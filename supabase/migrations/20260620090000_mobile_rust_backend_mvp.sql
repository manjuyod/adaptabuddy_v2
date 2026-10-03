begin;

alter table public.users
  add column if not exists birth_date date null,
  add column if not exists formula_sex text null
    check (formula_sex is null or formula_sex in ('male', 'female'));

alter table public.nutrition_food_logs
  add column if not exists meal_type text not null default 'other'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  add column if not exists carbs_grams integer null check (carbs_grams is null or carbs_grams >= 0),
  add column if not exists fat_grams integer null check (fat_grams is null or fat_grams >= 0),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.exercise_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_slug text not null,
  estimated_one_rep_max double precision null,
  weight double precision null,
  reps integer null check (reps is null or reps >= 0),
  unit text null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.muscle_group_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  muscle_group text not null,
  score integer not null default 0,
  training_frequency integer not null default 0,
  caution text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, muscle_group)
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active', 'archived', 'cancelled')),
  class_selection text not null default 'no_class',
  preferred_training_goal text null,
  warnings text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan_id uuid not null references public.workout_plans(id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'planned'
    check (status in ('planned', 'started', 'completed', 'partially_completed', 'skipped', 'cancelled')),
  name text not null,
  notes text null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_slug text not null,
  name text not null,
  sets integer not null default 3 check (sets >= 0),
  reps integer not null default 8 check (reps >= 0),
  caution_notes text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

alter table public.workout_sessions
  add column if not exists workout_day_id uuid null references public.workout_days(id) on delete set null,
  add column if not exists status text not null default 'completed'
    check (status in ('planned', 'started', 'completed', 'partially_completed', 'skipped', 'cancelled')),
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists finished_at timestamptz null,
  add column if not exists xp_awarded integer not null default 0;

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_exercise_id uuid null references public.workout_exercises(id) on delete set null,
  exercise_slug text not null,
  status text not null default 'completed'
    check (status in ('completed', 'partial', 'skipped', 'failed')),
  sets_completed integer null check (sets_completed is null or sets_completed >= 0),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists nutrition_food_logs_user_meal_logged_idx
  on public.nutrition_food_logs (user_id, meal_type, logged_at desc);

create index if not exists exercise_stats_user_recorded_idx
  on public.exercise_stats (user_id, recorded_at desc);

create index if not exists muscle_group_stats_user_updated_idx
  on public.muscle_group_stats (user_id, updated_at desc);

create index if not exists xp_events_user_occurred_idx
  on public.xp_events (user_id, occurred_at desc);

create index if not exists workout_plans_user_dates_idx
  on public.workout_plans (user_id, start_date desc, end_date desc);

create index if not exists workout_days_user_plan_date_idx
  on public.workout_days (user_id, workout_plan_id, scheduled_date);

create index if not exists workout_exercises_user_day_idx
  on public.workout_exercises (user_id, workout_day_id);

create index if not exists workout_sessions_user_day_started_idx
  on public.workout_sessions (user_id, workout_day_id, started_at desc);

create index if not exists workout_session_exercises_user_session_idx
  on public.workout_session_exercises (user_id, workout_session_id);

alter table public.exercise_stats enable row level security;
alter table public.muscle_group_stats enable row level security;
alter table public.xp_events enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_session_exercises enable row level security;

drop policy if exists exercise_stats_owner_all on public.exercise_stats;
create policy exercise_stats_owner_all on public.exercise_stats
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists muscle_group_stats_owner_all on public.muscle_group_stats;
create policy muscle_group_stats_owner_all on public.muscle_group_stats
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists xp_events_owner_select on public.xp_events;
create policy xp_events_owner_select on public.xp_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists xp_events_owner_insert on public.xp_events;
create policy xp_events_owner_insert on public.xp_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists workout_plans_owner_all on public.workout_plans;
create policy workout_plans_owner_all on public.workout_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists workout_days_owner_all on public.workout_days;
create policy workout_days_owner_all on public.workout_days
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists workout_exercises_owner_all on public.workout_exercises;
create policy workout_exercises_owner_all on public.workout_exercises
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists workout_session_exercises_owner_all on public.workout_session_exercises;
create policy workout_session_exercises_owner_all on public.workout_session_exercises
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.exercise_stats from anon, authenticated, public;
revoke all on public.muscle_group_stats from anon, authenticated, public;
revoke all on public.xp_events from anon, authenticated, public;
revoke all on public.workout_plans from anon, authenticated, public;
revoke all on public.workout_days from anon, authenticated, public;
revoke all on public.workout_exercises from anon, authenticated, public;
revoke all on public.workout_session_exercises from anon, authenticated, public;

grant select, insert, update, delete on public.exercise_stats to authenticated;
grant select, insert, update, delete on public.muscle_group_stats to authenticated;
grant select, insert on public.xp_events to authenticated;
grant select, insert, update, delete on public.workout_plans to authenticated;
grant select, insert, update, delete on public.workout_days to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.workout_session_exercises to authenticated;

commit;
