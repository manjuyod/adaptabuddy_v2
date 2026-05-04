-- Wave 9 app-owned Season Loop persistence for summaries, awards, and transitions.

begin;

alter table public.engine_session_traces
  drop constraint if exists engine_session_traces_operation_check;

alter table public.engine_session_traces
  add constraint engine_session_traces_operation_check
  check (operation in ('plan_session', 'complete_session', 'advance_cycle'));

create table if not exists public.engine_cycle_season_summaries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint not null references public.engine_cycle_plans(id) on delete cascade,
  season_index integer not null,
  season_rank text not null check (season_rank in ('S', 'A', 'B', 'C', 'D')),
  rank_breakdown jsonb not null default '{}'::jsonb,
  summary_payload jsonb not null default '{}'::jsonb,
  completed_sessions integer not null default 0,
  missed_sessions integer not null default 0,
  total_sessions integer not null default 0,
  completion_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint engine_cycle_season_summaries_plan_season_key unique (plan_id, season_index)
);

create table if not exists public.engine_cycle_season_awards (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint not null references public.engine_cycle_plans(id) on delete cascade,
  season_summary_id bigint not null references public.engine_cycle_season_summaries(id) on delete cascade,
  award_id text not null,
  label text not null,
  reason text not null,
  xp integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.engine_cycle_transitions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id bigint not null references public.engine_cycle_plans(id) on delete cascade,
  season_summary_id bigint not null references public.engine_cycle_season_summaries(id) on delete cascade,
  season_index integer not null,
  season_rank text not null check (season_rank in ('S', 'A', 'B', 'C', 'D')),
  awarded_xp integer not null default 0,
  next_cycle_request jsonb not null default '{}'::jsonb,
  next_cycle_preview jsonb not null default '{}'::jsonb,
  replay_receipt jsonb not null default '{}'::jsonb,
  decision_log jsonb not null default '[]'::jsonb,
  engine_result jsonb not null default '{}'::jsonb,
  state_patch jsonb not null default '{}'::jsonb,
  status text not null default 'recommended'
    check (status in ('recommended', 'applied', 'dismissed')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint engine_cycle_transitions_plan_season_key unique (plan_id, season_index)
);

create unique index if not exists idx_engine_cycle_transitions_idempotency
  on public.engine_cycle_transitions (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_engine_cycle_season_summaries_user_created
  on public.engine_cycle_season_summaries (user_id, created_at desc);

create index if not exists idx_engine_cycle_season_awards_summary
  on public.engine_cycle_season_awards (season_summary_id);

create index if not exists idx_engine_cycle_transitions_user_created
  on public.engine_cycle_transitions (user_id, created_at desc);

alter table public.engine_cycle_season_summaries enable row level security;
alter table public.engine_cycle_season_awards enable row level security;
alter table public.engine_cycle_transitions enable row level security;

revoke all on public.engine_cycle_season_summaries from anon, authenticated;
revoke all on public.engine_cycle_season_awards from anon, authenticated;
revoke all on public.engine_cycle_transitions from anon, authenticated;

grant select on public.engine_cycle_season_summaries to authenticated;
grant select on public.engine_cycle_season_awards to authenticated;
grant select on public.engine_cycle_transitions to authenticated;

drop policy if exists engine_cycle_season_summaries_select_own on public.engine_cycle_season_summaries;
create policy engine_cycle_season_summaries_select_own
  on public.engine_cycle_season_summaries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_season_summaries_insert_own on public.engine_cycle_season_summaries;

drop policy if exists engine_cycle_season_awards_select_own on public.engine_cycle_season_awards;
create policy engine_cycle_season_awards_select_own
  on public.engine_cycle_season_awards for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_season_awards_insert_own on public.engine_cycle_season_awards;

drop policy if exists engine_cycle_transitions_select_own on public.engine_cycle_transitions;
create policy engine_cycle_transitions_select_own
  on public.engine_cycle_transitions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_cycle_transitions_insert_own on public.engine_cycle_transitions;

drop policy if exists engine_cycle_transitions_update_own on public.engine_cycle_transitions;

commit;
