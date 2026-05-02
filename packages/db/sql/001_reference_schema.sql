-- Idempotent reference schema alignment for Adaptabuddy_v2.
-- Safe to re-run; avoids destructive changes and only tightens NOT NULL when data allows.

begin;

-- ============================================================================
-- Users: stats_json (user state container)
-- ============================================================================
alter table public.users
  add column if not exists stats_json jsonb not null default '{}'::jsonb;

-- ============================================================================
-- Muscle Groups
-- ============================================================================
create table if not exists public.muscle_groups (
  id serial primary key,
  slug text not null,
  name text not null
);

alter table public.muscle_groups
  add column if not exists slug text,
  add column if not exists name text;

alter table public.muscle_groups
  alter column slug set default null,
  alter column name set default null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'muscle_groups' and column_name = 'slug'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.muscle_groups where slug is null)
  then
    alter table public.muscle_groups alter column slug set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'muscle_groups' and column_name = 'name'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.muscle_groups where name is null)
  then
    alter table public.muscle_groups alter column name set not null;
  end if;
end $$;

create unique index if not exists muscle_groups_slug_key on public.muscle_groups (slug);

-- ============================================================================
-- Exercises
-- ============================================================================
create table if not exists public.exercises (
  id serial primary key,
  slug text not null,
  name text not null,
  movement_pattern text not null,
  equipment jsonb not null default '[]'::jsonb,
  is_bodyweight boolean not null default false,
  aliases jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  media jsonb not null default '{}'::jsonb,
  contraindications jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.exercises
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists movement_pattern text,
  add column if not exists equipment jsonb,
  add column if not exists is_bodyweight boolean,
  add column if not exists aliases jsonb,
  add column if not exists tags jsonb,
  add column if not exists media jsonb,
  add column if not exists contraindications jsonb,
  add column if not exists is_active boolean,
  add column if not exists created_at timestamptz;

alter table public.exercises
  alter column equipment set default '[]'::jsonb,
  alter column is_bodyweight set default false,
  alter column aliases set default '[]'::jsonb,
  alter column tags set default '[]'::jsonb,
  alter column media set default '{}'::jsonb,
  alter column contraindications set default '[]'::jsonb,
  alter column is_active set default true,
  alter column created_at set default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exercises' and column_name = 'slug'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.exercises where slug is null)
  then
    alter table public.exercises alter column slug set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exercises' and column_name = 'name'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.exercises where name is null)
  then
    alter table public.exercises alter column name set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exercises' and column_name = 'movement_pattern'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.exercises where movement_pattern is null)
  then
    alter table public.exercises alter column movement_pattern set not null;
  end if;
end $$;

create unique index if not exists exercises_slug_key on public.exercises (slug);
create index if not exists exercises_tags_gin on public.exercises using gin (tags);
create index if not exists exercises_equipment_gin on public.exercises using gin (equipment);

-- ============================================================================
-- Exercise-Muscle Map
-- ============================================================================
create table if not exists public.exercise_muscle_map (
  exercise_id int not null,
  muscle_group_id int not null,
  role text not null default 'primary',
  contribution numeric(4,3) not null default 1.0
);

alter table public.exercise_muscle_map
  add column if not exists exercise_id int,
  add column if not exists muscle_group_id int,
  add column if not exists role text,
  add column if not exists contribution numeric(4,3);

alter table public.exercise_muscle_map
  alter column role set default 'primary',
  alter column contribution set default 1.0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'exercise_muscle_map'
      and c.contype = 'p'
  )
  then
    alter table public.exercise_muscle_map
      add constraint exercise_muscle_map_pkey primary key (exercise_id, muscle_group_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'exercise_muscle_map'
      and c.contype = 'f'
      and c.confrelid = 'public.exercises'::regclass
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'exercise_id')
      ]
  )
  then
    alter table public.exercise_muscle_map
      add constraint exercise_muscle_map_exercise_id_fkey
      foreign key (exercise_id) references public.exercises(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'exercise_muscle_map'
      and c.contype = 'f'
      and c.confrelid = 'public.muscle_groups'::regclass
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'muscle_group_id')
      ]
  )
  then
    alter table public.exercise_muscle_map
      add constraint exercise_muscle_map_muscle_group_id_fkey
      foreign key (muscle_group_id) references public.muscle_groups(id) on delete cascade;
  end if;
end $$;

create index if not exists exercise_muscle_map_muscle_group_id_idx
  on public.exercise_muscle_map (muscle_group_id);

