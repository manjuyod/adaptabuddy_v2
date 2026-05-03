import { z } from "zod";

export const BetaFeedbackCategorySchema = z.enum([
  "bug",
  "workflow_pain",
  "confusing_copy",
  "performance",
  "other",
]);
export type BetaFeedbackCategory = z.infer<typeof BetaFeedbackCategorySchema>;

export const BetaFeedbackBoundaryAreaSchema = z.enum([
  "app-shell",
  "adapter-contract",
  "persistence-rls",
  "telemetry-read-model",
  "replay-debuggability",
  "deterministic-engine-behavior",
  "product-copy",
  "unknown",
]);
export type BetaFeedbackBoundaryArea = z.infer<typeof BetaFeedbackBoundaryAreaSchema>;

export const BetaFeedbackSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type BetaFeedbackSeverity = z.infer<typeof BetaFeedbackSeveritySchema>;

export const BetaFeedbackClientContextSchema = z
  .object({
    viewportWidth: z.number().int().positive().optional(),
    viewportHeight: z.number().int().positive().optional(),
    online: z.boolean().optional(),
    userAgent: z.string().trim().min(1).max(4096).optional(),
  })
  .strict();
export type BetaFeedbackClientContext = z.infer<typeof BetaFeedbackClientContextSchema>;

export const BetaFeedbackSubmitRequestSchema = z.object({
  category: BetaFeedbackCategorySchema,
  boundaryArea: BetaFeedbackBoundaryAreaSchema,
  severity: BetaFeedbackSeveritySchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  currentRoute: z.string().trim().min(1).optional(),
  diagnosticConsent: z.boolean().optional(),
  requestId: z.string().trim().min(1).optional(),
  replayReference: z.record(z.unknown()).optional(),
  clientContext: BetaFeedbackClientContextSchema.optional(),
});
export type BetaFeedbackSubmitRequest = z.infer<typeof BetaFeedbackSubmitRequestSchema>;

export const BetaFeedbackSubmitResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    reportId: z.number().int().positive(),
  }),
  z.object({
    status: z.literal("error"),
    errors: z.array(z.string()).min(1),
  }),
]);
export type BetaFeedbackSubmitResponse = z.infer<typeof BetaFeedbackSubmitResponseSchema>;
