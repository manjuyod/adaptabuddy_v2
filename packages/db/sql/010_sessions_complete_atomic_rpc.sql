-- Atomic completion RPC for workout + set logs + stats updates with idempotency guard.

begin;

alter table public.workout_logs
  add column if not exists idempotency_key text;

create unique index if not exists idx_workout_logs_user_idempotency
  on public.workout_logs (user_id, idempotency_key)
  where idempotency_key is not null;

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
    text
  )
  to authenticated, service_role;

commit;
