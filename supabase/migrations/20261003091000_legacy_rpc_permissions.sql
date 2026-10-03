begin;

-- PostgreSQL grants new functions EXECUTE to PUBLIC by default. The imported
-- legacy SECURITY DEFINER routines must not inherit that anonymous RPC access.
revoke execute on function public.complete_session_atomic(
  uuid, integer, integer, timestamptz, integer, numeric, text, jsonb, jsonb,
  jsonb, bigint, bigint, jsonb, jsonb, jsonb, jsonb, text
) from public, anon;
grant execute on function public.complete_session_atomic(
  uuid, integer, integer, timestamptz, integer, numeric, text, jsonb, jsonb,
  jsonb, bigint, bigint, jsonb, jsonb, jsonb, jsonb, text
) to authenticated, service_role;

-- Only the server's admin client may consume or purge abuse-control counters.
revoke execute on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.purge_expired_rate_limit_counters(integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.purge_expired_rate_limit_counters(integer)
  to service_role;

commit;
