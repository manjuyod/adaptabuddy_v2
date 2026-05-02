-- Wave 2 normalized cycle-state tables for engine-owned intake, plans, sessions, and gamification.

begin;

create table if not exists public.engine_cycle_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  class_choice text not null,
  goal_bias text not null,
  available_days_per_week smallint not null,
  fatigue_preference text not null,
  injury_muscle_group_slugs text[] not null default '{}'::text[],
  macrocycle_weeks smallint not null,
  resolved_class_archetype text,
  created_at timestamptz not null default now()
);

create table if not exists public.engine_cycle_program_mix (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id bigint not null references public.engine_cycle_profiles(id) on delete cascade,
  program_id integer not null references public.programs(id) on delete cascade,
  selection_weight numeric not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.engine_cycle_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id bigint not null references public.engine_cycle_profiles(id) on delete cascade,
  primary_program_id integer references public.programs(id) on delete set null,
  resolved_class_archetype text,
  total_weeks smallint not null,
  mesocycle_count smallint not null default 1,
  current_mesocycle_index integer not null default 0,
  current_microcycle_index integer not null default 0,
  current_session_index integer not null default 0,
  total_sessions integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.engine_cycle_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint not null references public.engine_cycle_plans(id) on delete cascade,
  session_index integer not null,
  program_id integer references public.programs(id) on delete set null,
  program_day_id integer references public.program_days(id) on delete set null,
  program_day_name text not null,
  macro_week smallint not null,
  mesocycle_index integer not null,
  microcycle_index integer not null,
  planned_day_of_week smallint not null,
  class_archetype text,
  slot_payload jsonb not null default '[]'::jsonb,
  session_seed text,
  projected_fatigue_cost jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint engine_cycle_sessions_plan_session_key unique (plan_id, session_index)
);

create table if not exists public.engine_gamification_states (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint not null references public.engine_cycle_plans(id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  adherence_streak integer not null default 0,
  class_archetype text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_engine_cycle_plans_user_active
  on public.engine_cycle_plans (user_id)
  where is_active;

create index if not exists idx_engine_cycle_profiles_user
  on public.engine_cycle_profiles (user_id, created_at desc);

create index if not exists idx_engine_cycle_program_mix_profile
  on public.engine_cycle_program_mix (profile_id);

create index if not exists idx_engine_cycle_sessions_plan_index
  on public.engine_cycle_sessions (plan_id, session_index);

create index if not exists idx_engine_gamification_states_plan
  on public.engine_gamification_states (plan_id);

alter table public.engine_cycle_profiles enable row level security;
alter table public.engine_cycle_program_mix enable row level security;
alter table public.engine_cycle_plans enable row level security;
alter table public.engine_cycle_sessions enable row level security;
alter table public.engine_gamification_states enable row level security;

revoke all on public.engine_cycle_profiles from anon, authenticated;
revoke all on public.engine_cycle_program_mix from anon, authenticated;
revoke all on public.engine_cycle_plans from anon, authenticated;
revoke all on public.engine_cycle_sessions from anon, authenticated;
revoke all on public.engine_gamification_states from anon, authenticated;

grant select, insert, update on public.engine_cycle_profiles to authenticated;
grant select, insert, update on public.engine_cycle_program_mix to authenticated;
grant select, insert, update on public.engine_cycle_plans to authenticated;
grant select, insert, update on public.engine_cycle_sessions to authenticated;
grant select, insert, update on public.engine_gamification_states to authenticated;

grant usage, select on sequence public.engine_cycle_profiles_id_seq to authenticated;
grant usage, select on sequence public.engine_cycle_program_mix_id_seq to authenticated;
grant usage, select on sequence public.engine_cycle_plans_id_seq to authenticated;
grant usage, select on sequence public.engine_cycle_sessions_id_seq to authenticated;
grant usage, select on sequence public.engine_gamification_states_id_seq to authenticated;

drop policy if exists engine_cycle_profiles_select_own on public.engine_cycle_profiles;
create policy engine_cycle_profiles_select_own
  on public.engine_cycle_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_profiles_insert_own on public.engine_cycle_profiles;
create policy engine_cycle_profiles_insert_own
  on public.engine_cycle_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_profiles_update_own on public.engine_cycle_profiles;
create policy engine_cycle_profiles_update_own
  on public.engine_cycle_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_program_mix_select_own on public.engine_cycle_program_mix;
create policy engine_cycle_program_mix_select_own
  on public.engine_cycle_program_mix for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_program_mix_insert_own on public.engine_cycle_program_mix;
create policy engine_cycle_program_mix_insert_own
  on public.engine_cycle_program_mix for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_program_mix_update_own on public.engine_cycle_program_mix;
create policy engine_cycle_program_mix_update_own
  on public.engine_cycle_program_mix for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_plans_select_own on public.engine_cycle_plans;
create policy engine_cycle_plans_select_own
  on public.engine_cycle_plans for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_plans_insert_own on public.engine_cycle_plans;
create policy engine_cycle_plans_insert_own
  on public.engine_cycle_plans for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_plans_update_own on public.engine_cycle_plans;
create policy engine_cycle_plans_update_own
  on public.engine_cycle_plans for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_sessions_select_own on public.engine_cycle_sessions;
create policy engine_cycle_sessions_select_own
  on public.engine_cycle_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_sessions_insert_own on public.engine_cycle_sessions;
create policy engine_cycle_sessions_insert_own
  on public.engine_cycle_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_sessions_update_own on public.engine_cycle_sessions;
create policy engine_cycle_sessions_update_own
  on public.engine_cycle_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_gamification_states_select_own on public.engine_gamification_states;
create policy engine_gamification_states_select_own
  on public.engine_gamification_states for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_gamification_states_insert_own on public.engine_gamification_states;
create policy engine_gamification_states_insert_own
  on public.engine_gamification_states for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_gamification_states_update_own on public.engine_gamification_states;
create policy engine_gamification_states_update_own
  on public.engine_gamification_states for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
