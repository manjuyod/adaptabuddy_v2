import { z } from "zod";
export const CanonicalClassArchetypeSchema = z.enum(["strength", "hybrid"]);
export const ClassPresetIdSchema = z.enum([
  "classless",
  "bb",
  "powa",
  "ninja",
  "monk",
]);
export const SelectableClassPresetIdSchema = z.enum([
  "classless",
  "bb",
  "powa",
  "ninja",
]);

export type CanonicalClassArchetype = z.infer<typeof CanonicalClassArchetypeSchema>;
export type ClassPresetId = z.infer<typeof ClassPresetIdSchema>;
export type SelectableClassPresetId = z.infer<typeof SelectableClassPresetIdSchema>;

export const SelectedProgramSchema = z.object({
  programId: z.number().int().positive(),
  weight: z.number().gt(0).lte(1),
});

export const InitializeCycleRequestSchema = z.object({
  classPresetId: SelectableClassPresetIdSchema,
  goalBias: z.string().min(1),
  availableDaysPerWeek: z.number().int().min(1).max(7),
  fatiguePreference: z.enum(["low", "moderate", "high"]),
  injuryMuscleGroupSlugs: z.array(z.string().min(1)).default([]),
  macrocycleWeeks: z.number().int().min(1).max(52).default(12),
  selectedPrograms: z.array(SelectedProgramSchema).min(1),
});

export type InitializeCycleRequest = z.infer<typeof InitializeCycleRequestSchema>;

export const SessionOutcomeClassificationSchema = z.enum([
  "complete_clean",
  "complete_compromised",
  "partial",
  "missed",
]);

export type SessionOutcomeClassification = z.infer<
  typeof SessionOutcomeClassificationSchema
>;

export const NormalizedGamificationStateSchema = z.object({
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  adherenceStreak: z.number().int().min(0),
  completedSessionCount: z.number().int().min(0),
  missedSessionCount: z.number().int().min(0),
  lastAdherenceOutcomeClassification:
    SessionOutcomeClassificationSchema.nullable(),
  lastAwardedAt: z.string().datetime().nullable(),
});

export type NormalizedGamificationState = z.infer<
  typeof NormalizedGamificationStateSchema
>;

export const NormalizedProgressionStateRowSchema = z.object({
  exerciseId: z.string().min(1),
  currentAction: z.enum(["overload", "maintain", "regress", "swap"]),
  trend: z.enum(["improving", "stalled", "regressing", "blocked"]),
  lastSuccessfulLoadWeight: z.number().nullable(),
  lastSuccessfulLoadReps: z.number().int().min(0).nullable(),
  consecutiveSuccessfulCompletions: z.number().int().min(0),
  consecutiveStallOrRegressionCount: z.number().int().min(0),
  swapRecommendationCount: z.number().int().min(0),
  lastSessionOutcomeClassification: SessionOutcomeClassificationSchema,
  lastCompletedAt: z.string().datetime(),
});

export type NormalizedProgressionStateRow = z.infer<
  typeof NormalizedProgressionStateRowSchema
>;

export const InitializeCycleResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    planId: z.string(),
    resolvedClassArchetype: CanonicalClassArchetypeSchema,
    primaryProgramId: z.string(),
    totalSessions: z.number().int().min(0),
  }).strict(),
  z.object({
    status: z.literal("error"),
    errors: z.array(z.string()).min(1),
  }).strict(),
]);

export type InitializeCycleResponse = z.infer<typeof InitializeCycleResponseSchema>;