-- ============================================================================
-- Programs
-- ============================================================================
create table if not exists public.programs (
  id serial primary key,
  slug text not null,
  name text not null,
  program_type text not null default 'hybrid',
  min_days_per_week smallint not null default 3,
  max_days_per_week smallint not null default 6,
  default_days_per_week smallint not null default 4,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.programs
  add column if not exists slug text,
  add column if not exists name text,
  add column if not exists program_type text,
  add column if not exists min_days_per_week smallint,
  add column if not exists max_days_per_week smallint,
  add column if not exists default_days_per_week smallint,
  add column if not exists description text,
  add column if not exists metadata jsonb,
  add column if not exists is_active boolean,
  add column if not exists created_at timestamptz;

alter table public.programs
  alter column program_type set default 'hybrid',
  alter column min_days_per_week set default 3,
  alter column max_days_per_week set default 6,
  alter column default_days_per_week set default 4,
  alter column metadata set default '{}'::jsonb,
  alter column is_active set default true,
  alter column created_at set default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'programs' and column_name = 'slug'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.programs where slug is null)
  then
    alter table public.programs alter column slug set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'programs' and column_name = 'name'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.programs where name is null)
  then
    alter table public.programs alter column name set not null;
  end if;
end $$;

create unique index if not exists programs_slug_key on public.programs (slug);

-- ============================================================================
-- Program Days
-- ============================================================================
create table if not exists public.program_days (
  id serial primary key,
  program_id int not null references public.programs(id) on delete cascade,
  day_index smallint not null,
  name text not null,
  theme_tags jsonb not null default '[]'::jsonb
);

alter table public.program_days
  add column if not exists program_id int,
  add column if not exists day_index smallint,
  add column if not exists name text,
  add column if not exists theme_tags jsonb;

alter table public.program_days
  alter column theme_tags set default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'program_days'
      and c.contype = 'f'
      and c.confrelid = 'public.programs'::regclass
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'program_id')
      ]
  )
  then
    alter table public.program_days
      add constraint program_days_program_id_fkey
      foreign key (program_id) references public.programs(id) on delete cascade;
  end if;
end $$;

create unique index if not exists program_days_program_id_day_index_key
  on public.program_days (program_id, day_index);

-- ============================================================================
-- Program Slots
-- ============================================================================
create table if not exists public.program_slots (
  id serial primary key,
  program_day_id int not null references public.program_days(id) on delete cascade,
  slot_index smallint not null,
  slot_type text not null default 'accessory',
  lock_type text not null default 'flex',
  locked_exercise_id int null references public.exercises(id),
  movement_pattern text null,
  equipment_allowed jsonb not null default '[]'::jsonb,
  tags_required jsonb not null default '[]'::jsonb,
  tags_blocked jsonb not null default '[]'::jsonb,
  sets_min smallint not null default 2,
  sets_max smallint not null default 4,
  reps_min smallint not null default 6,
  reps_max smallint not null default 12,
  rir_min smallint null,
  rir_max smallint null,
  muscle_targets jsonb not null default '{}'::jsonb,
  prescription jsonb not null default '{}'::jsonb,
  is_optional boolean not null default false
);

alter table public.program_slots
  add column if not exists program_day_id int,
  add column if not exists slot_index smallint,
  add column if not exists slot_type text,
  add column if not exists lock_type text,
  add column if not exists locked_exercise_id int,
  add column if not exists movement_pattern text,
  add column if not exists equipment_allowed jsonb,
  add column if not exists tags_required jsonb,
  add column if not exists tags_blocked jsonb,
  add column if not exists sets_min smallint,
  add column if not exists sets_max smallint,
  add column if not exists reps_min smallint,
  add column if not exists reps_max smallint,
  add column if not exists rir_min smallint,
  add column if not exists rir_max smallint,
  add column if not exists muscle_targets jsonb,
  add column if not exists prescription jsonb,
  add column if not exists is_optional boolean;

alter table public.program_slots
  alter column slot_type set default 'accessory',
  alter column lock_type set default 'flex',
  alter column equipment_allowed set default '[]'::jsonb,
  alter column tags_required set default '[]'::jsonb,
  alter column tags_blocked set default '[]'::jsonb,
  alter column sets_min set default 2,
  alter column sets_max set default 4,
  alter column reps_min set default 6,
  alter column reps_max set default 12,
  alter column muscle_targets set default '{}'::jsonb,
  alter column prescription set default '{}'::jsonb,
  alter column is_optional set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'program_slots'
      and c.contype = 'f'
      and c.confrelid = 'public.program_days'::regclass
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'program_day_id')
      ]
  )
  then
    alter table public.program_slots
      add constraint program_slots_program_day_id_fkey
      foreign key (program_day_id) references public.program_days(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'program_slots'
      and c.contype = 'f'
      and c.confrelid = 'public.exercises'::regclass
      and c.conkey = array[
        (select attnum from pg_attribute where attrelid = t.oid and attname = 'locked_exercise_id')
      ]
  )
  then
    alter table public.program_slots
      add constraint program_slots_locked_exercise_id_fkey
      foreign key (locked_exercise_id) references public.exercises(id);
  end if;
end $$;

create unique index if not exists program_slots_program_day_id_slot_index_key
  on public.program_slots (program_day_id, slot_index);

commit;
