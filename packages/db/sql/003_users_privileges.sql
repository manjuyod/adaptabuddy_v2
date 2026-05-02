-- Tighten user update privileges to exclude stats_json from client updates.

begin;

-- Remove broad update grants and re-grant allowed columns only.
revoke update on public.users from anon, authenticated;

grant update (has_save, preferred_start_screen, last_start_choice) on public.users to authenticated;

commit;
