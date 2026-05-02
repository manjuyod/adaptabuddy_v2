import { z } from "zod";

// ============================================================================
// Muscle Groups
// ============================================================================

export const MuscleGroupRowSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1)
});

export type MuscleGroupRow = z.infer<typeof MuscleGroupRowSchema>;

// ============================================================================
// Exercises
// ============================================================================

export const ExerciseRowSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  movement_pattern: z.string().min(1),
  equipment: z.array(z.string()).default([]),
  is_bodyweight: z.boolean().default(false),
  aliases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  media: z.record(z.string(), z.unknown()).default({}),
  contraindications: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  created_at: z.string().optional()
});

export type ExerciseRow = z.infer<typeof ExerciseRowSchema>;

// ============================================================================
// Exercise-Muscle Mapping
// ============================================================================

export const ExerciseMuscleMapRowSchema = z.object({
  exercise_id: z.number().int().positive(),
  muscle_group_id: z.number().int().positive(),
  role: z.enum(["primary", "secondary", "stabilizer"]).default("primary"),
  contribution: z.number().min(0).max(1).default(1.0)
});

export type ExerciseMuscleMapRow = z.infer<typeof ExerciseMuscleMapRowSchema>;

// ============================================================================
// Programs
// ============================================================================

export const ProgramRowSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  program_type: z.enum(["template", "slot_based", "hybrid"]).default("hybrid"),
  min_days_per_week: z.number().int().min(1).max(7).default(3),
  max_days_per_week: z.number().int().min(1).max(7).default(6),
  default_days_per_week: z.number().int().min(1).max(7).default(4),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
  created_at: z.string().optional()
});

export type ProgramRow = z.infer<typeof ProgramRowSchema>;

// ============================================================================
// Program Days
// ============================================================================

export const ProgramDayRowSchema = z.object({
  id: z.number().int().positive(),
  program_id: z.number().int().positive(),
  day_index: z.number().int().min(0),
  name: z.string().min(1),
  theme_tags: z.array(z.string()).default([])
});

export type ProgramDayRow = z.infer<typeof ProgramDayRowSchema>;

// ============================================================================
// Program Slots
// ============================================================================

export const MuscleTargetsSchema = z.record(
  z.string(), // muscle_group slug
  z.number().min(0).max(1) // target contribution weight
);

export type MuscleTargets = z.infer<typeof MuscleTargetsSchema>;

export const ProgramSlotRowSchema = z.object({
  id: z.number().int().positive(),
  program_day_id: z.number().int().positive(),
  slot_index: z.number().int().min(0),
  slot_type: z.enum(["main", "accessory", "conditioning", "warmup", "cooldown"]).default("accessory"),
  lock_type: z.enum(["locked", "flex", "user_choice"]).default("flex"),
  locked_exercise_id: z.number().int().positive().nullable().optional(),
  movement_pattern: z.string().nullable().optional(),
  equipment_allowed: z.array(z.string()).default([]),
  tags_required: z.array(z.string()).default([]),
  tags_blocked: z.array(z.string()).default([]),
  sets_min: z.number().int().min(1).default(2),
  sets_max: z.number().int().min(1).default(4),
  reps_min: z.number().int().min(1).default(6),
  reps_max: z.number().int().min(1).default(12),
  rir_min: z.number().int().min(0).nullable().optional(),
  rir_max: z.number().int().min(0).nullable().optional(),
  muscle_targets: MuscleTargetsSchema.default({}),
  prescription: z.record(z.string(), z.unknown()).default({}),
  is_optional: z.boolean().default(false)
});

export type ProgramSlotRow = z.infer<typeof ProgramSlotRowSchema>;

// ============================================================================
// Workout Logs
// ============================================================================

export const WorkoutLogRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  user_id: z.string().uuid(),
  program_id: z.coerce.number().int().positive().nullable().optional(),
  program_day_id: z.coerce.number().int().positive().nullable().optional(),
  completed_at: z.string().min(1),
  duration_seconds: z.coerce.number().int().min(0).nullable().optional(),
  total_volume: z.coerce.number().min(0).nullable().optional(),
  seed: z.string().nullable().optional(),
  idempotency_key: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export type WorkoutLogRow = z.infer<typeof WorkoutLogRowSchema>;

// ============================================================================
// Set Logs
// ============================================================================

export const SetLogRowSchema = z.object({
  id: z.coerce.number().int().positive(),
  workout_log_id: z.coerce.number().int().positive(),
  exercise_id: z.coerce.number().int().positive(),
  set_number: z.coerce.number().int().min(1),
  weight: z.coerce.number().min(0),
  reps: z.coerce.number().int().min(0),
  rpe: z.coerce.number().min(0).max(10).nullable().optional(),
  rir: z.coerce.number().int().min(0).max(10).nullable().optional(),
  failed: z.boolean().default(false),
  created_at: z.string().optional()
});

export type SetLogRow = z.infer<typeof SetLogRowSchema>;
