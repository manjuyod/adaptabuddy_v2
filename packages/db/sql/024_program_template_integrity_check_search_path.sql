-- Harden adaptive program integrity check function search_path.

begin;

alter function public.program_template_integrity_check()
  set search_path = public, pg_temp;

commit;
