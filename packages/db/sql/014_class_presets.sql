-- Add class preset catalog and persist the selected preset on normalized cycle state.

begin;

create table if not exists public.classes (
  id text primary key,
  display_name text not null,
  description text not null,
  sort_order integer not null,
  is_selectable boolean not null default true,
  status text not null,
  base_archetype text not null
);

insert into public.classes (
  id,
  display_name,
  description,
  sort_order,
  is_selectable,
  status,
  base_archetype
)
values
  ('classless', 'Classless', 'Neutral baseline with no preset-specific bias.', 1, true, 'active', 'hybrid'),
  ('bb', 'BB', 'Bias accessory work while limiting sessions to one main slot.', 2, true, 'active', 'hybrid'),
  ('powa', 'POWA', 'Bias compound work and lower rep ranges for main compound slots.', 3, true, 'active', 'strength'),
  ('ninja', 'Ninja', 'Restrict planning to bodyweight-compatible exercise paths.', 4, true, 'active', 'hybrid'),
  ('monk', 'Monk', 'Reserved future preset for explosive athlete-oriented work.', 5, false, 'planned', 'hybrid')
on conflict (id) do update
set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_selectable = excluded.is_selectable,
  status = excluded.status,
  base_archetype = excluded.base_archetype;

alter table public.classes enable row level security;

revoke all on public.classes from anon, authenticated;
grant select on public.classes to authenticated;

drop policy if exists classes_select_authenticated on public.classes;
create policy classes_select_authenticated
  on public.classes for select to authenticated
  using (true);

alter table public.engine_cycle_profiles
  add column if not exists class_preset_id text;

alter table public.engine_cycle_plans
  add column if not exists class_preset_id text;

update public.engine_cycle_profiles
set class_preset_id = 'classless'
where class_preset_id is null;

update public.engine_cycle_plans
set class_preset_id = 'classless'
where class_preset_id is null;

alter table public.engine_cycle_profiles
  alter column class_preset_id set default 'classless';

alter table public.engine_cycle_plans
  alter column class_preset_id set default 'classless';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'engine_cycle_profiles'
      and column_name = 'class_preset_id'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.engine_cycle_profiles where class_preset_id is null)
  then
    alter table public.engine_cycle_profiles alter column class_preset_id set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'engine_cycle_plans'
      and column_name = 'class_preset_id'
      and is_nullable = 'YES'
  )
  and not exists (select 1 from public.engine_cycle_plans where class_preset_id is null)
  then
    alter table public.engine_cycle_plans alter column class_preset_id set not null;
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
      and t.relname = 'engine_cycle_profiles'
      and c.conname = 'engine_cycle_profiles_class_preset_id_fkey'
  )
  then
    alter table public.engine_cycle_profiles
      add constraint engine_cycle_profiles_class_preset_id_fkey
      foreign key (class_preset_id) references public.classes(id);
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
      and t.relname = 'engine_cycle_plans'
      and c.conname = 'engine_cycle_plans_class_preset_id_fkey'
  )
  then
    alter table public.engine_cycle_plans
      add constraint engine_cycle_plans_class_preset_id_fkey
      foreign key (class_preset_id) references public.classes(id);
  end if;
end $$;

create index if not exists idx_engine_cycle_profiles_class_preset_id
  on public.engine_cycle_profiles (class_preset_id);

create index if not exists idx_engine_cycle_plans_class_preset_id
  on public.engine_cycle_plans (class_preset_id);

commit;
