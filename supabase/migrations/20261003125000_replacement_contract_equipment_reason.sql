-- Clarify the exception after source review selected the unsupported
-- bent-over barbell variation as the third gym retraction option.
begin;
update public.exercise_replacement_coverage_requirements
set reason = 'The curated loaded retraction variants require cable, barbell, or a chest-supported incline/row setup; this home inventory lacks those setups.'
where category = 'strength'
  and replacement_family = 'scapular_retraction'
  and expectation = 'unsupported_equipment';
commit;
