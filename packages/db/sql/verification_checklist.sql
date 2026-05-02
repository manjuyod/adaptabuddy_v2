-- Verification checklist for reference schema + RLS alignment

-- 1) Table existence
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'exercises',
    'muscle_groups',
    'exercise_muscle_map',
    'programs',
    'program_days',
    'program_slots',
    'users'
  )
order by tablename;

-- 2) Column shape (spot-check critical defaults)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'exercises',
    'muscle_groups',
    'exercise_muscle_map',
    'programs',
    'program_days',
    'program_slots',
    'users'
  )
order by table_name, ordinal_position;

-- 3) RLS enabled
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'exercises',
    'muscle_groups',
    'exercise_muscle_map',
    'programs',
    'program_days',
    'program_slots',
    'users'
  )
order by c.relname;

-- 4) Policies
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'exercises',
    'muscle_groups',
    'exercise_muscle_map',
    'programs',
    'program_days',
    'program_slots',
    'users'
  )
order by tablename, policyname;

-- 5) Indexes (GIN + FK helpers)
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and (
    indexname in (
      'exercises_tags_gin',
      'exercises_equipment_gin',
      'exercise_muscle_map_muscle_group_id_idx',
      'program_days_program_id_day_index_key',
      'program_slots_program_day_id_slot_index_key',
      'exercises_slug_key',
      'muscle_groups_slug_key',
      'programs_slug_key'
    )
  )
order by tablename, indexname;

-- 6) Orphan checks
select count(*) as missing_exercise_fk
from public.exercise_muscle_map emm
left join public.exercises e on e.id = emm.exercise_id
where e.id is null;

select count(*) as missing_muscle_group_fk
from public.exercise_muscle_map emm
left join public.muscle_groups mg on mg.id = emm.muscle_group_id
where mg.id is null;

select count(*) as missing_program_fk
from public.program_days pd
left join public.programs p on p.id = pd.program_id
where p.id is null;

select count(*) as missing_program_day_fk
from public.program_slots ps
left join public.program_days pd on pd.id = ps.program_day_id
where pd.id is null;

-- 7) Privileges (authenticated should have SELECT only on reference tables)
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'exercises',
    'muscle_groups',
    'exercise_muscle_map',
    'programs',
    'program_days',
    'program_slots'
  )
order by table_name, grantee, privilege_type;
