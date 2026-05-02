-- Engine 13 class taxonomy cleanup and DB constraints for normalized cycle tables.

begin;

update public.engine_cycle_plans
set resolved_class_archetype = null
where resolved_class_archetype is not null
  and resolved_class_archetype not in ('strength', 'hybrid');

update public.engine_cycle_sessions
set class_archetype = null
where class_archetype is not null
  and class_archetype not in ('strength', 'hybrid');

update public.engine_gamification_states
set class_archetype = null
where class_archetype is not null
  and class_archetype not in ('strength', 'hybrid');

update public.engine_cycle_profiles
set resolved_class_archetype = null
where resolved_class_archetype is not null;

alter table public.engine_cycle_profiles
  drop constraint if exists engine_cycle_profiles_resolved_class_archetype_check;

alter table public.engine_cycle_profiles
  add constraint engine_cycle_profiles_resolved_class_archetype_check
  check (
    resolved_class_archetype is null
    or resolved_class_archetype in ('strength', 'hybrid')
  );

alter table public.engine_cycle_plans
  drop constraint if exists engine_cycle_plans_resolved_class_archetype_check;

alter table public.engine_cycle_plans
  add constraint engine_cycle_plans_resolved_class_archetype_check
  check (
    resolved_class_archetype is null
    or resolved_class_archetype in ('strength', 'hybrid')
  );

alter table public.engine_cycle_sessions
  drop constraint if exists engine_cycle_sessions_class_archetype_check;

alter table public.engine_cycle_sessions
  add constraint engine_cycle_sessions_class_archetype_check
  check (
    class_archetype is null
    or class_archetype in ('strength', 'hybrid')
  );

alter table public.engine_gamification_states
  drop constraint if exists engine_gamification_states_class_archetype_check;

alter table public.engine_gamification_states
  add constraint engine_gamification_states_class_archetype_check
  check (
    class_archetype is null
    or class_archetype in ('strength', 'hybrid')
  );

commit;
