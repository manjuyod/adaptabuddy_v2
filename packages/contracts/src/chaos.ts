import { z } from "zod";
import { EntityIdSchema } from "./ids";

// ============================================================================
// Chaos Block Planning
// ============================================================================

export const ChaosModeSchema = z.enum(["random", "rotate"]);

export type ChaosMode = z.infer<typeof ChaosModeSchema>;

export const ChaosBlockConfigSchema = z.object({
  seed: z.string().min(1),
  weeks: z.number().int().min(1),
  daysPerWeek: z.number().int().min(1).max(7),
  mode: ChaosModeSchema.default("random"),
  allowSameTemplateConsecutive: z.boolean().default(true),
});

export type ChaosBlockConfig = z.infer<typeof ChaosBlockConfigSchema>;

export const ChaosSessionSchema = z.object({
  weekNumber: z.number().int().min(1),
  dayIndex: z.number().int().min(0),
  templateId: z.string().min(1),
  templateName: z.string().min(1),
  sourceDayIndex: z.number().int().min(0),
});

export type ChaosSession = z.infer<typeof ChaosSessionSchema>;

export const ChaosBlockPlanSchema = z.object({
  seed: z.string().min(1),
  weeks: z.number().int().min(1),
  daysPerWeek: z.number().int().min(1).max(7),
  sessions: z.array(ChaosSessionSchema).min(1),
});

export type ChaosBlockPlan = z.infer<typeof ChaosBlockPlanSchema>;

// ============================================================================
// Chaos Plan API Request/Response
// ============================================================================

export const ChaosPlanRequestSchema = z.object({
  templateIds: z.array(EntityIdSchema).min(1),
  weeks: z.number().int().min(1).max(12),
  daysPerWeek: z.number().int().min(1).max(7),
  seed: z.string().optional(),
  mode: ChaosModeSchema.default("random"),
});

export type ChaosPlanRequest = z.infer<typeof ChaosPlanRequestSchema>;

export const ChaosPlanResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  plan: ChaosBlockPlanSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type ChaosPlanResponse = z.infer<typeof ChaosPlanResponseSchema>;
