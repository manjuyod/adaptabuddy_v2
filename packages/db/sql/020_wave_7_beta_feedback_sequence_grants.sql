-- Wave 7 beta feedback sequence grant tightening.

begin;

revoke all on sequence public.beta_feedback_reports_id_seq from anon;
revoke all on sequence public.beta_feedback_reports_id_seq from public;
grant usage, select on sequence public.beta_feedback_reports_id_seq to authenticated;

commit;
