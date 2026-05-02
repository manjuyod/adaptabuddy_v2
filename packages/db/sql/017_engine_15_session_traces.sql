-- Engine 15 app-owned trace persistence for explainability and reporting read models.

begin;

create table if not exists public.engine_session_traces (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('plan_session', 'complete_session')),
  cycle_plan_id bigint references public.engine_cycle_plans(id) on delete set null,
  cycle_session_id bigint references public.engine_cycle_sessions(id) on delete set null,
  workout_log_id bigint references public.workout_logs(id) on delete set null,
  decision_log jsonb not null default '[]'::jsonb,
  replay_receipt jsonb not null default '{}'::jsonb,
  engine_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_engine_session_traces_plan_session_unique
  on public.engine_session_traces (cycle_session_id)
  where operation = 'plan_session' and cycle_session_id is not null;

create unique index if not exists idx_engine_session_traces_complete_workout_unique
  on public.engine_session_traces (workout_log_id)
  where operation = 'complete_session' and workout_log_id is not null;

create index if not exists idx_engine_session_traces_user_created_at
  on public.engine_session_traces (user_id, created_at desc);

alter table public.engine_session_traces enable row level security;

revoke all on public.engine_session_traces from anon, authenticated;
grant select, insert on public.engine_session_traces to authenticated;
grant usage, select on sequence public.engine_session_traces_id_seq to authenticated;

drop policy if exists engine_session_traces_select_own on public.engine_session_traces;
create policy engine_session_traces_select_own
  on public.engine_session_traces for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists engine_session_traces_insert_own on public.engine_session_traces;
create policy engine_session_traces_insert_own
  on public.engine_session_traces for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.complete_session_atomic(
  p_user_id uuid,
  p_program_id integer,
  p_program_day_id integer,
  p_completed_at timestamptz,
  p_duration_seconds integer,
  p_total_volume numeric,
  p_seed text,
  p_metadata jsonb,
  p_set_logs jsonb,
  p_stats_json jsonb,
  p_cycle_plan_id bigint default null,
  p_cycle_session_id bigint default null,
  p_engine_decision_log jsonb default null,
  p_engine_replay_receipt jsonb default null,
  p_engine_result jsonb default null,
  p_idempotency_key text default null
)
returns table (workout_log_id bigint, reused boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_workout_id bigint;
  inserted_workout_id bigint;
begin
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select wl.id
      into existing_workout_id
      from public.workout_logs wl
      where wl.user_id = p_user_id
        and wl.idempotency_key = p_idempotency_key
      limit 1;

    if existing_workout_id is not null then
      return query select existing_workout_id, true;
      return;
    end if;
  end if;

  insert into public.workout_logs (
    user_id,
    program_id,
    program_day_id,
    completed_at,
    duration_seconds,
    total_volume,
    seed,
    metadata,
    idempotency_key
  )
  values (
    p_user_id,
    p_program_id,
    p_program_day_id,
    p_completed_at,
    p_duration_seconds,
    p_total_volume,
    p_seed,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(trim(p_idempotency_key), '')
  )
  returning id into inserted_workout_id;

  if coalesce(jsonb_array_length(coalesce(p_set_logs, '[]'::jsonb)), 0) > 0 then
    insert into public.set_logs (
      workout_log_id,
      exercise_id,
      set_number,
      weight,
      reps,
      rpe,
      rir,
      failed
    )
    select
      inserted_workout_id,
      (entry->>'exercise_id')::integer,
      (entry->>'set_number')::smallint,
      (entry->>'weight')::numeric,
      (entry->>'reps')::smallint,
      case
        when entry ? 'rpe' and entry->>'rpe' is not null
          then (entry->>'rpe')::numeric
        else null
      end,
      case
        when entry ? 'rir' and entry->>'rir' is not null
          then (entry->>'rir')::smallint
        else null
      end,
      coalesce((entry->>'failed')::boolean, false)
    from jsonb_array_elements(coalesce(p_set_logs, '[]'::jsonb)) as entry;
  end if;

  update public.users
    set stats_json = p_stats_json
    where id = p_user_id;

  if not found then
    raise exception 'User not found for completion update: %', p_user_id;
  end if;

  if p_cycle_session_id is not null
    and p_engine_decision_log is not null
    and p_engine_replay_receipt is not null
    and p_engine_result is not null
    and not exists (
      select 1
      from public.engine_session_traces trace
      where trace.operation = 'complete_session'
        and trace.workout_log_id = inserted_workout_id
    )
  then
    insert into public.engine_session_traces (
      user_id,
      operation,
      cycle_plan_id,
      cycle_session_id,
      workout_log_id,
      decision_log,
      replay_receipt,
      engine_result
    )
    values (
      p_user_id,
      'complete_session',
      p_cycle_plan_id,
      p_cycle_session_id,
      inserted_workout_id,
      coalesce(p_engine_decision_log, '[]'::jsonb),
      coalesce(p_engine_replay_receipt, '{}'::jsonb),
      coalesce(p_engine_result, '{}'::jsonb)
    );
  end if;

  return query select inserted_workout_id, false;
end;
$$;

revoke all
  on function public.complete_session_atomic(
    uuid,
    integer,
    integer,
    timestamptz,
    integer,
    numeric,
    text,
    jsonb,
    jsonb,
    jsonb,
    bigint,
    bigint,
    jsonb,
    jsonb,
    jsonb,
    text
  )
  from public;

grant execute
  on function public.complete_session_atomic(
    uuid,
    integer,
    integer,
    timestamptz,
    integer,
    numeric,
    text,
    jsonb,
    jsonb,
    jsonb,
    bigint,
    bigint,
    jsonb,
    jsonb,
    jsonb,
    text
  )
  to authenticated, service_role;

commit;
