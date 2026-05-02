-- 1) Users table keyed to auth.users.id
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,

  -- minimal profile fields (add more later)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- start-screen / save-state flags
  has_save boolean not null default false,           -- your "continue flag"
  preferred_start_screen text not null default 'auto' 
    check (preferred_start_screen in ('auto','start','continue')),

  -- optional: store what they last selected
  last_start_choice text null
    check (last_start_choice in ('start','continue'))
);

-- 2) Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- 3) RLS
alter table public.users enable row level security;

-- Read own row
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
on public.users for select
using (auth.uid() = id);

-- Insert own row (usually done via trigger, but keep policy safe)
drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own"
on public.users for insert
with check (auth.uid() = id);

-- Update own row (lets them flip has_save)
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
on public.users for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- 4) Auto-create user profile row on signup
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
