-- Distributed, database-backed rate limiting primitives.

begin;

create table if not exists public.rate_limit_counters (
  key text primary key,
  request_count integer not null,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rate_limit_counters_reset_at
  on public.rate_limit_counters (reset_at);

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (success boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  next_reset timestamptz := now_ts + make_interval(secs => greatest(p_window_ms, 1)::numeric / 1000);
  counter_key text := left(coalesce(trim(p_key), ''), 200);
  counter_row public.rate_limit_counters%rowtype;
begin
  if counter_key = '' then
    raise exception 'rate limit key is required';
  end if;

  if p_limit <= 0 then
    raise exception 'rate limit must be > 0';
  end if;

  if p_window_ms <= 0 then
    raise exception 'rate limit window must be > 0';
  end if;

  select *
    into counter_row
    from public.rate_limit_counters
    where key = counter_key
    for update;

  if not found then
    insert into public.rate_limit_counters (key, request_count, reset_at, created_at, updated_at)
    values (counter_key, 1, next_reset, now_ts, now_ts);

    return query select true, greatest(p_limit - 1, 0), next_reset;
    return;
  end if;

  if counter_row.reset_at <= now_ts then
    update public.rate_limit_counters
      set request_count = 1,
          reset_at = next_reset,
          updated_at = now_ts
      where key = counter_key;

    return query select true, greatest(p_limit - 1, 0), next_reset;
    return;
  end if;

  if counter_row.request_count >= p_limit then
    return query select false, 0, counter_row.reset_at;
    return;
  end if;

  update public.rate_limit_counters
    set request_count = request_count + 1,
        updated_at = now_ts
    where key = counter_key
    returning * into counter_row;

  return query select true, greatest(p_limit - counter_row.request_count, 0), counter_row.reset_at;
end;
$$;

create or replace function public.purge_expired_rate_limit_counters(
  p_older_than_hours integer default 6
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.rate_limit_counters
   where reset_at < now() - make_interval(hours => greatest(p_older_than_hours, 1));

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on public.rate_limit_counters from anon, authenticated;

grant execute on function public.consume_rate_limit(text, integer, integer)
  to authenticated, service_role;

grant execute on function public.purge_expired_rate_limit_counters(integer)
  to service_role;

commit;
