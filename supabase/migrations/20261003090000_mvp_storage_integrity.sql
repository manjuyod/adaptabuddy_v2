begin;

-- The mobile food contract distinguishes unknown macros from measured zero.
alter table public.nutrition_food_logs
  alter column protein_grams drop not null;

-- Parent ownership is part of each relationship, including server-side writes
-- that bypass RLS. Keep the original FK delete behavior for nullable links.
alter table public.habits add constraint habits_id_user_key unique (id, user_id);
alter table public.workout_plans add constraint workout_plans_id_user_key unique (id, user_id);
alter table public.workout_days add constraint workout_days_id_user_key unique (id, user_id);
alter table public.workout_exercises add constraint workout_exercises_id_user_key unique (id, user_id);
alter table public.workout_sessions add constraint workout_sessions_id_user_key unique (id, user_id);

alter table public.habit_check_ins add constraint habit_check_ins_owner_fkey
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade;
alter table public.workout_days add constraint workout_days_owner_fkey
  foreign key (workout_plan_id, user_id) references public.workout_plans (id, user_id) on delete cascade;
alter table public.workout_exercises add constraint workout_exercises_owner_fkey
  foreign key (workout_day_id, user_id) references public.workout_days (id, user_id) on delete cascade;
alter table public.workout_sessions add constraint workout_sessions_owner_fkey
  foreign key (workout_day_id, user_id) references public.workout_days (id, user_id);
alter table public.workout_session_exercises add constraint workout_session_exercises_session_owner_fkey
  foreign key (workout_session_id, user_id) references public.workout_sessions (id, user_id) on delete cascade;
alter table public.workout_session_exercises add constraint workout_session_exercises_exercise_owner_fkey
  foreign key (workout_exercise_id, user_id) references public.workout_exercises (id, user_id);

-- XP, events, generated plans and completion state are Rust-authoritative.
-- Preserve owner reads while removing the direct PostgREST write bypass.
revoke insert, update, delete, truncate, references, trigger
  on public.health_events, public.xp_events, public.muscle_group_stats,
     public.workout_plans, public.workout_days, public.workout_exercises,
     public.workout_sessions, public.workout_session_exercises
  from anon, authenticated, public;

drop policy if exists health_events_owner_insert on public.health_events;
drop policy if exists xp_events_owner_insert on public.xp_events;

drop policy if exists muscle_group_stats_owner_all on public.muscle_group_stats;
create policy muscle_group_stats_owner_select on public.muscle_group_stats
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_plans_owner_all on public.workout_plans;
create policy workout_plans_owner_select on public.workout_plans
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_days_owner_all on public.workout_days;
create policy workout_days_owner_select on public.workout_days
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_exercises_owner_all on public.workout_exercises;
create policy workout_exercises_owner_select on public.workout_exercises
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_sessions_owner_all on public.workout_sessions;
create policy workout_sessions_owner_select on public.workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_session_exercises_owner_all on public.workout_session_exercises;
create policy workout_session_exercises_owner_select on public.workout_session_exercises
  for select to authenticated using ((select auth.uid()) = user_id);

commit;
