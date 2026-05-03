-- Wave 7: beta feedback reports for support feedback capture.

begin;

create table if not exists public.beta_feedback_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (
    category in ('bug', 'workflow_pain', 'confusing_copy', 'performance', 'other')
  ),
  boundary_area text not null check (
    boundary_area in (
      'app-shell',
      'adapter-contract',
      'persistence-rls',
      'telemetry-read-model',
      'replay-debuggability',
      'deterministic-engine-behavior',
      'product-copy',
      'unknown'
    )
  ),
  severity text not null check (
    severity in ('low', 'medium', 'high', 'critical')
  ),
  status text not null default 'open',
  title text not null,
  summary text not null,
  current_route text,
  request_id text,
  replay_reference jsonb not null default '{}'::jsonb,
  client_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.beta_feedback_reports is
  'Private beta feedback reports from authenticated users for Wave 7 triage.';

comment on column public.beta_feedback_reports.id is
  'Server-issued feedback identifier.';
comment on column public.beta_feedback_reports.user_id is
  'Report author; must own row by auth.uid().';
comment on column public.beta_feedback_reports.category is
  'High-level category for feedback taxonomy.';
comment on column public.beta_feedback_reports.boundary_area is
  'Ownership and fault-boundary annotation for routing.';
comment on column public.beta_feedback_reports.severity is
  'User-reported impact estimate.';
comment on column public.beta_feedback_reports.status is
  'Mutable workflow status for triage processing.';
comment on column public.beta_feedback_reports.title is
  'Short user-facing title.';
comment on column public.beta_feedback_reports.summary is
  'Detailed user-facing summary.';
comment on column public.beta_feedback_reports.current_route is
  'Optional route context for reproduction.';
comment on column public.beta_feedback_reports.request_id is
  'Optional request correlation id.';
comment on column public.beta_feedback_reports.replay_reference is
  'Optional replay/debug trace reference payload.';
comment on column public.beta_feedback_reports.client_context is
  'Sanitized non-sensitive client diagnostics context.';

create index if not exists idx_beta_feedback_reports_user_created_at
  on public.beta_feedback_reports (user_id, created_at desc);
create index if not exists idx_beta_feedback_reports_status
  on public.beta_feedback_reports (status);

alter table public.beta_feedback_reports enable row level security;

revoke all on public.beta_feedback_reports from anon, authenticated;
grant select, insert on public.beta_feedback_reports to authenticated;
grant usage, select on sequence public.beta_feedback_reports_id_seq to authenticated;

drop policy if exists beta_feedback_reports_select_own on public.beta_feedback_reports;
create policy beta_feedback_reports_select_own
  on public.beta_feedback_reports for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists beta_feedback_reports_insert_own on public.beta_feedback_reports;
create policy beta_feedback_reports_insert_own
  on public.beta_feedback_reports for insert to authenticated
  with check ((select auth.uid()) = user_id);

commit;
