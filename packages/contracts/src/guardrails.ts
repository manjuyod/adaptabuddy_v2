import { z } from "zod";
import { TrainingAgeSchema } from "./volume";

export const WarningSeveritySchema = z.enum(["info", "caution", "warning", "danger"]);

export type WarningSeverity = z.infer<typeof WarningSeveritySchema>;

export const WarningSchema = z.object({
  id: z.string(),
  severity: WarningSeveritySchema,
  category: z.string(),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  mitigation: z.string().optional(),
  requiredOptIn: z.string().optional(),
});

export type Warning = z.infer<typeof WarningSchema>;

export const GuardrailEvaluationSchema = z.object({
  passed: z.boolean(),
  warnings: z.array(WarningSchema).default([]),
  blockers: z.array(WarningSchema).default([]),
  recommendations: z.array(z.string()).default([]),
});

export type GuardrailEvaluation = z.infer<typeof GuardrailEvaluationSchema>;

export const GuardrailActionSchema = z.enum([
  "session_generate",
  "volume_change",
  "frequency_change",
  "deload_skip",
  "injury_override",
  "rest_override",
  "plan_change",
]);

export type GuardrailAction = z.infer<typeof GuardrailActionSchema>;

export const GuardrailRequestSchema = z.object({
  action: GuardrailActionSchema,
  weeklyVolume: z.record(z.string(), z.number().min(0)).optional(),
  daysPerMuscle: z.record(z.string(), z.number().int().min(0).max(7)).optional(),
  consecutiveTrainingDays: z.number().int().min(0).optional(),
  skippedDeloads: z.number().int().min(0).optional(),
  performanceDeclineWeeks: z.number().int().min(0).optional(),
  systemicFatigue: z.number().min(0).max(100).optional(),
  trainingThroughInjury: z.boolean().optional(),
  trainingAge: TrainingAgeSchema.default("intermediate"),
  choice: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
});

export type GuardrailRequest = z.infer<typeof GuardrailRequestSchema>;

export const GuardrailResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  evaluation: GuardrailEvaluationSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type GuardrailResponse = z.infer<typeof GuardrailResponseSchema>;
