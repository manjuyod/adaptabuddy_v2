create sequence "public"."exercises_id_seq";

create sequence "public"."muscle_groups_id_seq";

create sequence "public"."program_days_id_seq";

create sequence "public"."program_slots_id_seq";

create sequence "public"."programs_id_seq";


  create table "public"."beta_feedback_reports" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "category" text not null,
    "boundary_area" text not null,
    "severity" text not null,
    "status" text not null default 'open'::text,
    "title" text not null,
    "summary" text not null,
    "current_route" text,
    "request_id" text,
    "replay_reference" jsonb not null default '{}'::jsonb,
    "client_context" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."beta_feedback_reports" enable row level security;


  create table "public"."classes" (
    "id" text not null,
    "display_name" text not null,
    "description" text not null,
    "sort_order" integer not null,
    "is_selectable" boolean not null default true,
    "status" text not null,
    "base_archetype" text not null
      );


alter table "public"."classes" enable row level security;


  create table "public"."engine_cycle_plans" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "profile_id" bigint not null,
    "primary_program_id" integer,
    "resolved_class_archetype" text,
    "total_weeks" smallint not null,
    "mesocycle_count" smallint not null default 1,
    "current_mesocycle_index" integer not null default 0,
    "current_microcycle_index" integer not null default 0,
    "current_session_index" integer not null default 0,
    "total_sessions" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "class_preset_id" text not null default 'classless'::text
      );


alter table "public"."engine_cycle_plans" enable row level security;


  create table "public"."engine_cycle_profiles" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "class_choice" text not null,
    "goal_bias" text not null,
    "available_days_per_week" smallint not null,
    "fatigue_preference" text not null,
    "injury_muscle_group_slugs" text[] not null default '{}'::text[],
    "macrocycle_weeks" smallint not null,
    "resolved_class_archetype" text,
    "created_at" timestamp with time zone not null default now(),
    "class_preset_id" text not null default 'classless'::text
      );


alter table "public"."engine_cycle_profiles" enable row level security;


  create table "public"."engine_cycle_program_mix" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "profile_id" bigint not null,
    "program_id" integer not null,
    "selection_weight" numeric not null,
    "role" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."engine_cycle_program_mix" enable row level security;


  create table "public"."engine_cycle_season_awards" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "plan_id" bigint not null,
    "season_summary_id" bigint not null,
    "award_id" text not null,
    "label" text not null,
    "reason" text not null,
    "xp" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."engine_cycle_season_awards" enable row level security;


  create table "public"."engine_cycle_season_summaries" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "plan_id" bigint not null,
    "season_index" integer not null,
    "season_rank" text not null,
    "rank_breakdown" jsonb not null default '{}'::jsonb,
    "summary_payload" jsonb not null default '{}'::jsonb,
    "completed_sessions" integer not null default 0,
    "missed_sessions" integer not null default 0,
    "total_sessions" integer not null default 0,
    "completion_rate" numeric not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."engine_cycle_season_summaries" enable row level security;


  create table "public"."engine_cycle_sessions" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "plan_id" bigint not null,
    "session_index" integer not null,
    "program_id" integer,
    "program_day_id" integer,
    "program_day_name" text not null,
    "macro_week" smallint not null,
    "mesocycle_index" integer not null,
    "microcycle_index" integer not null,
    "planned_day_of_week" smallint not null,
    "class_archetype" text,
    "slot_payload" jsonb not null default '[]'::jsonb,
    "session_seed" text,
    "projected_fatigue_cost" jsonb not null default '{}'::jsonb,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."engine_cycle_sessions" enable row level security;


  create table "public"."engine_cycle_transitions" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "plan_id" bigint not null,
    "season_summary_id" bigint not null,
    "season_index" integer not null,
    "season_rank" text not null,
    "awarded_xp" integer not null default 0,
    "next_cycle_request" jsonb not null default '{}'::jsonb,
    "next_cycle_preview" jsonb not null default '{}'::jsonb,
    "replay_receipt" jsonb not null default '{}'::jsonb,
    "decision_log" jsonb not null default '[]'::jsonb,
    "engine_result" jsonb not null default '{}'::jsonb,
    "state_patch" jsonb not null default '{}'::jsonb,
    "status" text not null default 'recommended'::text,
    "idempotency_key" text,
    "created_at" timestamp with time zone not null default now(),
    "applied_at" timestamp with time zone
      );


alter table "public"."engine_cycle_transitions" enable row level security;


  create table "public"."engine_gamification_states" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "plan_id" bigint not null,
    "xp" integer not null default 0,
    "level" integer not null default 1,
    "adherence_streak" integer not null default 0,
    "class_archetype" text,
    "created_at" timestamp with time zone not null default now(),
    "completed_session_count" integer not null default 0,
    "missed_session_count" integer not null default 0,
    "last_adherence_outcome_classification" text,
    "last_awarded_at" timestamp with time zone
      );


alter table "public"."engine_gamification_states" enable row level security;


  create table "public"."engine_progression_states" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "plan_id" bigint not null,
    "exercise_id" text not null,
    "current_action" text not null,
    "trend" text not null,
    "last_successful_load_weight" numeric,
    "last_successful_load_reps" integer,
    "consecutive_successful_completions" integer not null default 0,
    "consecutive_stall_or_regression_count" integer not null default 0,
    "swap_recommendation_count" integer not null default 0,
    "last_session_outcome_classification" text not null,
    "last_completed_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."engine_progression_states" enable row level security;


  create table "public"."engine_session_traces" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "operation" text not null,
    "cycle_plan_id" bigint,
    "cycle_session_id" bigint,
    "workout_log_id" bigint,
    "decision_log" jsonb not null default '[]'::jsonb,
    "replay_receipt" jsonb not null default '{}'::jsonb,
    "engine_result" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "input_material" jsonb
      );


alter table "public"."engine_session_traces" enable row level security;


  create table "public"."exercise_muscle_map" (
    "exercise_id" integer not null,
    "muscle_group_id" integer not null,
    "role" text not null default 'primary'::text,
    "contribution" numeric(4,3) not null default 1.0
      );


