import { z } from "zod";
import { UnitSystemSchema } from "./preferences";
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
export const GoalBiasSchema = z.enum([
  "strength",
  "hypertrophy",
  "balanced",
  "conditioning",
]);
export const InjuryMuscleGroupSlugSchema = z.string().trim().min(1).max(64);

export type CanonicalClassArchetype = z.infer<
  typeof CanonicalClassArchetypeSchema
>;
export type ClassPresetId = z.infer<typeof ClassPresetIdSchema>;
export type SelectableClassPresetId = z.infer<
  typeof SelectableClassPresetIdSchema
>;
export type GoalBias = z.infer<typeof GoalBiasSchema>;

export const SelectedProgramSchema = z.object({
  programId: z.number().int().positive(),
  weight: z.number().gt(0).lte(1),
});

export const ChallengeBaselineSchema = z
  .object({
    maxReps: z.number().int().min(0).max(10000),
  })
  .strict();

export const StrengthBaselineSchema = z
  .object({
    estimatedOneRepMax: z.number().positive(),
    unit: UnitSystemSchema,
    source: z.string().trim().min(1).max(96).optional(),
  })
  .strict();

export const StrengthBaselinesSchema = z
  .object({
    squat: StrengthBaselineSchema,
    deadlift: StrengthBaselineSchema,
    bench_press: StrengthBaselineSchema,
    overhead_press: StrengthBaselineSchema,
  })
  .strict();

export const ProgramAdaptationInputsSchema = z
  .object({
    challengeBaselines: z
      .record(InjuryMuscleGroupSlugSchema, ChallengeBaselineSchema)
      .default({}),
    strengthBaselines: StrengthBaselinesSchema.optional(),
  })
  .strict();

export type ProgramAdaptationInputs = z.infer<
  typeof ProgramAdaptationInputsSchema
>;

const requireUniqueSelectedProgramIds = (
  selectedPrograms: Array<{ programId: number }>,
  ctx: z.RefinementCtx,
) => {
  const seen = new Set<number>();
  for (const [index, selection] of selectedPrograms.entries()) {
    if (seen.has(selection.programId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectedPrograms", index, "programId"],
        message: "Program selections must be unique",
      });
      return;
    }
    seen.add(selection.programId);
  }
};

export const InitializeCycleRequestSchema = z
  .object({
    classPresetId: SelectableClassPresetIdSchema,
    goalBias: GoalBiasSchema,
    availableDaysPerWeek: z.number().int().min(1).max(7),
    fatiguePreference: z.enum(["low", "moderate", "high"]),
    injuryMuscleGroupSlugs: z
      .array(InjuryMuscleGroupSlugSchema)
      .max(24)
      .default([]),
    macrocycleWeeks: z.number().int().min(1).max(52).default(12),
    selectedPrograms: z.array(SelectedProgramSchema).min(1).max(12),
    programAdaptationInputs: ProgramAdaptationInputsSchema.optional(),
  })
  .superRefine((value, ctx) => {
    requireUniqueSelectedProgramIds(value.selectedPrograms, ctx);
  });

export type InitializeCycleRequest = z.infer<
  typeof InitializeCycleRequestSchema
>;

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
  z
    .object({
      status: z.literal("success"),
      planId: z.string(),
      resolvedClassArchetype: CanonicalClassArchetypeSchema,
      primaryProgramId: z.string(),
      totalSessions: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      status: z.literal("error"),
      errors: z.array(z.string()).min(1),
    })
    .strict(),
]);

export type InitializeCycleResponse = z.infer<
  typeof InitializeCycleResponseSchema
>;

export const SeasonRankSchema = z.enum(["S", "A", "B", "C", "D"]);

export type SeasonRank = z.infer<typeof SeasonRankSchema>;

export const SeasonSummarySchema = z
  .object({
    planId: z.string().min(1),
    seasonIndex: z.number().int().min(1),
    completedSessions: z.number().int().min(0),
    missedSessions: z.number().int().min(0),
    totalSessions: z.number().int().min(0),
    completionRate: z.number().min(0).max(1),
    progressionTrend: z
      .enum(["improving", "stalled", "regressing", "blocked"])
      .default("stalled"),
    recoveryStatus: z
      .enum(["recoverable", "strained", "overreached", "injury_constrained"])
      .default("recoverable"),
  })
  .strict();

export type SeasonSummary = z.infer<typeof SeasonSummarySchema>;

export const RankBreakdownSchema = z
  .object({
    adherenceScore: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(100),
    progressionScore: z.number().min(0).max(100),
    recoveryScore: z.number().min(0).max(100),
    consistencyScore: z.number().min(0).max(100),
    constraintModifier: z.number().min(-25).max(25),
    finalScore: z.number().min(0).max(100),
    rank: SeasonRankSchema,
  })
  .strict();

export type RankBreakdown = z.infer<typeof RankBreakdownSchema>;

export const SeasonAwardSchema = z
  .object({
    id: z.string().min(1).max(96),
    label: z.string().min(1).max(120),
    reason: z.string().min(1).max(240),
    xp: z.number().int().min(0),
  })
  .strict();

export type SeasonAward = z.infer<typeof SeasonAwardSchema>;

export const NextCyclePreviewSchema = z
  .object({
    rankEffect: z.string().min(1).max(120),
    programBlendDirection: z.string().min(1).max(120),
    difficultyAdjustment: z.number().int().min(-3).max(3),
    recoveryAdjustment: z.number().int().min(-3).max(3),
    unlockEligibility: z.array(z.string().min(1).max(96)).default([]),
    constraintNotes: z.array(z.string().min(1).max(160)).default([]),
  })
  .strict();

export type NextCyclePreview = z.infer<typeof NextCyclePreviewSchema>;

export const AdvanceCycleRequestSchema = z
  .object({
    planId: z.string().min(1).max(64).optional(),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
    currentCycleRequest: InitializeCycleRequestSchema.optional(),
    programAdaptationInputs: ProgramAdaptationInputsSchema.optional(),
    completedSessionCount: z.number().int().min(0).optional(),
    missedSessionCount: z.number().int().min(0).optional(),
  })
  .strict();

export type AdvanceCycleRequest = z.infer<typeof AdvanceCycleRequestSchema>;

export const SeasonTransitionReadModelSchema = z
  .object({
    transitionId: z.string().min(1),
    planId: z.string().min(1),
    seasonIndex: z.number().int().min(1),
    seasonRank: SeasonRankSchema,
    awardedXp: z.number().int().min(0),
    seasonSummary: SeasonSummarySchema,
    awards: z.array(SeasonAwardSchema),
    nextCycleRequest: InitializeCycleRequestSchema,
    nextCyclePreview: NextCyclePreviewSchema,
    replayReceipt: z.record(z.unknown()),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export type SeasonTransitionReadModel = z.infer<
  typeof SeasonTransitionReadModelSchema
>;

export const AdvanceCycleResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("success"),
      planId: z.string().min(1),
      seasonIndex: z.number().int().min(1),
      seasonRank: SeasonRankSchema,
      rankBreakdown: RankBreakdownSchema,
      awardedXp: z.number().int().min(0),
      awards: z.array(SeasonAwardSchema),
      seasonSummary: SeasonSummarySchema,
      nextCycleRequest: InitializeCycleRequestSchema,
      nextCyclePreview: NextCyclePreviewSchema,
      transitionId: z.string().min(1),
      replayReceipt: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      status: z.literal("error"),
      errors: z.array(z.string()).min(1),
    })
    .strict(),
]);

export type AdvanceCycleResponse = z.infer<typeof AdvanceCycleResponseSchema>;
