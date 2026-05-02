import { z } from "zod";
import {
  GeneratedSessionSchema,
  LoadRecommendationSchema,
  CompletedSessionSchema,
} from "./engine";
import { EntityIdSchema } from "./ids";
import { PlanSessionExplanationReadModelSchema } from "./reporting";

// ============================================================================
// Generate Session Request
// ============================================================================

export const GenerateSessionRequestSchema = z.object({
  programDayId: EntityIdSchema,
  seed: z.string().optional(),
  slotId: EntityIdSchema.optional(),
  excludeExerciseIds: z.array(EntityIdSchema).max(256).optional(),
});

export type GenerateSessionRequest = z.infer<typeof GenerateSessionRequestSchema>;

// ============================================================================
// Generate Session Response
// ============================================================================

export const GenerateSessionResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  session: GeneratedSessionSchema.optional(),
  loadRecommendations: z.array(LoadRecommendationSchema).optional(),
  explanation: PlanSessionExplanationReadModelSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type GenerateSessionResponse = z.infer<typeof GenerateSessionResponseSchema>;

// ============================================================================
// Complete Session Request
// ============================================================================

export const CompleteSessionRequestSchema = CompletedSessionSchema;

export type CompleteSessionRequest = z.infer<typeof CompleteSessionRequestSchema>;

// ============================================================================
// Complete Session Response
// ============================================================================

export const CompleteSessionResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  message: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export type CompleteSessionResponse = z.infer<typeof CompleteSessionResponseSchema>;
