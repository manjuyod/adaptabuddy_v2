import { z } from "zod";
import {
  CanonicalClassArchetypeSchema,
  ClassPresetIdSchema,
  NormalizedGamificationStateSchema,
  NormalizedProgressionStateRowSchema,
  SessionOutcomeClassificationSchema,
} from "./cycles";

export const DecisionInputRefSchema = z.object({
  path: z.string().min(1),
  stableId: z.string().min(1).optional(),
});

export type DecisionInputRef = z.infer<typeof DecisionInputRefSchema>;

export const DecisionLogEntrySchema = z.object({
  stepType: z.string().min(1),
  ruleId: z.string().min(1),
  inputsUsed: z.array(DecisionInputRefSchema).default([]),
  candidateId: z.string().min(1).optional(),
  computedValue: z.number().optional(),
  outcome: z.string().min(1),
  details: z.unknown().optional(),
});

export type DecisionLogEntry = z.infer<typeof DecisionLogEntrySchema>;

export const ReplayReceiptSchema = z.object({
  inputHash: z.string().min(1),
  outputHash: z.string().min(1),
  seedUsed: z.string().min(1),
  effectiveAt: z.string().datetime(),
  implementationVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  referenceHash: z.string().min(1),
});

export type ReplayReceipt = z.infer<typeof ReplayReceiptSchema>;

export const ReplayDebugReferenceSchema = z.object({
  traceId: z.string().min(1),
  inputHash: z.string().min(1),
  outputHash: z.string().min(1),
  seedUsed: z.string().min(1),
  effectiveAt: z.string().datetime(),
  implementationVersion: z.string().min(1),
  policyVersion: z.string().min(1),
  referenceHash: z.string().min(1),
});

export type ReplayDebugReference = z.infer<typeof ReplayDebugReferenceSchema>;

const ReplayDebugInputMaterialUnavailableReasonSchema = z.enum([
  "not_app_persisted",
  "invalid_shape",
]);

const ReplayDebugBundleUnavailableReasonSchema = z.enum([
  "trace_not_found",
  "missing_replay_receipt",
  "missing_engine_result",
  "missing_input_material",
  "invalid_trace_material",
]);

export const ReplayDebugInputMaterialAvailableSchema = z.object({
  availability: z.literal("available"),
  source: z.string().min(1),
  material: z.record(z.string(), z.unknown()),
});

export const ReplayDebugInputMaterialUnavailableSchema = z.object({
  availability: z.literal("unavailable"),
  reason: ReplayDebugInputMaterialUnavailableReasonSchema,
  source: z.literal("app_input"),
});

export const ReplayDebugInputMaterialSchema = z.discriminatedUnion("availability", [
  ReplayDebugInputMaterialAvailableSchema,
  ReplayDebugInputMaterialUnavailableSchema,
]);

export type ReplayDebugInputMaterial = z.infer<typeof ReplayDebugInputMaterialSchema>;
export type ReplayDebugInputMaterialUnavailableReason = z.infer<
  typeof ReplayDebugInputMaterialUnavailableReasonSchema
>;
export type ReplayDebugBundleUnavailableReason = z.infer<
  typeof ReplayDebugBundleUnavailableReasonSchema
>;

const ReplayDebugBundleContextSchema = z.object({
  operation: z.enum(["plan_session", "complete_session", "advance_cycle"]),
  traceId: z.string().min(1),
  cyclePlanId: z.string().nullable(),
  cycleSessionId: z.string().nullable(),
  workoutLogId: z.string().nullable(),
});

export const ReplayDebugBundleAvailableSchema = ReplayDebugBundleContextSchema.extend({
  availability: z.literal("available"),
  schemaVersion: z.string().min(1).nullable(),
  canonicalizationVersion: z.string().min(1).nullable(),
  ruleVersion: z.string().min(1).nullable(),
  replayReceipt: ReplayReceiptSchema,
  referenceHash: z.string().min(1),
  policyVersion: z.string().min(1),
  decisionLog: z.array(DecisionLogEntrySchema),
  engineResult: z.record(z.string(), z.unknown()),
  inputMaterial: ReplayDebugInputMaterialSchema,
});

