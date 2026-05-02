import { z } from "zod";
import { UserOptInSchema, DEFAULT_OPT_INS } from "./optins";
import { EntityIdSchema } from "./ids";
import {
  FatigueLevelSchema,
  UnitSystemSchema,
  ThemePreferenceSchema,
} from "./preferences";

// ============================================================================
// Active Program Tracking
// ============================================================================

// Legacy compatibility projection stored in users.stats_json.
// Normalized cycle tables remain canonical once a cycle has been initialized,
// including richer Engine 14 gamification state that should not be mirrored here.
export const ActiveProgramSchema = z.object({
  programId: EntityIdSchema,
  startedAt: z.string().datetime(),
  currentDayIndex: z.number().int().min(0),
  currentMicrocycle: z.number().int().min(1),
  daysPerWeek: z.number().int().min(1).max(7),
});

export type ActiveProgram = z.infer<typeof ActiveProgramSchema>;

// ============================================================================
// Fatigue per Muscle Group
// ============================================================================

export const MuscleFatigueSchema = z.object({
  current: z.number().min(0).max(100),
  lastUpdated: z.string().datetime(),
});

export type MuscleFatigue = z.infer<typeof MuscleFatigueSchema>;

// ============================================================================
// Mastery per Exercise
// ============================================================================

export const ExerciseMasterySchema = z.object({
  score: z.number().min(0),
  totalSets: z.number().int().min(0),
  lastUpdated: z.string().datetime(),
});

export type ExerciseMastery = z.infer<typeof ExerciseMasterySchema>;

// ============================================================================
// Capacity per Exercise (for Progression)
// ============================================================================

export const ExerciseCapacitySchema = z.object({
  estimated1RM: z.number().positive().nullable(),
  lastWeight: z.number().positive().nullable(),
  lastReps: z.number().int().positive().nullable(),
  confidence: z.number().min(0).max(1),
  lastPerformed: z.string().datetime().nullable(),
});

export type ExerciseCapacity = z.infer<typeof ExerciseCapacitySchema>;

// ============================================================================
// Progression Stats
// ============================================================================

export const ProgressionSchema = z.object({
  totalWorkouts: z.number().int().min(0),
  weeklyVolume: z.number().min(0),
  lastWorkoutAt: z.string().datetime().nullable(),
});

export type Progression = z.infer<typeof ProgressionSchema>;

// ============================================================================
// User Preferences
// ============================================================================

export const UserPreferencesSchema = z.object({
  fatigueLevel: FatigueLevelSchema,
  equipment: z.array(z.string()),
  injuries: z.array(z.string()),
  acknowledgedRisks: z.array(z.string()),
  optIns: UserOptInSchema.default(DEFAULT_OPT_INS),
  unitSystem: UnitSystemSchema.optional(),
  theme: ThemePreferenceSchema.optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// ============================================================================
// Complete User Stats
// ============================================================================

export const UserStatsSchema = z.object({
  activeProgram: ActiveProgramSchema.nullable(),
  fatigue: z.record(z.string(), MuscleFatigueSchema),
  mastery: z.record(z.string(), ExerciseMasterySchema),
  capacities: z.record(z.string(), ExerciseCapacitySchema),
  progression: ProgressionSchema,
  preferences: UserPreferencesSchema,
});

export type UserStats = z.infer<typeof UserStatsSchema>;
