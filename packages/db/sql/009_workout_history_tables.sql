-- Add queryable workout history tables with RLS-scoped access.

begin;

create table if not exists public.workout_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id integer references public.programs(id) on delete set null,
  program_day_id integer references public.program_days(id) on delete set null,
  completed_at timestamptz not null default now(),
  duration_seconds integer,
  total_volume numeric,
  seed text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.set_logs (
  id bigint generated always as identity primary key,
  workout_log_id bigint not null references public.workout_logs(id) on delete cascade,
  exercise_id integer not null references public.exercises(id),
  set_number smallint not null,
  weight numeric not null,
  reps smallint not null,
  rpe numeric,
  rir smallint,
  failed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_logs_user_date
  on public.workout_logs (user_id, completed_at desc);

create index if not exists idx_set_logs_workout
  on public.set_logs (workout_log_id);

alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;

revoke all on public.workout_logs from anon, authenticated;
revoke all on public.set_logs from anon, authenticated;
grant select, insert on public.workout_logs to authenticated;
grant select, insert on public.set_logs to authenticated;
grant usage, select on sequence public.workout_logs_id_seq to authenticated;
grant usage, select on sequence public.set_logs_id_seq to authenticated;

drop policy if exists workout_logs_select_own on public.workout_logs;
create policy workout_logs_select_own
  on public.workout_logs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists workout_logs_insert_own on public.workout_logs;
create policy workout_logs_insert_own
  on public.workout_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists set_logs_select_own on public.set_logs;
create policy set_logs_select_own
  on public.set_logs for select to authenticated
  using (
    exists (
      select 1
      from public.workout_logs wl
      where wl.id = set_logs.workout_log_id
        and wl.user_id = (select auth.uid())
    )
  );

drop policy if exists set_logs_insert_own on public.set_logs;
create policy set_logs_insert_own
  on public.set_logs for insert to authenticated
  with check (
    exists (
      select 1
      from public.workout_logs wl
      where wl.id = set_logs.workout_log_id
        and wl.user_id = (select auth.uid())
    )
  );

commit;