alter table "public"."exercise_muscle_map" enable row level security;


  create table "public"."exercises" (
    "id" integer not null default nextval('public.exercises_id_seq'::regclass),
    "slug" text not null,
    "name" text not null,
    "movement_pattern" text not null,
    "equipment" jsonb not null default '[]'::jsonb,
    "is_bodyweight" boolean not null default false,
    "aliases" jsonb not null default '[]'::jsonb,
    "tags" jsonb not null default '[]'::jsonb,
    "media" jsonb not null default '{}'::jsonb,
    "contraindications" jsonb not null default '[]'::jsonb,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."exercises" enable row level security;


  create table "public"."muscle_groups" (
    "id" integer not null default nextval('public.muscle_groups_id_seq'::regclass),
    "slug" text not null,
    "name" text not null
      );


alter table "public"."muscle_groups" enable row level security;


  create table "public"."program_days" (
    "id" integer not null default nextval('public.program_days_id_seq'::regclass),
    "program_id" integer not null,
    "day_index" smallint not null,
    "name" text not null,
    "theme_tags" jsonb not null default '[]'::jsonb
      );


alter table "public"."program_days" enable row level security;


  create table "public"."program_slots" (
    "id" integer not null default nextval('public.program_slots_id_seq'::regclass),
    "program_day_id" integer not null,
    "slot_index" smallint not null,
    "slot_type" text not null default 'accessory'::text,
    "lock_type" text not null default 'flex'::text,
    "locked_exercise_id" integer,
    "movement_pattern" text,
    "equipment_allowed" jsonb not null default '[]'::jsonb,
    "tags_required" jsonb not null default '[]'::jsonb,
    "tags_blocked" jsonb not null default '[]'::jsonb,
    "sets_min" smallint not null default 2,
    "sets_max" smallint not null default 4,
    "reps_min" smallint not null default 6,
    "reps_max" smallint not null default 12,
    "rir_min" smallint,
    "rir_max" smallint,
    "muscle_targets" jsonb not null default '{}'::jsonb,
    "prescription" jsonb not null default '{}'::jsonb,
    "is_optional" boolean not null default false
      );


alter table "public"."program_slots" enable row level security;


  create table "public"."programs" (
    "id" integer not null default nextval('public.programs_id_seq'::regclass),
    "slug" text not null,
    "name" text not null,
    "program_type" text not null default 'hybrid'::text,
    "min_days_per_week" smallint not null default 3,
    "max_days_per_week" smallint not null default 6,
    "default_days_per_week" smallint not null default 4,
    "description" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."programs" enable row level security;


  create table "public"."rate_limit_counters" (
    "key" text not null,
    "request_count" integer not null,
    "reset_at" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."set_logs" (
    "id" bigint generated always as identity not null,
    "workout_log_id" bigint not null,
    "exercise_id" integer not null,
    "set_number" smallint not null,
    "weight" numeric not null,
    "reps" smallint not null,
    "rpe" numeric,
    "rir" smallint,
    "failed" boolean not null default false,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."set_logs" enable row level security;


  create table "public"."users" (
    "id" uuid not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "has_save" boolean not null default false,
    "preferred_start_screen" text not null default 'auto'::text,
    "last_start_choice" text,
    "stats_json" jsonb not null default '{}'::jsonb
      );


alter table "public"."users" enable row level security;


  create table "public"."workout_logs" (
    "id" bigint generated always as identity not null,
    "user_id" uuid not null,
    "program_id" integer,
    "program_day_id" integer,
    "completed_at" timestamp with time zone not null default now(),
    "duration_seconds" integer,
    "total_volume" numeric,
    "seed" text,
    "metadata" jsonb not null default '{}'::jsonb,
    "idempotency_key" text
      );


alter table "public"."workout_logs" enable row level security;

alter sequence "public"."exercises_id_seq" owned by "public"."exercises"."id";

alter sequence "public"."muscle_groups_id_seq" owned by "public"."muscle_groups"."id";

alter sequence "public"."program_days_id_seq" owned by "public"."program_days"."id";

alter sequence "public"."program_slots_id_seq" owned by "public"."program_slots"."id";

alter sequence "public"."programs_id_seq" owned by "public"."programs"."id";

CREATE UNIQUE INDEX beta_feedback_reports_pkey ON public.beta_feedback_reports USING btree (id);

CREATE UNIQUE INDEX classes_pkey ON public.classes USING btree (id);

CREATE UNIQUE INDEX engine_cycle_plans_pkey ON public.engine_cycle_plans USING btree (id);

CREATE UNIQUE INDEX engine_cycle_profiles_pkey ON public.engine_cycle_profiles USING btree (id);

CREATE UNIQUE INDEX engine_cycle_program_mix_pkey ON public.engine_cycle_program_mix USING btree (id);

CREATE UNIQUE INDEX engine_cycle_season_awards_pkey ON public.engine_cycle_season_awards USING btree (id);

CREATE UNIQUE INDEX engine_cycle_season_summaries_pkey ON public.engine_cycle_season_summaries USING btree (id);

CREATE UNIQUE INDEX engine_cycle_season_summaries_plan_season_key ON public.engine_cycle_season_summaries USING btree (plan_id, season_index);

CREATE UNIQUE INDEX engine_cycle_sessions_pkey ON public.engine_cycle_sessions USING btree (id);

CREATE UNIQUE INDEX engine_cycle_sessions_plan_session_key ON public.engine_cycle_sessions USING btree (plan_id, session_index);

CREATE UNIQUE INDEX engine_cycle_transitions_pkey ON public.engine_cycle_transitions USING btree (id);

CREATE UNIQUE INDEX engine_cycle_transitions_plan_season_key ON public.engine_cycle_transitions USING btree (plan_id, season_index);

CREATE UNIQUE INDEX engine_gamification_states_pkey ON public.engine_gamification_states USING btree (id);

CREATE UNIQUE INDEX engine_progression_states_pkey ON public.engine_progression_states USING btree (id);

CREATE UNIQUE INDEX engine_progression_states_plan_exercise_key ON public.engine_progression_states USING btree (plan_id, exercise_id);

CREATE UNIQUE INDEX engine_session_traces_pkey ON public.engine_session_traces USING btree (id);

CREATE INDEX exercise_muscle_map_muscle_group_id_idx ON public.exercise_muscle_map USING btree (muscle_group_id);

CREATE UNIQUE INDEX exercise_muscle_map_pkey ON public.exercise_muscle_map USING btree (exercise_id, muscle_group_id);

CREATE INDEX exercises_equipment_gin ON public.exercises USING gin (equipment);

CREATE UNIQUE INDEX exercises_pkey ON public.exercises USING btree (id);

CREATE UNIQUE INDEX exercises_slug_key ON public.exercises USING btree (slug);

CREATE INDEX exercises_tags_gin ON public.exercises USING gin (tags);

CREATE INDEX idx_beta_feedback_reports_status ON public.beta_feedback_reports USING btree (status);

CREATE INDEX idx_beta_feedback_reports_user_created_at ON public.beta_feedback_reports USING btree (user_id, created_at DESC);

CREATE INDEX idx_engine_cycle_plans_class_preset_id ON public.engine_cycle_plans USING btree (class_preset_id);

CREATE UNIQUE INDEX idx_engine_cycle_plans_user_active ON public.engine_cycle_plans USING btree (user_id) WHERE is_active;

CREATE INDEX idx_engine_cycle_profiles_class_preset_id ON public.engine_cycle_profiles USING btree (class_preset_id);

CREATE INDEX idx_engine_cycle_profiles_user ON public.engine_cycle_profiles USING btree (user_id, created_at DESC);

CREATE INDEX idx_engine_cycle_program_mix_profile ON public.engine_cycle_program_mix USING btree (profile_id);

CREATE INDEX idx_engine_cycle_season_awards_summary ON public.engine_cycle_season_awards USING btree (season_summary_id);

CREATE INDEX idx_engine_cycle_season_summaries_user_created ON public.engine_cycle_season_summaries USING btree (user_id, created_at DESC);

CREATE INDEX idx_engine_cycle_sessions_plan_index ON public.engine_cycle_sessions USING btree (plan_id, session_index);

CREATE UNIQUE INDEX idx_engine_cycle_transitions_idempotency ON public.engine_cycle_transitions USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE INDEX idx_engine_cycle_transitions_user_created ON public.engine_cycle_transitions USING btree (user_id, created_at DESC);

CREATE INDEX idx_engine_gamification_states_plan ON public.engine_gamification_states USING btree (plan_id);

CREATE INDEX idx_engine_progression_states_plan ON public.engine_progression_states USING btree (plan_id, exercise_id);

CREATE UNIQUE INDEX idx_engine_session_traces_complete_workout_unique ON public.engine_session_traces USING btree (workout_log_id) WHERE ((operation = 'complete_session'::text) AND (workout_log_id IS NOT NULL));

CREATE UNIQUE INDEX idx_engine_session_traces_plan_session_unique ON public.engine_session_traces USING btree (cycle_session_id) WHERE ((operation = 'plan_session'::text) AND (cycle_session_id IS NOT NULL));

CREATE INDEX idx_engine_session_traces_user_created_at ON public.engine_session_traces USING btree (user_id, created_at DESC);

CREATE INDEX idx_program_slots_locked_exercise_id ON public.program_slots USING btree (locked_exercise_id) WHERE (locked_exercise_id IS NOT NULL);

CREATE INDEX idx_rate_limit_counters_reset_at ON public.rate_limit_counters USING btree (reset_at);

CREATE INDEX idx_set_logs_workout ON public.set_logs USING btree (workout_log_id);

CREATE INDEX idx_users_stats_json ON public.users USING gin (stats_json);

CREATE INDEX idx_workout_logs_user_date ON public.workout_logs USING btree (user_id, completed_at DESC);

CREATE UNIQUE INDEX idx_workout_logs_user_idempotency ON public.workout_logs USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

CREATE UNIQUE INDEX muscle_groups_pkey ON public.muscle_groups USING btree (id);

CREATE UNIQUE INDEX muscle_groups_slug_key ON public.muscle_groups USING btree (slug);

CREATE UNIQUE INDEX program_days_pkey ON public.program_days USING btree (id);

CREATE UNIQUE INDEX program_days_program_id_day_index_key ON public.program_days USING btree (program_id, day_index);

CREATE UNIQUE INDEX program_slots_pkey ON public.program_slots USING btree (id);

CREATE UNIQUE INDEX program_slots_program_day_id_slot_index_key ON public.program_slots USING btree (program_day_id, slot_index);

CREATE UNIQUE INDEX programs_pkey ON public.programs USING btree (id);

CREATE UNIQUE INDEX programs_slug_key ON public.programs USING btree (slug);

CREATE UNIQUE INDEX rate_limit_counters_pkey ON public.rate_limit_counters USING btree (key);

CREATE UNIQUE INDEX set_logs_pkey ON public.set_logs USING btree (id);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

CREATE UNIQUE INDEX workout_logs_pkey ON public.workout_logs USING btree (id);

alter table "public"."beta_feedback_reports" add constraint "beta_feedback_reports_pkey" PRIMARY KEY using index "beta_feedback_reports_pkey";

alter table "public"."classes" add constraint "classes_pkey" PRIMARY KEY using index "classes_pkey";

alter table "public"."engine_cycle_plans" add constraint "engine_cycle_plans_pkey" PRIMARY KEY using index "engine_cycle_plans_pkey";

alter table "public"."engine_cycle_profiles" add constraint "engine_cycle_profiles_pkey" PRIMARY KEY using index "engine_cycle_profiles_pkey";

alter table "public"."engine_cycle_program_mix" add constraint "engine_cycle_program_mix_pkey" PRIMARY KEY using index "engine_cycle_program_mix_pkey";

alter table "public"."engine_cycle_season_awards" add constraint "engine_cycle_season_awards_pkey" PRIMARY KEY using index "engine_cycle_season_awards_pkey";

alter table "public"."engine_cycle_season_summaries" add constraint "engine_cycle_season_summaries_pkey" PRIMARY KEY using index "engine_cycle_season_summaries_pkey";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_pkey" PRIMARY KEY using index "engine_cycle_sessions_pkey";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_pkey" PRIMARY KEY using index "engine_cycle_transitions_pkey";

alter table "public"."engine_gamification_states" add constraint "engine_gamification_states_pkey" PRIMARY KEY using index "engine_gamification_states_pkey";

alter table "public"."engine_progression_states" add constraint "engine_progression_states_pkey" PRIMARY KEY using index "engine_progression_states_pkey";

alter table "public"."engine_session_traces" add constraint "engine_session_traces_pkey" PRIMARY KEY using index "engine_session_traces_pkey";

alter table "public"."exercise_muscle_map" add constraint "exercise_muscle_map_pkey" PRIMARY KEY using index "exercise_muscle_map_pkey";

alter table "public"."exercises" add constraint "exercises_pkey" PRIMARY KEY using index "exercises_pkey";

alter table "public"."muscle_groups" add constraint "muscle_groups_pkey" PRIMARY KEY using index "muscle_groups_pkey";

alter table "public"."program_days" add constraint "program_days_pkey" PRIMARY KEY using index "program_days_pkey";

alter table "public"."program_slots" add constraint "program_slots_pkey" PRIMARY KEY using index "program_slots_pkey";

alter table "public"."programs" add constraint "programs_pkey" PRIMARY KEY using index "programs_pkey";

alter table "public"."rate_limit_counters" add constraint "rate_limit_counters_pkey" PRIMARY KEY using index "rate_limit_counters_pkey";

alter table "public"."set_logs" add constraint "set_logs_pkey" PRIMARY KEY using index "set_logs_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."workout_logs" add constraint "workout_logs_pkey" PRIMARY KEY using index "workout_logs_pkey";

alter table "public"."beta_feedback_reports" add constraint "beta_feedback_reports_boundary_area_check" CHECK ((boundary_area = ANY (ARRAY['app-shell'::text, 'adapter-contract'::text, 'persistence-rls'::text, 'telemetry-read-model'::text, 'replay-debuggability'::text, 'deterministic-engine-behavior'::text, 'product-copy'::text, 'unknown'::text]))) not valid;

alter table "public"."beta_feedback_reports" validate constraint "beta_feedback_reports_boundary_area_check";

alter table "public"."beta_feedback_reports" add constraint "beta_feedback_reports_category_check" CHECK ((category = ANY (ARRAY['bug'::text, 'workflow_pain'::text, 'confusing_copy'::text, 'performance'::text, 'other'::text]))) not valid;

alter table "public"."beta_feedback_reports" validate constraint "beta_feedback_reports_category_check";

alter table "public"."beta_feedback_reports" add constraint "beta_feedback_reports_severity_check" CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."beta_feedback_reports" validate constraint "beta_feedback_reports_severity_check";

alter table "public"."beta_feedback_reports" add constraint "beta_feedback_reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."beta_feedback_reports" validate constraint "beta_feedback_reports_user_id_fkey";

alter table "public"."engine_cycle_plans" add constraint "engine_cycle_plans_class_preset_id_fkey" FOREIGN KEY (class_preset_id) REFERENCES public.classes(id) not valid;

alter table "public"."engine_cycle_plans" validate constraint "engine_cycle_plans_class_preset_id_fkey";

alter table "public"."engine_cycle_plans" add constraint "engine_cycle_plans_primary_program_id_fkey" FOREIGN KEY (primary_program_id) REFERENCES public.programs(id) ON DELETE SET NULL not valid;

alter table "public"."engine_cycle_plans" validate constraint "engine_cycle_plans_primary_program_id_fkey";

alter table "public"."engine_cycle_plans" add constraint "engine_cycle_plans_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.engine_cycle_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_plans" validate constraint "engine_cycle_plans_profile_id_fkey";

alter table "public"."engine_cycle_plans" add constraint "engine_cycle_plans_resolved_class_archetype_check" CHECK (((resolved_class_archetype IS NULL) OR (resolved_class_archetype = ANY (ARRAY['strength'::text, 'hybrid'::text])))) not valid;

alter table "public"."engine_cycle_plans" validate constraint "engine_cycle_plans_resolved_class_archetype_check";

alter table "public"."engine_cycle_plans" add constraint "engine_cycle_plans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_plans" validate constraint "engine_cycle_plans_user_id_fkey";

alter table "public"."engine_cycle_profiles" add constraint "engine_cycle_profiles_class_preset_id_fkey" FOREIGN KEY (class_preset_id) REFERENCES public.classes(id) not valid;

alter table "public"."engine_cycle_profiles" validate constraint "engine_cycle_profiles_class_preset_id_fkey";

alter table "public"."engine_cycle_profiles" add constraint "engine_cycle_profiles_resolved_class_archetype_check" CHECK (((resolved_class_archetype IS NULL) OR (resolved_class_archetype = ANY (ARRAY['strength'::text, 'hybrid'::text])))) not valid;

alter table "public"."engine_cycle_profiles" validate constraint "engine_cycle_profiles_resolved_class_archetype_check";

alter table "public"."engine_cycle_profiles" add constraint "engine_cycle_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_profiles" validate constraint "engine_cycle_profiles_user_id_fkey";

alter table "public"."engine_cycle_program_mix" add constraint "engine_cycle_program_mix_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.engine_cycle_profiles(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_program_mix" validate constraint "engine_cycle_program_mix_profile_id_fkey";

alter table "public"."engine_cycle_program_mix" add constraint "engine_cycle_program_mix_program_id_fkey" FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_program_mix" validate constraint "engine_cycle_program_mix_program_id_fkey";

alter table "public"."engine_cycle_program_mix" add constraint "engine_cycle_program_mix_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_program_mix" validate constraint "engine_cycle_program_mix_user_id_fkey";

alter table "public"."engine_cycle_season_awards" add constraint "engine_cycle_season_awards_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_season_awards" validate constraint "engine_cycle_season_awards_plan_id_fkey";

alter table "public"."engine_cycle_season_awards" add constraint "engine_cycle_season_awards_season_summary_id_fkey" FOREIGN KEY (season_summary_id) REFERENCES public.engine_cycle_season_summaries(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_season_awards" validate constraint "engine_cycle_season_awards_season_summary_id_fkey";

alter table "public"."engine_cycle_season_awards" add constraint "engine_cycle_season_awards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_season_awards" validate constraint "engine_cycle_season_awards_user_id_fkey";

alter table "public"."engine_cycle_season_summaries" add constraint "engine_cycle_season_summaries_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_season_summaries" validate constraint "engine_cycle_season_summaries_plan_id_fkey";

alter table "public"."engine_cycle_season_summaries" add constraint "engine_cycle_season_summaries_plan_season_key" UNIQUE using index "engine_cycle_season_summaries_plan_season_key";

alter table "public"."engine_cycle_season_summaries" add constraint "engine_cycle_season_summaries_season_rank_check" CHECK ((season_rank = ANY (ARRAY['S'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text]))) not valid;

alter table "public"."engine_cycle_season_summaries" validate constraint "engine_cycle_season_summaries_season_rank_check";

alter table "public"."engine_cycle_season_summaries" add constraint "engine_cycle_season_summaries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_season_summaries" validate constraint "engine_cycle_season_summaries_user_id_fkey";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_class_archetype_check" CHECK (((class_archetype IS NULL) OR (class_archetype = ANY (ARRAY['strength'::text, 'hybrid'::text])))) not valid;

alter table "public"."engine_cycle_sessions" validate constraint "engine_cycle_sessions_class_archetype_check";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_sessions" validate constraint "engine_cycle_sessions_plan_id_fkey";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_plan_session_key" UNIQUE using index "engine_cycle_sessions_plan_session_key";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_program_day_id_fkey" FOREIGN KEY (program_day_id) REFERENCES public.program_days(id) ON DELETE SET NULL not valid;

alter table "public"."engine_cycle_sessions" validate constraint "engine_cycle_sessions_program_day_id_fkey";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_program_id_fkey" FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL not valid;

alter table "public"."engine_cycle_sessions" validate constraint "engine_cycle_sessions_program_id_fkey";

alter table "public"."engine_cycle_sessions" add constraint "engine_cycle_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_sessions" validate constraint "engine_cycle_sessions_user_id_fkey";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_transitions" validate constraint "engine_cycle_transitions_plan_id_fkey";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_plan_season_key" UNIQUE using index "engine_cycle_transitions_plan_season_key";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_season_rank_check" CHECK ((season_rank = ANY (ARRAY['S'::text, 'A'::text, 'B'::text, 'C'::text, 'D'::text]))) not valid;

alter table "public"."engine_cycle_transitions" validate constraint "engine_cycle_transitions_season_rank_check";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_season_summary_id_fkey" FOREIGN KEY (season_summary_id) REFERENCES public.engine_cycle_season_summaries(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_transitions" validate constraint "engine_cycle_transitions_season_summary_id_fkey";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_status_check" CHECK ((status = ANY (ARRAY['recommended'::text, 'applied'::text, 'dismissed'::text]))) not valid;

alter table "public"."engine_cycle_transitions" validate constraint "engine_cycle_transitions_status_check";

alter table "public"."engine_cycle_transitions" add constraint "engine_cycle_transitions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_cycle_transitions" validate constraint "engine_cycle_transitions_user_id_fkey";

alter table "public"."engine_gamification_states" add constraint "engine_gamification_states_class_archetype_check" CHECK (((class_archetype IS NULL) OR (class_archetype = ANY (ARRAY['strength'::text, 'hybrid'::text])))) not valid;

alter table "public"."engine_gamification_states" validate constraint "engine_gamification_states_class_archetype_check";

alter table "public"."engine_gamification_states" add constraint "engine_gamification_states_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE CASCADE not valid;

alter table "public"."engine_gamification_states" validate constraint "engine_gamification_states_plan_id_fkey";

alter table "public"."engine_gamification_states" add constraint "engine_gamification_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_gamification_states" validate constraint "engine_gamification_states_user_id_fkey";

alter table "public"."engine_progression_states" add constraint "engine_progression_states_plan_exercise_key" UNIQUE using index "engine_progression_states_plan_exercise_key";

alter table "public"."engine_progression_states" add constraint "engine_progression_states_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE CASCADE not valid;

alter table "public"."engine_progression_states" validate constraint "engine_progression_states_plan_id_fkey";

alter table "public"."engine_progression_states" add constraint "engine_progression_states_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_progression_states" validate constraint "engine_progression_states_user_id_fkey";

alter table "public"."engine_session_traces" add constraint "engine_session_traces_cycle_plan_id_fkey" FOREIGN KEY (cycle_plan_id) REFERENCES public.engine_cycle_plans(id) ON DELETE SET NULL not valid;

alter table "public"."engine_session_traces" validate constraint "engine_session_traces_cycle_plan_id_fkey";

alter table "public"."engine_session_traces" add constraint "engine_session_traces_cycle_session_id_fkey" FOREIGN KEY (cycle_session_id) REFERENCES public.engine_cycle_sessions(id) ON DELETE SET NULL not valid;

alter table "public"."engine_session_traces" validate constraint "engine_session_traces_cycle_session_id_fkey";

alter table "public"."engine_session_traces" add constraint "engine_session_traces_operation_check" CHECK ((operation = ANY (ARRAY['plan_session'::text, 'complete_session'::text, 'advance_cycle'::text]))) not valid;

alter table "public"."engine_session_traces" validate constraint "engine_session_traces_operation_check";

alter table "public"."engine_session_traces" add constraint "engine_session_traces_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."engine_session_traces" validate constraint "engine_session_traces_user_id_fkey";

alter table "public"."engine_session_traces" add constraint "engine_session_traces_workout_log_id_fkey" FOREIGN KEY (workout_log_id) REFERENCES public.workout_logs(id) ON DELETE SET NULL not valid;

alter table "public"."engine_session_traces" validate constraint "engine_session_traces_workout_log_id_fkey";

alter table "public"."exercise_muscle_map" add constraint "exercise_muscle_map_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) ON DELETE CASCADE not valid;

alter table "public"."exercise_muscle_map" validate constraint "exercise_muscle_map_exercise_id_fkey";

alter table "public"."exercise_muscle_map" add constraint "exercise_muscle_map_muscle_group_id_fkey" FOREIGN KEY (muscle_group_id) REFERENCES public.muscle_groups(id) ON DELETE CASCADE not valid;

alter table "public"."exercise_muscle_map" validate constraint "exercise_muscle_map_muscle_group_id_fkey";

alter table "public"."exercises" add constraint "exercises_slug_key" UNIQUE using index "exercises_slug_key";

alter table "public"."muscle_groups" add constraint "muscle_groups_slug_key" UNIQUE using index "muscle_groups_slug_key";

alter table "public"."program_days" add constraint "program_days_program_id_day_index_key" UNIQUE using index "program_days_program_id_day_index_key";

alter table "public"."program_days" add constraint "program_days_program_id_fkey" FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE not valid;

alter table "public"."program_days" validate constraint "program_days_program_id_fkey";

alter table "public"."program_slots" add constraint "program_slots_locked_exercise_id_fkey" FOREIGN KEY (locked_exercise_id) REFERENCES public.exercises(id) not valid;

alter table "public"."program_slots" validate constraint "program_slots_locked_exercise_id_fkey";

alter table "public"."program_slots" add constraint "program_slots_program_day_id_fkey" FOREIGN KEY (program_day_id) REFERENCES public.program_days(id) ON DELETE CASCADE not valid;

alter table "public"."program_slots" validate constraint "program_slots_program_day_id_fkey";

alter table "public"."program_slots" add constraint "program_slots_program_day_id_slot_index_key" UNIQUE using index "program_slots_program_day_id_slot_index_key";

alter table "public"."programs" add constraint "programs_slug_key" UNIQUE using index "programs_slug_key";

alter table "public"."set_logs" add constraint "set_logs_exercise_id_fkey" FOREIGN KEY (exercise_id) REFERENCES public.exercises(id) not valid;

alter table "public"."set_logs" validate constraint "set_logs_exercise_id_fkey";

alter table "public"."set_logs" add constraint "set_logs_workout_log_id_fkey" FOREIGN KEY (workout_log_id) REFERENCES public.workout_logs(id) ON DELETE CASCADE not valid;

alter table "public"."set_logs" validate constraint "set_logs_workout_log_id_fkey";

alter table "public"."users" add constraint "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."users" validate constraint "users_id_fkey";

alter table "public"."users" add constraint "users_last_start_choice_check" CHECK ((last_start_choice = ANY (ARRAY['start'::text, 'continue'::text]))) not valid;

alter table "public"."users" validate constraint "users_last_start_choice_check";

alter table "public"."users" add constraint "users_preferred_start_screen_check" CHECK ((preferred_start_screen = ANY (ARRAY['auto'::text, 'start'::text, 'continue'::text]))) not valid;

alter table "public"."users" validate constraint "users_preferred_start_screen_check";

alter table "public"."workout_logs" add constraint "workout_logs_program_day_id_fkey" FOREIGN KEY (program_day_id) REFERENCES public.program_days(id) ON DELETE SET NULL not valid;

alter table "public"."workout_logs" validate constraint "workout_logs_program_day_id_fkey";

alter table "public"."workout_logs" add constraint "workout_logs_program_id_fkey" FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE SET NULL not valid;

alter table "public"."workout_logs" validate constraint "workout_logs_program_id_fkey";

alter table "public"."workout_logs" add constraint "workout_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."workout_logs" validate constraint "workout_logs_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.complete_session_atomic(p_user_id uuid, p_program_id integer, p_program_day_id integer, p_completed_at timestamp with time zone, p_duration_seconds integer, p_total_volume numeric, p_seed text, p_metadata jsonb, p_set_logs jsonb, p_stats_json jsonb, p_cycle_plan_id bigint DEFAULT NULL::bigint, p_cycle_session_id bigint DEFAULT NULL::bigint, p_engine_decision_log jsonb DEFAULT NULL::jsonb, p_engine_replay_receipt jsonb DEFAULT NULL::jsonb, p_engine_result jsonb DEFAULT NULL::jsonb, p_engine_input_material jsonb DEFAULT NULL::jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS TABLE(workout_log_id bigint, reused boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  existing_workout_id bigint;
  inserted_workout_id bigint;
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception 'User is not authorized to complete sessions for %', p_user_id;
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select wl.id
      into existing_workout_id
      from public.workout_logs wl
      where wl.user_id = p_user_id
        and wl.idempotency_key = p_idempotency_key
      limit 1;

    if existing_workout_id is not null then
      return query select existing_workout_id, true;
      return;
    end if;
  end if;

  insert into public.workout_logs (
    user_id,
    program_id,
    program_day_id,
    completed_at,
    duration_seconds,
    total_volume,
    seed,
    metadata,
    idempotency_key
  )
  values (
    p_user_id,
    p_program_id,
    p_program_day_id,
    p_completed_at,
    p_duration_seconds,
    p_total_volume,
    p_seed,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(trim(p_idempotency_key), '')
  )
  returning id into inserted_workout_id;

  if coalesce(jsonb_array_length(coalesce(p_set_logs, '[]'::jsonb)), 0) > 0 then
    insert into public.set_logs (
      workout_log_id,
      exercise_id,
      set_number,
      weight,
      reps,
      rpe,
      rir,
      failed
    )
    select
      inserted_workout_id,
      (entry->>'exercise_id')::integer,
      (entry->>'set_number')::smallint,
      (entry->>'weight')::numeric,
      (entry->>'reps')::smallint,
      case
        when entry ? 'rpe' and entry->>'rpe' is not null
          then (entry->>'rpe')::numeric
        else null
      end,
      case
        when entry ? 'rir' and entry->>'rir' is not null
          then (entry->>'rir')::smallint
        else null
      end,
      coalesce((entry->>'failed')::boolean, false)
    from jsonb_array_elements(coalesce(p_set_logs, '[]'::jsonb)) as entry;
  end if;

  update public.users
    set stats_json = p_stats_json
    where id = p_user_id;

  if not found then
    raise exception 'User not found for completion update: %', p_user_id;
  end if;

  if p_cycle_session_id is not null
    and p_engine_decision_log is not null
    and p_engine_replay_receipt is not null
    and p_engine_result is not null
    and not exists (
      select 1
      from public.engine_session_traces trace
      where trace.operation = 'complete_session'
        and trace.workout_log_id = inserted_workout_id
    )
  then
    insert into public.engine_session_traces (
      user_id,
      operation,
      cycle_plan_id,
      cycle_session_id,
      workout_log_id,
      input_material,
      decision_log,
      replay_receipt,
      engine_result
    )
    values (
      p_user_id,
      'complete_session',
      p_cycle_plan_id,
      p_cycle_session_id,
      inserted_workout_id,
      p_engine_input_material,
      coalesce(p_engine_decision_log, '[]'::jsonb),
      coalesce(p_engine_replay_receipt, '{}'::jsonb),
      coalesce(p_engine_result, '{}'::jsonb)
    );
  end if;

  return query select inserted_workout_id, false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_ms integer)
 RETURNS TABLE(success boolean, remaining integer, reset_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  now_ts timestamptz := now();
  next_reset timestamptz := now_ts + make_interval(secs => greatest(p_window_ms, 1)::numeric / 1000);
  counter_key text := left(coalesce(trim(p_key), ''), 200);
  counter_row public.rate_limit_counters%rowtype;
begin
  if counter_key = '' then
    raise exception 'rate limit key is required';
  end if;

  if p_limit <= 0 then
    raise exception 'rate limit must be > 0';
  end if;

  if p_window_ms <= 0 then
    raise exception 'rate limit window must be > 0';
  end if;

  select *
    into counter_row
    from public.rate_limit_counters
    where key = counter_key
    for update;

  if not found then
    insert into public.rate_limit_counters (key, request_count, reset_at, created_at, updated_at)
    values (counter_key, 1, next_reset, now_ts, now_ts);

    return query select true, greatest(p_limit - 1, 0), next_reset;
    return;
  end if;

  if counter_row.reset_at <= now_ts then
    update public.rate_limit_counters
      set request_count = 1,
          reset_at = next_reset,
          updated_at = now_ts
      where key = counter_key;

    return query select true, greatest(p_limit - 1, 0), next_reset;
    return;
  end if;

  if counter_row.request_count >= p_limit then
    return query select false, 0, counter_row.reset_at;
    return;
  end if;

  update public.rate_limit_counters
    set request_count = request_count + 1,
        updated_at = now_ts
    where key = counter_key
    returning * into counter_row;

  return query select true, greatest(p_limit - counter_row.request_count, 0), counter_row.reset_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.program_template_integrity_check()
 RETURNS TABLE(issue_type text, program_id integer, slug text, issue text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with program_family as (
    select
      p.id,
      p.slug,
      p.is_active,
      p.metadata,
      coalesce(p.metadata->>'adaptive_template_family', 'slot_based') as template_family,
      p.metadata->'source_template_json' as source_template
    from public.programs p
  ),
  complete_static_programs as (
    select distinct pd.program_id
    from public.program_days pd
    where exists (
      select 1
      from public.program_slots ps
      where ps.program_day_id = pd.id
    )
  )
  select
    'invalid_active_static_program'::text as issue_type,
    p.id as program_id,
    p.slug,
    'active slot_based program is missing complete program_days/program_slots'::text as issue
  from program_family p
  where p.is_active = true
    and p.template_family not in ('challenge_progression', 'hypertrophy_engine_v1')
    and not exists (
      select 1
      from complete_static_programs c
      where c.program_id = p.id
    )

  union all

  select
    'invalid_active_adaptive_program'::text,
    p.id,
    p.slug,
    'challenge_progression metadata must include exercise.slug, initial_test_groups, groups, and fixed frequency 3'::text
  from program_family p
  where p.is_active = true
    and p.template_family = 'challenge_progression'
    and (
      p.source_template is null
      or p.source_template #>> '{exercise,slug}' is null
      or jsonb_typeof(p.source_template->'initial_test_groups') <> 'array'
      or jsonb_array_length(p.source_template->'initial_test_groups') = 0
      or jsonb_typeof(p.source_template->'groups') <> 'object'
      or coalesce((p.source_template->>'frequency_per_week')::integer, 0) <> 3
    )

  union all

  select
    'invalid_active_adaptive_program'::text,
    p.id,
    p.slug,
    'hypertrophy_engine_v1 metadata must include exactly three source sessions with slots and fixed frequency 3'::text
  from program_family p
  where p.is_active = true
    and p.template_family = 'hypertrophy_engine_v1'
    and (
      p.source_template is null
      or jsonb_typeof(p.source_template->'sessions') <> 'array'
      or jsonb_array_length(p.source_template->'sessions') <> 3
      or exists (
        select 1
        from jsonb_array_elements(coalesce(p.source_template->'sessions', '[]'::jsonb)) as sessions(session_json)
        where session_json->>'session_key' is null
          or jsonb_typeof(session_json->'slots') <> 'array'
          or jsonb_array_length(session_json->'slots') = 0
      )
      or coalesce((p.source_template->>'frequency_per_week')::integer, 0) <> 3
    );
$function$
;

CREATE OR REPLACE FUNCTION public.purge_expired_rate_limit_counters(p_older_than_hours integer DEFAULT 6)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  deleted_count integer := 0;
begin
  delete from public.rate_limit_counters
   where reset_at < now() - make_interval(hours => greatest(p_older_than_hours, 1));

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant insert on table "public"."beta_feedback_reports" to "authenticated";

grant select on table "public"."beta_feedback_reports" to "authenticated";

grant delete on table "public"."beta_feedback_reports" to "service_role";

grant insert on table "public"."beta_feedback_reports" to "service_role";

grant references on table "public"."beta_feedback_reports" to "service_role";

grant select on table "public"."beta_feedback_reports" to "service_role";

grant trigger on table "public"."beta_feedback_reports" to "service_role";

grant truncate on table "public"."beta_feedback_reports" to "service_role";

grant update on table "public"."beta_feedback_reports" to "service_role";

grant select on table "public"."classes" to "authenticated";

grant delete on table "public"."classes" to "service_role";

grant insert on table "public"."classes" to "service_role";

grant references on table "public"."classes" to "service_role";

grant select on table "public"."classes" to "service_role";

grant trigger on table "public"."classes" to "service_role";

grant truncate on table "public"."classes" to "service_role";

grant update on table "public"."classes" to "service_role";

grant insert on table "public"."engine_cycle_plans" to "authenticated";

grant select on table "public"."engine_cycle_plans" to "authenticated";

grant update on table "public"."engine_cycle_plans" to "authenticated";

grant delete on table "public"."engine_cycle_plans" to "service_role";

grant insert on table "public"."engine_cycle_plans" to "service_role";

grant references on table "public"."engine_cycle_plans" to "service_role";

grant select on table "public"."engine_cycle_plans" to "service_role";

grant trigger on table "public"."engine_cycle_plans" to "service_role";

grant truncate on table "public"."engine_cycle_plans" to "service_role";

grant update on table "public"."engine_cycle_plans" to "service_role";

grant insert on table "public"."engine_cycle_profiles" to "authenticated";

grant select on table "public"."engine_cycle_profiles" to "authenticated";

grant update on table "public"."engine_cycle_profiles" to "authenticated";

grant delete on table "public"."engine_cycle_profiles" to "service_role";

grant insert on table "public"."engine_cycle_profiles" to "service_role";

grant references on table "public"."engine_cycle_profiles" to "service_role";

grant select on table "public"."engine_cycle_profiles" to "service_role";

grant trigger on table "public"."engine_cycle_profiles" to "service_role";

grant truncate on table "public"."engine_cycle_profiles" to "service_role";

grant update on table "public"."engine_cycle_profiles" to "service_role";

grant insert on table "public"."engine_cycle_program_mix" to "authenticated";

grant select on table "public"."engine_cycle_program_mix" to "authenticated";

grant update on table "public"."engine_cycle_program_mix" to "authenticated";

grant delete on table "public"."engine_cycle_program_mix" to "service_role";

grant insert on table "public"."engine_cycle_program_mix" to "service_role";

grant references on table "public"."engine_cycle_program_mix" to "service_role";

grant select on table "public"."engine_cycle_program_mix" to "service_role";

grant trigger on table "public"."engine_cycle_program_mix" to "service_role";

grant truncate on table "public"."engine_cycle_program_mix" to "service_role";

grant update on table "public"."engine_cycle_program_mix" to "service_role";

grant select on table "public"."engine_cycle_season_awards" to "authenticated";

grant delete on table "public"."engine_cycle_season_awards" to "service_role";

grant insert on table "public"."engine_cycle_season_awards" to "service_role";

grant references on table "public"."engine_cycle_season_awards" to "service_role";

grant select on table "public"."engine_cycle_season_awards" to "service_role";

grant trigger on table "public"."engine_cycle_season_awards" to "service_role";

grant truncate on table "public"."engine_cycle_season_awards" to "service_role";

grant update on table "public"."engine_cycle_season_awards" to "service_role";

grant select on table "public"."engine_cycle_season_summaries" to "authenticated";

grant delete on table "public"."engine_cycle_season_summaries" to "service_role";

grant insert on table "public"."engine_cycle_season_summaries" to "service_role";

grant references on table "public"."engine_cycle_season_summaries" to "service_role";

grant select on table "public"."engine_cycle_season_summaries" to "service_role";

grant trigger on table "public"."engine_cycle_season_summaries" to "service_role";

grant truncate on table "public"."engine_cycle_season_summaries" to "service_role";

grant update on table "public"."engine_cycle_season_summaries" to "service_role";

grant insert on table "public"."engine_cycle_sessions" to "authenticated";

grant select on table "public"."engine_cycle_sessions" to "authenticated";

grant update on table "public"."engine_cycle_sessions" to "authenticated";

grant delete on table "public"."engine_cycle_sessions" to "service_role";

grant insert on table "public"."engine_cycle_sessions" to "service_role";

grant references on table "public"."engine_cycle_sessions" to "service_role";

grant select on table "public"."engine_cycle_sessions" to "service_role";

grant trigger on table "public"."engine_cycle_sessions" to "service_role";

grant truncate on table "public"."engine_cycle_sessions" to "service_role";

grant update on table "public"."engine_cycle_sessions" to "service_role";

grant select on table "public"."engine_cycle_transitions" to "authenticated";

grant delete on table "public"."engine_cycle_transitions" to "service_role";

grant insert on table "public"."engine_cycle_transitions" to "service_role";

grant references on table "public"."engine_cycle_transitions" to "service_role";

grant select on table "public"."engine_cycle_transitions" to "service_role";

grant trigger on table "public"."engine_cycle_transitions" to "service_role";

grant truncate on table "public"."engine_cycle_transitions" to "service_role";

grant update on table "public"."engine_cycle_transitions" to "service_role";

grant insert on table "public"."engine_gamification_states" to "authenticated";

grant select on table "public"."engine_gamification_states" to "authenticated";

grant update on table "public"."engine_gamification_states" to "authenticated";

grant delete on table "public"."engine_gamification_states" to "service_role";

grant insert on table "public"."engine_gamification_states" to "service_role";

grant references on table "public"."engine_gamification_states" to "service_role";

grant select on table "public"."engine_gamification_states" to "service_role";

grant trigger on table "public"."engine_gamification_states" to "service_role";

grant truncate on table "public"."engine_gamification_states" to "service_role";

grant update on table "public"."engine_gamification_states" to "service_role";

grant delete on table "public"."engine_progression_states" to "authenticated";

grant insert on table "public"."engine_progression_states" to "authenticated";

grant select on table "public"."engine_progression_states" to "authenticated";

grant update on table "public"."engine_progression_states" to "authenticated";

grant delete on table "public"."engine_progression_states" to "service_role";

grant insert on table "public"."engine_progression_states" to "service_role";

grant references on table "public"."engine_progression_states" to "service_role";

grant select on table "public"."engine_progression_states" to "service_role";

grant trigger on table "public"."engine_progression_states" to "service_role";

grant truncate on table "public"."engine_progression_states" to "service_role";

grant update on table "public"."engine_progression_states" to "service_role";

grant select on table "public"."engine_session_traces" to "authenticated";

grant delete on table "public"."engine_session_traces" to "service_role";

grant insert on table "public"."engine_session_traces" to "service_role";

grant references on table "public"."engine_session_traces" to "service_role";

grant select on table "public"."engine_session_traces" to "service_role";

grant trigger on table "public"."engine_session_traces" to "service_role";

grant truncate on table "public"."engine_session_traces" to "service_role";

grant update on table "public"."engine_session_traces" to "service_role";

grant select on table "public"."exercise_muscle_map" to "authenticated";

grant delete on table "public"."exercise_muscle_map" to "service_role";

grant insert on table "public"."exercise_muscle_map" to "service_role";

grant references on table "public"."exercise_muscle_map" to "service_role";

grant select on table "public"."exercise_muscle_map" to "service_role";

grant trigger on table "public"."exercise_muscle_map" to "service_role";

grant truncate on table "public"."exercise_muscle_map" to "service_role";

grant update on table "public"."exercise_muscle_map" to "service_role";

grant select on table "public"."exercises" to "authenticated";

grant delete on table "public"."exercises" to "service_role";

grant insert on table "public"."exercises" to "service_role";

grant references on table "public"."exercises" to "service_role";

grant select on table "public"."exercises" to "service_role";

grant trigger on table "public"."exercises" to "service_role";

grant truncate on table "public"."exercises" to "service_role";

grant update on table "public"."exercises" to "service_role";

grant select on table "public"."muscle_groups" to "authenticated";

grant delete on table "public"."muscle_groups" to "service_role";

grant insert on table "public"."muscle_groups" to "service_role";

grant references on table "public"."muscle_groups" to "service_role";

grant select on table "public"."muscle_groups" to "service_role";

grant trigger on table "public"."muscle_groups" to "service_role";

grant truncate on table "public"."muscle_groups" to "service_role";

grant update on table "public"."muscle_groups" to "service_role";

grant select on table "public"."program_days" to "authenticated";

grant delete on table "public"."program_days" to "service_role";

grant insert on table "public"."program_days" to "service_role";

grant references on table "public"."program_days" to "service_role";

grant select on table "public"."program_days" to "service_role";

grant trigger on table "public"."program_days" to "service_role";

grant truncate on table "public"."program_days" to "service_role";

grant update on table "public"."program_days" to "service_role";

grant select on table "public"."program_slots" to "authenticated";

grant delete on table "public"."program_slots" to "service_role";

grant insert on table "public"."program_slots" to "service_role";

grant references on table "public"."program_slots" to "service_role";

grant select on table "public"."program_slots" to "service_role";

grant trigger on table "public"."program_slots" to "service_role";

grant truncate on table "public"."program_slots" to "service_role";

grant update on table "public"."program_slots" to "service_role";

grant select on table "public"."programs" to "authenticated";

grant delete on table "public"."programs" to "service_role";

grant insert on table "public"."programs" to "service_role";

grant references on table "public"."programs" to "service_role";

grant select on table "public"."programs" to "service_role";

grant trigger on table "public"."programs" to "service_role";

grant truncate on table "public"."programs" to "service_role";

grant update on table "public"."programs" to "service_role";

grant delete on table "public"."rate_limit_counters" to "service_role";

grant insert on table "public"."rate_limit_counters" to "service_role";

grant references on table "public"."rate_limit_counters" to "service_role";

grant select on table "public"."rate_limit_counters" to "service_role";

grant trigger on table "public"."rate_limit_counters" to "service_role";

grant truncate on table "public"."rate_limit_counters" to "service_role";

grant update on table "public"."rate_limit_counters" to "service_role";

grant insert on table "public"."set_logs" to "authenticated";

grant select on table "public"."set_logs" to "authenticated";

grant delete on table "public"."set_logs" to "service_role";

grant insert on table "public"."set_logs" to "service_role";

grant references on table "public"."set_logs" to "service_role";

grant select on table "public"."set_logs" to "service_role";

grant trigger on table "public"."set_logs" to "service_role";

grant truncate on table "public"."set_logs" to "service_role";

grant update on table "public"."set_logs" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant insert on table "public"."workout_logs" to "authenticated";

grant select on table "public"."workout_logs" to "authenticated";

grant delete on table "public"."workout_logs" to "service_role";

grant insert on table "public"."workout_logs" to "service_role";

grant references on table "public"."workout_logs" to "service_role";

grant select on table "public"."workout_logs" to "service_role";

grant trigger on table "public"."workout_logs" to "service_role";

grant truncate on table "public"."workout_logs" to "service_role";

grant update on table "public"."workout_logs" to "service_role";


  create policy "beta_feedback_reports_insert_own"
  on "public"."beta_feedback_reports"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "beta_feedback_reports_select_own"
  on "public"."beta_feedback_reports"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "classes_select_authenticated"
  on "public"."classes"
  as permissive
  for select
  to authenticated
using (true);



  create policy "engine_cycle_plans_insert_own"
  on "public"."engine_cycle_plans"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_plans_select_own"
  on "public"."engine_cycle_plans"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_plans_update_own"
  on "public"."engine_cycle_plans"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_profiles_insert_own"
  on "public"."engine_cycle_profiles"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_profiles_select_own"
  on "public"."engine_cycle_profiles"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_profiles_update_own"
  on "public"."engine_cycle_profiles"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_program_mix_insert_own"
  on "public"."engine_cycle_program_mix"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_program_mix_select_own"
  on "public"."engine_cycle_program_mix"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_program_mix_update_own"
  on "public"."engine_cycle_program_mix"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_season_awards_select_own"
  on "public"."engine_cycle_season_awards"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_season_summaries_select_own"
  on "public"."engine_cycle_season_summaries"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_sessions_insert_own"
  on "public"."engine_cycle_sessions"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_sessions_select_own"
  on "public"."engine_cycle_sessions"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_sessions_update_own"
  on "public"."engine_cycle_sessions"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_cycle_transitions_select_own"
  on "public"."engine_cycle_transitions"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_gamification_states_insert_own"
  on "public"."engine_gamification_states"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_gamification_states_select_own"
  on "public"."engine_gamification_states"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_gamification_states_update_own"
  on "public"."engine_gamification_states"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_progression_states_delete_own"
  on "public"."engine_progression_states"
  as permissive
  for delete
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_progression_states_insert_own"
  on "public"."engine_progression_states"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_progression_states_select_own"
  on "public"."engine_progression_states"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_progression_states_update_own"
  on "public"."engine_progression_states"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "engine_session_traces_select_own"
  on "public"."engine_session_traces"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "exercise_muscle_map_select_authenticated"
  on "public"."exercise_muscle_map"
  as permissive
  for select
  to authenticated
using (true);



  create policy "exercises_select_authenticated"
  on "public"."exercises"
  as permissive
  for select
  to authenticated
using (true);



  create policy "muscle_groups_select_authenticated"
  on "public"."muscle_groups"
  as permissive
  for select
  to authenticated
using (true);



  create policy "program_days_select_authenticated"
  on "public"."program_days"
  as permissive
  for select
  to authenticated
using (true);



  create policy "program_slots_select_authenticated"
  on "public"."program_slots"
  as permissive
  for select
  to authenticated
using (true);



  create policy "programs_select_authenticated"
  on "public"."programs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "set_logs_insert_own"
  on "public"."set_logs"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.workout_logs wl
  WHERE ((wl.id = set_logs.workout_log_id) AND (wl.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "set_logs_select_own"
  on "public"."set_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.workout_logs wl
  WHERE ((wl.id = set_logs.workout_log_id) AND (wl.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "users_insert_own"
  on "public"."users"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "users_select_own"
  on "public"."users"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) = id));



  create policy "users_update_own"
  on "public"."users"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = id))
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "workout_logs_insert_own"
  on "public"."workout_logs"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "workout_logs_select_own"
  on "public"."workout_logs"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
