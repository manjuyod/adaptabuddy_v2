-- Prepare normalized gamification storage for the Engine 14 richer state.

begin;

alter table public.engine_gamification_states
  add column if not exists completed_session_count integer not null default 0;

alter table public.engine_gamification_states
  add column if not exists missed_session_count integer not null default 0;

alter table public.engine_gamification_states
  add column if not exists last_adherence_outcome_classification text;

alter table public.engine_gamification_states
  add column if not exists last_awarded_at timestamptz;

update public.engine_gamification_states
set completed_session_count = 0
where completed_session_count is null;

update public.engine_gamification_states
set missed_session_count = 0
where missed_session_count is null;

commit;