export const ReplayDebugBundleUnavailableSchema = z.object({
  availability: z.literal("unavailable"),
  reason: ReplayDebugBundleUnavailableReasonSchema,
  operation: z.enum(["plan_session", "complete_session", "advance_cycle"]),
  traceId: z.string().min(1),
  cyclePlanId: z.string().nullable(),
  cycleSessionId: z.string().nullable(),
  workoutLogId: z.string().nullable(),
  decisionLog: z.array(DecisionLogEntrySchema),
  engineResult: z.record(z.string(), z.unknown()).nullable(),
  replayReceipt: ReplayReceiptSchema.nullable(),
  schemaVersion: z.string().min(1).nullable(),
  canonicalizationVersion: z.string().min(1).nullable(),
  ruleVersion: z.string().min(1).nullable(),
  referenceHash: z.string().nullable(),
  policyVersion: z.string().nullable(),
  inputMaterial: ReplayDebugInputMaterialSchema,
});

export const ReplayDebugBundleSchema = z.discriminatedUnion("availability", [
  ReplayDebugBundleAvailableSchema,
  ReplayDebugBundleUnavailableSchema,
]);

export type ReplayDebugBundle = z.infer<typeof ReplayDebugBundleSchema>;
export type ReplayDebugBundleAvailable = z.infer<typeof ReplayDebugBundleAvailableSchema>;
export type ReplayDebugBundleUnavailable = z.infer<typeof ReplayDebugBundleUnavailableSchema>;

export const PersistedSessionTraceSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.string().min(1),
  operation: z.enum(["plan_session", "complete_session", "advance_cycle"]),
  cyclePlanId: z.coerce.number().int().positive().nullable(),
  cycleSessionId: z.coerce.number().int().positive().nullable(),
  workoutLogId: z.coerce.number().int().positive().nullable(),
  inputMaterial: z.record(z.string(), z.unknown()).nullable().optional(),
  decisionLog: z.array(DecisionLogEntrySchema),
  replayReceipt: ReplayReceiptSchema,
  engineResult: z.record(z.string(), z.unknown()),
});

export type PersistedSessionTrace = z.infer<typeof PersistedSessionTraceSchema>;

export const ProgressionChangeSummarySchema = z.object({
  exerciseId: z.string().min(1),
  action: z.enum(["overload", "maintain", "regress", "swap"]),
  trend: z.enum(["improving", "stalled", "regressing", "blocked"]),
});

export type ProgressionChangeSummary = z.infer<typeof ProgressionChangeSummarySchema>;

export const PlanSessionExplanationReadModelSchema = z.object({
  sessionRationale: z.string().min(1),
  recommendedMovementFamily: z.string().min(1),
  selectedExerciseIds: z.array(z.string().min(1)),
  progressionChanges: z.array(ProgressionChangeSummarySchema),
  scope: z
    .object({
      ruleId: z.string().min(1),
      outcome: z.string().min(1),
      resolvedFocus: z.string().nullable(),
      preferredScopeBucket: z.string().nullable(),
      survivingScopeBucket: z.string().nullable(),
      wideningApplied: z.boolean().nullable(),
    })
    .nullable(),
  filter: z
    .object({
      ruleId: z.string().min(1),
      outcome: z.string().min(1),
      evaluatedCandidateIds: z.array(z.string().min(1)),
      survivingCandidateIds: z.array(z.string().min(1)),
      blockedCandidateIds: z.array(z.string().min(1)),
    })
    .nullable(),
  tieBreak: z
    .object({
      ruleId: z.string().min(1),
      outcome: z.string().min(1),
      selectedCandidateId: z.string().nullable(),
      eligibleCandidateIds: z.array(z.string().min(1)),
      topScore: z.number().nullable(),
      bandWidth: z.number().nullable(),
    })
    .nullable(),
  replayReference: ReplayDebugReferenceSchema,
});

export type PlanSessionExplanationReadModel = z.infer<
  typeof PlanSessionExplanationReadModelSchema
>;

export const WorkoutCompletionExplanationReadModelSchema = z.object({
  sessionOutcomeClassification: SessionOutcomeClassificationSchema,
  warnings: z.array(z.string()),
  progressionChanges: z.array(ProgressionChangeSummarySchema),
  xp: z.object({
    xpDelta: z.number().int(),
    streakDelta: z.number().int(),
    reason: z.string().min(1),
  }),
  primaryExerciseId: z.string().min(1).nullable(),
  touchedBuckets: z.array(z.string().min(1)),
});

