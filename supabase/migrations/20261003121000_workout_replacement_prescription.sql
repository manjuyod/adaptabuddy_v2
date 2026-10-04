begin;

alter table public.workout_exercises
  add column if not exists prescription jsonb null;

alter table public.workout_exercises
  add constraint workout_exercises_prescription_object_check
  check (prescription is null or jsonb_typeof(prescription) = 'object');

comment on column public.workout_exercises.prescription is
  'Explicit replacement prescription. Its tracking_mode must match the selected catalog exercise.';

commit;
