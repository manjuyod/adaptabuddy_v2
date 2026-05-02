-- Reference table RLS: authenticated SELECT-only, no client-side writes.
-- Also locks down users.stats_json from direct client updates.

begin;

-- ============================================================================
-- Reference tables: RLS + privileges
-- ============================================================================
alter table public.exercises enable row level security;
alter table public.muscle_groups enable row level security;
alter table public.exercise_muscle_map enable row level security;
alter table public.programs enable row level security;
alter table public.program_days enable row level security;
alter table public.program_slots enable row level security;

-- Explicit privileges: read-only for authenticated, no access for anon.
revoke all on public.exercises from anon, authenticated;
revoke all on public.muscle_groups from anon, authenticated;
revoke all on public.exercise_muscle_map from anon, authenticated;
revoke all on public.programs from anon, authenticated;
revoke all on public.program_days from anon, authenticated;
revoke all on public.program_slots from anon, authenticated;

grant select on public.exercises to authenticated;
grant select on public.muscle_groups to authenticated;
grant select on public.exercise_muscle_map to authenticated;
grant select on public.programs to authenticated;
grant select on public.program_days to authenticated;
grant select on public.program_slots to authenticated;

-- Policies: SELECT-only for authenticated.
drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated
  on public.exercises for select to authenticated
  using (true);

drop policy if exists muscle_groups_select_authenticated on public.muscle_groups;
create policy muscle_groups_select_authenticated
  on public.muscle_groups for select to authenticated
  using (true);

drop policy if exists exercise_muscle_map_select_authenticated on public.exercise_muscle_map;
create policy exercise_muscle_map_select_authenticated
  on public.exercise_muscle_map for select to authenticated
  using (true);

drop policy if exists programs_select_authenticated on public.programs;
create policy programs_select_authenticated
  on public.programs for select to authenticated
  using (true);

drop policy if exists program_days_select_authenticated on public.program_days;
create policy program_days_select_authenticated
  on public.program_days for select to authenticated
  using (true);

drop policy if exists program_slots_select_authenticated on public.program_slots;
create policy program_slots_select_authenticated
  on public.program_slots for select to authenticated
  using (true);

-- ============================================================================
-- Users: prevent direct client updates to stats_json
-- ============================================================================
revoke update (stats_json) on public.users from authenticated;

commit;