export type WorkoutCompletionExplanationReadModel = z.infer<
  typeof WorkoutCompletionExplanationReadModelSchema
>;

export const ActiveCycleReportingReadModelSchema = z.object({
  cyclePlanId: z.string().min(1),
  classContext: z.object({
    resolvedClassArchetype: CanonicalClassArchetypeSchema.nullable(),
    classPresetId: ClassPresetIdSchema.nullable(),
  }),
  adherence: NormalizedGamificationStateSchema.pick({
    adherenceStreak: true,
    completedSessionCount: true,
    missedSessionCount: true,
    lastAdherenceOutcomeClassification: true,
    lastAwardedAt: true,
    xp: true,
    level: true,
  }),
  cycleProgress: z.object({
    currentSessionIndex: z.number().int().min(0),
    currentMicrocycleIndex: z.number().int().min(0).nullable(),
    totalSessions: z.number().int().min(0),
    completedSessions: z.number().int().min(0),
    remainingSessions: z.number().int().min(0),
    nextSessionIndex: z.number().int().min(0).nullable(),
  }),
  progression: z.object({
    totalExercises: z.number().int().min(0),
    improvingCount: z.number().int().min(0),
    stalledCount: z.number().int().min(0),
    regressingCount: z.number().int().min(0),
    blockedCount: z.number().int().min(0),
    swapRecommendationCount: z.number().int().min(0),
    exercises: z.array(NormalizedProgressionStateRowSchema),
  }),
});

export type ActiveCycleReportingReadModel = z.infer<
  typeof ActiveCycleReportingReadModelSchema
>;

export const CycleCompletionAnalyticsSchema = z.object({
  currentSessionIndex: z.number().int().min(0),
  currentMicrocycleIndex: z.number().int().min(0).nullable(),
  totalSessions: z.number().int().min(0),
  completedSessions: z.number().int().min(0),
  remainingSessions: z.number().int().min(0),
  nextSessionIndex: z.number().int().min(0).nullable(),
  completionPercentage: z.number().min(0).max(100),
});

export type CycleCompletionAnalytics = z.infer<
  typeof CycleCompletionAnalyticsSchema
>;

export const AdherenceAnalyticsSchema = z.object({
  streak: z.number().int().min(0),
  completedCount: z.number().int().min(0),
  missedCount: z.number().int().min(0),
  lastOutcome: SessionOutcomeClassificationSchema.nullable(),
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
});

export type AdherenceAnalytics = z.infer<typeof AdherenceAnalyticsSchema>;

const ProgressionTrendCountsSchema = z.object({
  improving: z.number().int().min(0),
  stalled: z.number().int().min(0),
  regressing: z.number().int().min(0),
  blocked: z.number().int().min(0),
});

const ProgressionActionCountsSchema = z.object({
  overload: z.number().int().min(0),
  maintain: z.number().int().min(0),
  regress: z.number().int().min(0),
  swap: z.number().int().min(0),
});

const ProgressionAnalyticsExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  action: z.enum(["overload", "maintain", "regress", "swap"]),
  trend: z.enum(["improving", "stalled", "regressing", "blocked"]),
  swapRecommendationCount: z.number().int().min(0),
  lastOutcome: SessionOutcomeClassificationSchema,
  lastCompletedAt: z.string().datetime(),
});

export const ProgressionAnalyticsSchema = z.object({
  totalExercises: z.number().int().min(0),
  trendCounts: ProgressionTrendCountsSchema,
  actionCounts: ProgressionActionCountsSchema,
  swapPressure: z.object({
    affectedExerciseCount: z.number().int().min(0),
    recommendationCount: z.number().int().min(0),
    exerciseIds: z.array(z.string().min(1)),
  }),
  exercises: z.array(ProgressionAnalyticsExerciseSchema),
});

export type ProgressionAnalytics = z.infer<typeof ProgressionAnalyticsSchema>;

