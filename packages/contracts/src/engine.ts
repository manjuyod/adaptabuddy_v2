import { z } from "zod";

// ============================================================================
// Slot Context (Input for Slot Filling)
// ============================================================================

export const SlotContextSchema = z.object({
  equipment: z.array(z.string()),
  injuries: z.array(z.string()),
  fatigue: z.record(z.string(), z.number().min(0).max(100)),
  excludeExerciseIds: z.array(z.string().min(1)),
  fatigueLevel: z.enum(["light", "moderate", "hard", "brutal"]),
});

export type SlotContext = z.infer<typeof SlotContextSchema>;

// ============================================================================
// Score Breakdown (for Transparency)
// ============================================================================

export const ScoreBreakdownSchema = z.object({
  muscleNeed: z.number(),
  fatigueCapacity: z.number(),
  equipmentMatch: z.number(),
  tagBonus: z.number(),
  tagPenalty: z.number(),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

// ============================================================================
// Scored Exercise Candidate
// ============================================================================

export const ScoredExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  exerciseSlug: z.string(),
  exerciseName: z.string(),
  score: z.number(),
  breakdown: ScoreBreakdownSchema,
});

export type ScoredExercise = z.infer<typeof ScoredExerciseSchema>;

// ============================================================================
// Filled Slot (Selected Exercise for a Slot)
// ============================================================================

export const FilledSlotSchema = z.object({
  slotId: z.string().min(1),
  slotIndex: z.number().int().min(0),
  slotType: z.string(),
  exerciseId: z.string().min(1),
  exerciseSlug: z.string(),
  exerciseName: z.string(),
  setsMin: z.number().int().min(1),
  setsMax: z.number().int().min(1),
  repsMin: z.number().int().min(1),
  repsMax: z.number().int().min(1),
  restSeconds: z.number().int().min(0),
  score: z.number(),
  rationale: z.string(),
});

export type FilledSlot = z.infer<typeof FilledSlotSchema>;

// ============================================================================
// Generated Session
// ============================================================================

export const GeneratedSessionSchema = z.object({
  programDayId: z.string().min(1),
  programDayName: z.string(),
  seed: z.string(),
  generatedAt: z.string().datetime(),
  slots: z.array(FilledSlotSchema),
  projectedFatigueCost: z.record(z.string(), z.number()),
});

export type GeneratedSession = z.infer<typeof GeneratedSessionSchema>;

// ============================================================================
// Load Recommendation
// ============================================================================

export const LoadRecommendationSchema = z.object({
  exerciseId: z.string().min(1),
  recommendedWeight: z.number().nullable(),
  recommendedReps: z.number().int().positive(),
  targetRir: z.number().int().min(0).max(5),
  reasoning: z.string(),
  isProgression: z.boolean(),
});

export type LoadRecommendation = z.infer<typeof LoadRecommendationSchema>;

// ============================================================================
// Set Log (Logging a Single Set)
// ============================================================================

export const SetLogSchema = z.object({
  setIndex: z.number().int().min(0),
  weight: z.number().min(0),
  reps: z.number().int().min(0),
  rir: z.number().int().min(0).max(10).nullable(),
  notes: z.string().optional(),
});

export type SetLog = z.infer<typeof SetLogSchema>;

// ============================================================================
// Exercise Log (All Sets for an Exercise)
// ============================================================================

export const ExerciseLogSchema = z.object({
  slotId: z.string().min(1),
  exerciseId: z.string().min(1),
  sets: z.array(SetLogSchema),
});

export type ExerciseLog = z.infer<typeof ExerciseLogSchema>;

// ============================================================================
// Completed Session (Full Session Submission)
// ============================================================================

export const CompletedSessionSchema = z.object({
  programDayId: z.string().min(1),
  seed: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  exercises: z.array(ExerciseLogSchema),
  overallRpe: z.number().min(1).max(10).nullable(),
  notes: z.string().optional(),
});

export type CompletedSession = z.infer<typeof CompletedSessionSchema>;

// ============================================================================
// Stats Update (Atomic Stats Update Deltas)
// ============================================================================

export const StatsUpdateSchema = z.object({
  fatigueUpdates: z.record(z.string(), z.object({
    current: z.number().min(0).max(100),
    lastUpdated: z.string().datetime(),
  })),
  masteryUpdates: z.record(z.string(), z.object({
    scoreDelta: z.number(),
    setsDelta: z.number().int(),
    lastUpdated: z.string().datetime(),
  })),
  capacityUpdates: z.record(z.string(), z.object({
    estimated1RM: z.number().positive().nullable(),
    lastWeight: z.number().positive().nullable(),
    lastReps: z.number().int().positive().nullable(),
    confidence: z.number().min(0).max(1),
    lastPerformed: z.string().datetime(),
  })),
  progressionUpdate: z.object({
    workoutsDelta: z.number().int(),
    volumeDelta: z.number(),
    lastWorkoutAt: z.string().datetime(),
  }),
  dayIndexAdvance: z.number().int().min(0).nullable(),
});

export type StatsUpdate = z.infer<typeof StatsUpdateSchema>;
