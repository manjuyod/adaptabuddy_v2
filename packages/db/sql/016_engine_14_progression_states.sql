-- Add normalized per-exercise progression state for Engine 14.

begin;

create table if not exists public.engine_progression_states (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint not null references public.engine_cycle_plans(id) on delete cascade,
  exercise_id text not null,
  current_action text not null,
  trend text not null,
  last_successful_load_weight numeric,
  last_successful_load_reps integer,
  consecutive_successful_completions integer not null default 0,
  consecutive_stall_or_regression_count integer not null default 0,
  swap_recommendation_count integer not null default 0,
  last_session_outcome_classification text not null,
  last_completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engine_progression_states_plan_exercise_key unique (plan_id, exercise_id)
);

create index if not exists idx_engine_progression_states_plan
  on public.engine_progression_states (plan_id, exercise_id);

alter table public.engine_progression_states enable row level security;

revoke all on public.engine_progression_states from anon, authenticated;
grant select, insert, update, delete on public.engine_progression_states to authenticated;
grant usage, select on sequence public.engine_progression_states_id_seq to authenticated;

drop policy if exists engine_progression_states_select_own on public.engine_progression_states;
create policy engine_progression_states_select_own
  on public.engine_progression_states for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_progression_states_insert_own on public.engine_progression_states;
create policy engine_progression_states_insert_own
  on public.engine_progression_states for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_progression_states_update_own on public.engine_progression_states;
create policy engine_progression_states_update_own
  on public.engine_progression_states for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists engine_progression_states_delete_own on public.engine_progression_states;
create policy engine_progression_states_delete_own
  on public.engine_progression_states for delete to authenticated
  using ((select auth.uid()) = user_id);

commit;