export const RecentSessionAnalyticsSchema = z.object({
  workoutLogId: z.number().int().positive(),
  completedAt: z.string().datetime(),
  dayName: z.string().min(1),
  durationSeconds: z.number().int().min(0).nullable(),
  totalVolume: z.number().min(0).nullable(),
  setCount: z.number().int().min(0),
  seed: z.string().min(1).nullable(),
});

export type RecentSessionAnalytics = z.infer<
  typeof RecentSessionAnalyticsSchema
>;

export const FatigueSummaryItemSchema = z.object({
  muscle: z.string().min(1),
  current: z.number().min(0),
  severity: z.enum(["low", "moderate", "high"]),
});

export type FatigueSummaryItem = z.infer<typeof FatigueSummaryItemSchema>;

export const FatigueSummarySchema = z.object({
  items: z.array(FatigueSummaryItemSchema),
});

export type FatigueSummary = z.infer<typeof FatigueSummarySchema>;

export const CapacityTimelinePointSchema = z.object({
  date: z.string().datetime(),
  estimated1RM: z.number().positive(),
});

export type CapacityTimelinePoint = z.infer<typeof CapacityTimelinePointSchema>;

export const CapacityTimelineSeriesSchema = z.object({
  exerciseId: z.string().min(1),
  exerciseLabel: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable(),
  points: z.array(CapacityTimelinePointSchema),
});

export type CapacityTimelineSeries = z.infer<typeof CapacityTimelineSeriesSchema>;

export const CapacityTimelineSchema = z.object({
  series: z.array(CapacityTimelineSeriesSchema),
});

export type CapacityTimeline = z.infer<typeof CapacityTimelineSchema>;

export const WeeklyVolumeSummaryItemSchema = z.object({
  muscle: z.string().min(1),
  sets: z.number().min(0),
});

export type WeeklyVolumeSummaryItem = z.infer<typeof WeeklyVolumeSummaryItemSchema>;

export const WeeklyVolumeAnalyticsSchema = z.object({
  windowStartedAt: z.string().datetime().nullable(),
  windowEndedAt: z.string().datetime().nullable(),
  items: z.array(WeeklyVolumeSummaryItemSchema),
});

export type WeeklyVolumeAnalytics = z.infer<typeof WeeklyVolumeAnalyticsSchema>;

export const DeterministicAnalyticsReadModelSchema = z.object({
  cyclePlanId: z.string().min(1),
  cycleCompletion: CycleCompletionAnalyticsSchema,
  adherence: AdherenceAnalyticsSchema,
  progression: ProgressionAnalyticsSchema,
  fatigueSummary: FatigueSummarySchema,
  capacityTimeline: CapacityTimelineSchema,
  weeklyVolume: WeeklyVolumeAnalyticsSchema,
  recentSessions: z.array(RecentSessionAnalyticsSchema),
});

export type DeterministicAnalyticsReadModel = z.infer<
  typeof DeterministicAnalyticsReadModelSchema
>;

export const DeterministicAnalyticsRequestSchema = z.object({}).strict();

export type DeterministicAnalyticsRequest = z.infer<
  typeof DeterministicAnalyticsRequestSchema
>;

const DeterministicAnalyticsSuccessResponseSchema = z
  .object({
    status: z.literal("success"),
    availability: z.enum(["available", "unavailable"]),
    analytics: DeterministicAnalyticsReadModelSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.availability === "available" && value.analytics === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "available analytics responses must include analytics",
        path: ["analytics"],
      });
    }

    if (value.availability === "unavailable" && value.analytics !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "unavailable analytics responses must set analytics to null",
        path: ["analytics"],
      });
    }
  });

const DeterministicAnalyticsErrorResponseSchema = z.object({
  status: z.literal("error"),
  errors: z.array(z.string()),
});

export const DeterministicAnalyticsResponseSchema = z.union([
  DeterministicAnalyticsSuccessResponseSchema,
  DeterministicAnalyticsErrorResponseSchema,
]);

export type DeterministicAnalyticsResponse = z.infer<
  typeof DeterministicAnalyticsResponseSchema
>;

export const ActiveCycleReportingResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  reporting: ActiveCycleReportingReadModelSchema.nullable().optional(),
  errors: z.array(z.string()).optional(),
});

export type ActiveCycleReportingResponse = z.infer<
  typeof ActiveCycleReportingResponseSchema
>;
