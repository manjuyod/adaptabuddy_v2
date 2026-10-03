begin;

alter table public.users
  add column if not exists display_name text null,
  add column if not exists unit_system text not null default 'lbs'
    check (unit_system in ('lbs', 'kg'));

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (
    event_name in (
      'WorkoutCompleted',
      'ExerciseLogged',
      'SetLogged',
      'FoodLogged',
      'CalorieTargetHit',
      'ProteinGoalHit',
      'HabitCompleted',
      'BodyMetricUpdated',
      'RecoveryDayTaken',
      'GoalCreated',
      'GoalCompleted'
    )
  ),
  source text not null default 'api' check (source in ('health_app', 'mobile', 'unity', 'api')),
  occurred_at timestamptz not null default now(),
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists health_events_user_occurred_idx
  on public.health_events (user_id, occurred_at desc);

create table if not exists public.nutrition_food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null,
  calories integer not null check (calories >= 0),
  protein_grams integer not null default 0 check (protein_grams >= 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists nutrition_food_logs_user_logged_idx
  on public.nutrition_food_logs (user_id, logged_at desc);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_completed_idx
  on public.workout_sessions (user_id, completed_at desc);

create table if not exists public.nutrition_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calorie_target integer null check (calorie_target is null or calorie_target > 0),
  protein_target_grams integer null check (protein_target_grams is null or protein_target_grams > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cadence text not null default 'daily',
  archived_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists habit_check_ins_user_completed_idx
  on public.habit_check_ins (user_id, completed_at desc);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null,
  value double precision not null,
  unit text not null,
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists body_metrics_user_measured_idx
  on public.body_metrics (user_id, measured_at desc);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target text not null,
  completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_completed_idx
  on public.goals (user_id, completed, created_at desc);

alter table public.health_events enable row level security;
alter table public.nutrition_food_logs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.habits enable row level security;
alter table public.habit_check_ins enable row level security;
alter table public.body_metrics enable row level security;
alter table public.goals enable row level security;

drop policy if exists health_events_owner_select on public.health_events;
create policy health_events_owner_select on public.health_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists health_events_owner_insert on public.health_events;
create policy health_events_owner_insert on public.health_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_food_logs_owner_all on public.nutrition_food_logs;
create policy nutrition_food_logs_owner_all on public.nutrition_food_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists workout_sessions_owner_all on public.workout_sessions;
create policy workout_sessions_owner_all on public.workout_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists nutrition_targets_owner_all on public.nutrition_targets;
create policy nutrition_targets_owner_all on public.nutrition_targets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists habits_owner_all on public.habits;
create policy habits_owner_all on public.habits
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists habit_check_ins_owner_all on public.habit_check_ins;
create policy habit_check_ins_owner_all on public.habit_check_ins
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists body_metrics_owner_all on public.body_metrics;
create policy body_metrics_owner_all on public.body_metrics
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists goals_owner_all on public.goals;
create policy goals_owner_all on public.goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.health_events from anon, authenticated, public;
revoke all on public.nutrition_food_logs from anon, authenticated, public;
revoke all on public.workout_sessions from anon, authenticated, public;
revoke all on public.nutrition_targets from anon, authenticated, public;
revoke all on public.habits from anon, authenticated, public;
revoke all on public.habit_check_ins from anon, authenticated, public;
revoke all on public.body_metrics from anon, authenticated, public;
revoke all on public.goals from anon, authenticated, public;

grant select, insert on public.health_events to authenticated;
grant select, insert, update, delete on public.nutrition_food_logs to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.nutrition_targets to authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, update, delete on public.habit_check_ins to authenticated;
grant select, insert, update, delete on public.body_metrics to authenticated;
grant select, insert, update, delete on public.goals to authenticated;

commit;
