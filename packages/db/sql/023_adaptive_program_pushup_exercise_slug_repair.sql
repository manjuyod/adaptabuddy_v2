-- Repair push-up challenge adaptive metadata after 022 normalized family fields.

begin;

update public.programs
set metadata = jsonb_set(
  metadata,
  '{source_template_json,exercise,slug}',
  '"push_up"'::jsonb,
  true
)
where slug = '100_push_ups_challenge_3_group_6_week';

commit;
