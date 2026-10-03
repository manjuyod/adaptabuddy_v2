-- Run after local migrations as postgres: psql -v ON_ERROR_STOP=1 -f this_file.sql.
-- All fixtures are rolled back; no existing application rows are changed.
begin;

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');

-- An omitted optional macro must remain unknown, rather than failing the insert.
insert into public.nutrition_food_logs (user_id, food_name, calories, protein_grams)
values ('10000000-0000-4000-8000-000000000001', 'Unknown macros', 100, null);

insert into public.workout_plans (id, user_id, start_date, end_date)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', current_date, current_date);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'health_events', 'xp_events', 'muscle_group_stats', 'workout_plans',
    'workout_days', 'workout_exercises', 'workout_sessions', 'workout_session_exercises'
  ] loop
    if has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') then
      raise exception 'Authenticated clients can mutate server-owned table %', table_name;
    end if;
    if not has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') then
      raise exception 'Owner reads are missing on %', table_name;
    end if;
  end loop;

  begin
    insert into public.workout_days (user_id, workout_plan_id, scheduled_date, name)
    values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', current_date, 'Wrong owner');
    raise exception 'A workout day linked to another user plan';
  exception when foreign_key_violation then null;
  end;
end;
$$;

-- SECURITY DEFINER functions must not restore a write path for anonymous users.
set local role anon;
do $$
begin
  begin
    perform public.complete_session_atomic(
      '10000000-0000-4000-8000-000000000001', null, null, now(), 1, 0,
      null, '{}'::jsonb, '[]'::jsonb, '{"forged":true}'::jsonb
    );
    raise exception 'Anonymous RPC mutated another user session/profile';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('consume_rate_limit', 'purge_expired_rate_limit_counters')
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) then
    raise exception 'Clients can manipulate server rate-limit counters';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
begin
  if exists (select 1 from public.workout_plans where id = '20000000-0000-4000-8000-000000000001') then
    raise exception 'RLS exposed another user workout plan';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  if not exists (select 1 from public.workout_plans where id = '20000000-0000-4000-8000-000000000001') then
    raise exception 'RLS hid the owner workout plan';
  end if;
  begin
    insert into public.xp_events (user_id, amount, reason)
    values ('10000000-0000-4000-8000-000000000001', 100000, 'forged');
    raise exception 'A client minted XP';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
