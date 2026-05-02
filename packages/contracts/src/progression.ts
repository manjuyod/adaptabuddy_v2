import { z } from "zod";
import { LoadRecommendationSchema } from "./engine";
import { EntityIdSchema } from "./ids";

// ============================================================================
// DUP (Daily Undulating Periodization) Pattern
// ============================================================================

export const DUPDaySchema = z.object({
  dayIndex: z.number().int().min(0),
  intensityPct: z.number().min(0.4).max(1.0),
  targetReps: z.number().int().min(1),
  targetRir: z.number().int().min(0).max(5).default(2),
});

export type DUPDay = z.infer<typeof DUPDaySchema>;

// ============================================================================
// Progression Strategies
// ============================================================================

export const ProgressionStrategySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("linear"),
    incrementKg: z.number().positive(),
  }),
  z.object({
    type: z.literal("double_progression"),
    weightIncrementKg: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal("dup"),
    pattern: z.array(DUPDaySchema).min(1),
  }),
  z.object({
    type: z.literal("rpe"),
    targetRpe: z.number().min(5).max(10),
    adjustmentKg: z.number().positive().default(2.5),
    maxAdjustmentKg: z.number().positive().optional(),
  }),
]);

export type ProgressionStrategy = z.infer<typeof ProgressionStrategySchema>;

// ============================================================================
// Progression Recommend API Request/Response
// ============================================================================

export const ProgressionRecommendRequestSchema = z.object({
  exerciseIds: z.array(EntityIdSchema).min(1),
  repsMin: z.number().int().min(1).default(6),
  repsMax: z.number().int().min(1).default(12),
});

export type ProgressionRecommendRequest = z.infer<typeof ProgressionRecommendRequestSchema>;

export const ProgressionRecommendResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  recommendations: z.array(LoadRecommendationSchema).optional(),
  errors: z.array(z.string()).optional(),
});

export type ProgressionRecommendResponse = z.infer<typeof ProgressionRecommendResponseSchema>;
