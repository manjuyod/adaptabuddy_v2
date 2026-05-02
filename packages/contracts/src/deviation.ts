import { z } from "zod";
import { EntityIdSchema } from "./ids";
import { WarningSeveritySchema } from "./guardrails";

// ============================================================================
// Deviation Classification
// ============================================================================

export const DeviationTypeSchema = z.enum([
  "volume",
  "intensity",
  "exercise_substitution",
  "timing",
]);

export type DeviationType = z.infer<typeof DeviationTypeSchema>;

export const DeviationDirectionSchema = z.enum([
  "increase",
  "decrease",
  "swap",
  "shift",
]);

export type DeviationDirection = z.infer<typeof DeviationDirectionSchema>;

export const DeviationDetailSchema = z.object({
  type: DeviationTypeSchema,
  magnitude: z.number().min(0),
  affectedMuscles: z.array(z.string()).default([]),
  severity: WarningSeveritySchema,
  message: z.string(),
  direction: DeviationDirectionSchema.optional(),
});

export type DeviationDetail = z.infer<typeof DeviationDetailSchema>;

export const DeviationAnalysisSchema = z.object({
  deviations: z.array(DeviationDetailSchema).default([]),
  totalMagnitude: z.number().min(0),
  primaryType: DeviationTypeSchema.nullable(),
  summary: z.string(),
});

export type DeviationAnalysis = z.infer<typeof DeviationAnalysisSchema>;

// ============================================================================
// Plan Inputs / Outputs
// ============================================================================

export const DeviationPlannedExerciseSchema = z.object({
  exerciseId: EntityIdSchema,
  muscleTargets: z.record(z.string(), z.number().min(0)).default({}),
  plannedSets: z.number().int().min(0),
  plannedReps: z.number().int().min(1).optional(),
  plannedLoad: z.number().min(0).nullable().optional(),
});

export type DeviationPlannedExercise = z.infer<typeof DeviationPlannedExerciseSchema>;

export const DeviationActualExerciseSchema = z.object({
  exerciseId: EntityIdSchema,
  completedSets: z.number().int().min(0),
  avgReps: z.number().min(0).optional(),
  avgLoad: z.number().min(0).nullable().optional(),
  substituteForExerciseId: EntityIdSchema.optional(),
});

export type DeviationActualExercise = z.infer<typeof DeviationActualExerciseSchema>;

export const DeviationPlannedSessionSchema = z.object({
  sessionId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  exercises: z.array(DeviationPlannedExerciseSchema).min(1),
});

export type DeviationPlannedSession = z.infer<typeof DeviationPlannedSessionSchema>;

export const DeviationActualSessionSchema = z.object({
  completedAt: z.string().datetime().optional(),
  exercises: z.array(DeviationActualExerciseSchema).default([]),
});

export type DeviationActualSession = z.infer<typeof DeviationActualSessionSchema>;

export const RemainingPlanSessionSchema = z.object({
  sessionId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  targetVolumeSets: z.record(z.string(), z.number().min(0)).default({}),
  intensityMultiplier: z.number().min(0.5).max(1.5).default(1),
});

export type RemainingPlanSession = z.infer<typeof RemainingPlanSessionSchema>;

export const RebalancedSessionSchema = z.object({
  sessionId: z.string().min(1),
  adjustedVolumeSets: z.record(z.string(), z.number().min(0)),
  adjustedIntensityMultiplier: z.number().min(0.5).max(1.5),
  rationale: z.array(z.string()).default([]),
});

export type RebalancedSession = z.infer<typeof RebalancedSessionSchema>;

export const RebalancedPlanSchema = z.object({
  sessions: z.array(RebalancedSessionSchema),
  notes: z.array(z.string()).default([]),
});

export type RebalancedPlan = z.infer<typeof RebalancedPlanSchema>;

export const ImpactProjectionSchema = z.object({
  projectedFatigueDelta: z.record(z.string(), z.number()),
  projectedPerformanceImpact: z.enum(["positive", "neutral", "negative"]),
  recoveryHoursEstimate: z.number().int().min(0),
  notes: z.array(z.string()).default([]),
});

export type ImpactProjection = z.infer<typeof ImpactProjectionSchema>;

// ============================================================================
// API Request / Response
// ============================================================================

export const DeviationAnalyzeRequestSchema = z.object({
  plannedSession: DeviationPlannedSessionSchema,
  actualSession: DeviationActualSessionSchema,
  remainingPlan: z.array(RemainingPlanSessionSchema).default([]),
});

export type DeviationAnalyzeRequest = z.infer<typeof DeviationAnalyzeRequestSchema>;

export const DeviationAnalyzeResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  analysis: DeviationAnalysisSchema.optional(),
  rebalancedPlan: RebalancedPlanSchema.optional(),
  projection: ImpactProjectionSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type DeviationAnalyzeResponse = z.infer<typeof DeviationAnalyzeResponseSchema>;
