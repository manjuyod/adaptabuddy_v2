begin;

-- These fields separate an exercise's training discipline from its movement
-- pattern and describe how a client should record completion. Existing rows
-- receive conservative defaults; the catalog data migration classifies them.
alter table public.exercises
  add column category text not null default 'strength',
  add column tracking_mode text not null default 'reps',
  add column instructions jsonb not null default '[]'::jsonb,
  add column source_urls jsonb not null default '[]'::jsonb,
  add column review_status text not null default 'needs_review',
  add column catalog_notes text;

alter table public.exercises
  add constraint exercises_category_check
    check (category in (
      'strength', 'stretching', 'pilates', 'cardio', 'mobility', 'balance', 'recovery'
    )),
  add constraint exercises_tracking_mode_check
    check (tracking_mode in (
      'reps', 'reps_each_side', 'duration', 'duration_each_side', 'duration_distance'
    )),
  add constraint exercises_instructions_string_array_check
    check (
      jsonb_typeof(instructions) = 'array'
      and not jsonb_path_exists(instructions, 'strict $[*] ? (@.type() != "string")')
    ),
  add constraint exercises_source_urls_string_array_check
    check (
      jsonb_typeof(source_urls) = 'array'
      and not jsonb_path_exists(source_urls, 'strict $[*] ? (@.type() != "string")')
    ),
  add constraint exercises_review_status_check
    check (review_status in ('needs_review', 'reviewed'));

-- Legacy JSON shape checks are introduced without scanning the imported
-- catalog. The following catalog migration repairs legacy rows and validates
-- these constraints. Even while NOT VALID, PostgreSQL enforces them for new
-- and updated rows.
alter table public.exercises
  add constraint exercises_equipment_string_array_check
    check (
      jsonb_typeof(equipment) = 'array'
      and not jsonb_path_exists(equipment, 'strict $[*] ? (@.type() != "string")')
    ) not valid,
  add constraint exercises_aliases_string_array_check
    check (
      jsonb_typeof(aliases) = 'array'
      and not jsonb_path_exists(aliases, 'strict $[*] ? (@.type() != "string")')
    ) not valid,
  add constraint exercises_tags_string_array_check
    check (
      jsonb_typeof(tags) = 'array'
      and not jsonb_path_exists(tags, 'strict $[*] ? (@.type() != "string")')
    ) not valid,
  add constraint exercises_media_object_check
    check (jsonb_typeof(media) = 'object') not valid,
  add constraint exercises_contraindications_array_check
    check (jsonb_typeof(contraindications) = 'array') not valid;

comment on column public.exercises.category is
  'Training discipline used for catalog browsing; independent of movement_pattern.';
comment on column public.exercises.tracking_mode is
  'How a completed exercise is recorded by clients.';
comment on column public.exercises.instructions is
  'Ordered coaching instructions as a JSON array of strings.';
comment on column public.exercises.source_urls is
  'Source references used to review catalog content, as a JSON array of strings.';
comment on column public.exercises.review_status is
  'Editorial review state for the exercise catalog entry.';
comment on column public.exercises.catalog_notes is
  'Public client-readable catalog review notes; no confidential editorial data. Not coaching instructions.';

create index exercises_active_category_name_id_idx
  on public.exercises (category, name, id)
  where is_active;

-- Contributions are intentionally heuristic rather than normalized weights.
-- Strength mappings use positive values for relative volume attribution;
-- qualitative targets for non-strength disciplines may use zero.
alter table public.exercise_muscle_map
  add constraint exercise_muscle_map_role_check
    check (role in ('primary', 'secondary', 'stabilizer')) not valid,
  add constraint exercise_muscle_map_contribution_check
    check (contribution >= 0 and contribution <= 1) not valid;

comment on column public.exercise_muscle_map.contribution is
  'Heuristic relative contribution in [0,1]; zero denotes a qualitative non-strength target.';

-- Program-template checks protect generator assumptions while leaving
-- movement_pattern open for future exercise disciplines.
alter table public.programs
  add constraint programs_days_per_week_check
    check (
      min_days_per_week between 1 and 7
      and max_days_per_week between 1 and 7
      and min_days_per_week <= default_days_per_week
      and default_days_per_week <= max_days_per_week
    ) not valid,
  add constraint programs_metadata_object_check
    check (jsonb_typeof(metadata) = 'object') not valid;

alter table public.program_days
  add constraint program_days_day_index_check
    check (day_index >= 0) not valid,
  add constraint program_days_theme_tags_string_array_check
    check (
      jsonb_typeof(theme_tags) = 'array'
      and not jsonb_path_exists(theme_tags, 'strict $[*] ? (@.type() != "string")')
    ) not valid;

alter table public.program_slots
  add constraint program_slots_slot_index_check
    check (slot_index >= 0) not valid,
  add constraint program_slots_lock_type_check
    check (lock_type in ('flex', 'locked')) not valid,
  add constraint program_slots_lock_consistency_check
    check ((lock_type = 'locked') = (locked_exercise_id is not null)) not valid,
  add constraint program_slots_set_range_check
    check (sets_min > 0 and sets_min <= sets_max) not valid,
  add constraint program_slots_rep_range_check
    check (reps_min > 0 and reps_min <= reps_max) not valid,
  add constraint program_slots_rir_range_check
    check (
      (rir_min is null or rir_min between 0 and 10)
      and (rir_max is null or rir_max between 0 and 10)
      and (rir_min is null or rir_max is null or rir_min <= rir_max)
    ) not valid,
  add constraint program_slots_equipment_allowed_string_array_check
    check (
      jsonb_typeof(equipment_allowed) = 'array'
      and not jsonb_path_exists(equipment_allowed, 'strict $[*] ? (@.type() != "string")')
    ) not valid,
  add constraint program_slots_tags_required_string_array_check
    check (
      jsonb_typeof(tags_required) = 'array'
      and not jsonb_path_exists(tags_required, 'strict $[*] ? (@.type() != "string")')
    ) not valid,
  add constraint program_slots_tags_blocked_string_array_check
    check (
      jsonb_typeof(tags_blocked) = 'array'
      and not jsonb_path_exists(tags_blocked, 'strict $[*] ? (@.type() != "string")')
    ) not valid,
  add constraint program_slots_muscle_targets_object_check
    check (jsonb_typeof(muscle_targets) = 'object') not valid,
  add constraint program_slots_prescription_object_check
    check (jsonb_typeof(prescription) = 'object') not valid;

commit;
