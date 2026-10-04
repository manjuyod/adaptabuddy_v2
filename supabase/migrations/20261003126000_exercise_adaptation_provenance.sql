-- Preserve the applied addition migration while making the distinction between
-- a sourced base movement and its support adaptation explicit.
begin;
update public.exercises
set review_status = 'needs_review',
    catalog_notes = 'The source establishes the base movement, contraction, or named variant; the documented posture or equipment adaptation remains flagged for technique review. Anatomy weights are qualitative, and family membership does not assert injury safety or equivalent prescription.'
where slug in ('dumbbell_triceps_kickback', 'seated_dumbbell_lateral_raise');
commit;
