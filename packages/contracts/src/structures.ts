import { z } from "zod";
import { EntityIdSchema } from "./ids";

// ============================================================================
// Template Slots & Days
// ============================================================================

export const TemplateSlotSchema = z.object({
  slotType: z.enum(["main", "accessory", "conditioning", "warmup", "cooldown"]).default("accessory"),
  movementPattern: z.string().optional(),
  muscleTargets: z.record(z.string(), z.number().min(0).max(1)).default({}),
  setsMin: z.number().int().min(1),
  setsMax: z.number().int().min(1),
  repsMin: z.number().int().min(1),
  repsMax: z.number().int().min(1),
  rirMin: z.number().int().min(0).max(10).nullable().optional(),
  rirMax: z.number().int().min(0).max(10).nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export type TemplateSlot = z.infer<typeof TemplateSlotSchema>;

export const TemplateDaySchema = z.object({
  dayIndex: z.number().int().min(0),
  name: z.string().min(1),
  intensityTarget: z.enum(["low", "moderate", "high"]).default("moderate"),
  volumeMultiplier: z.number().min(0.5).max(2).default(1),
  slots: z.array(TemplateSlotSchema).min(1),
});

export type TemplateDay = z.infer<typeof TemplateDaySchema>;

// ============================================================================
// Program Templates & Blocks
// ============================================================================

export const ProgramTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  daysPerWeek: z.number().int().min(1).max(7),
  weekPattern: z.array(TemplateDaySchema).min(1),
  volumeDistribution: z.record(z.string(), z.number().min(0)).default({}),
});

export type ProgramTemplate = z.infer<typeof ProgramTemplateSchema>;

export const TrainingPhaseSchema = z.enum([
  "accumulation",
  "intensification",
  "deload",
  "peaking",
  "maintenance",
]);

export type TrainingPhase = z.infer<typeof TrainingPhaseSchema>;

export const TrainingBlockStatusSchema = z.enum([
  "planned",
  "active",
  "paused",
  "completed",
]);

export type TrainingBlockStatus = z.infer<typeof TrainingBlockStatusSchema>;

export const TrainingBlockSchema = z.object({
  blockId: z.string().min(1),
  userId: z.string().min(1),
  phase: TrainingPhaseSchema,
  startDate: z.string().datetime(),
  plannedWeeks: z.number().int().min(1),
  goals: z.array(z.string()).default([]),
  status: TrainingBlockStatusSchema,
  templateId: z.string().min(1).optional(),
});

export type TrainingBlock = z.infer<typeof TrainingBlockSchema>;

export const MicrocycleSchema = z.object({
  microcycleId: z.string().min(1),
  blockId: z.string().min(1),
  weekNumber: z.number().int().min(1),
  sessions: z.array(TemplateDaySchema).min(1),
  intensityTarget: z.enum(["low", "moderate", "high"]).default("moderate"),
});

export type Microcycle = z.infer<typeof MicrocycleSchema>;

// ============================================================================
// Resolved Session Requirements
// ============================================================================

export const SessionRequirementSchema = z.object({
  templateId: z.string().min(1),
  dayIndex: z.number().int().min(0),
  name: z.string().min(1),
  intensityTarget: z.enum(["low", "moderate", "high"]),
  volumeMultiplier: z.number().min(0.5).max(2),
  slots: z.array(TemplateSlotSchema).min(1),
});

export type SessionRequirement = z.infer<typeof SessionRequirementSchema>;

// ============================================================================
// Resolve Template API Request/Response
// ============================================================================

export const ResolveTemplateRequestSchema = z.object({
  templateId: EntityIdSchema,
  weekNumber: z.number().int().min(1).default(1),
  dayNumber: z.number().int().min(0).default(0),
});

export type ResolveTemplateRequest = z.infer<typeof ResolveTemplateRequestSchema>;

export const ResolveTemplateResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  sessionRequirement: SessionRequirementSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type ResolveTemplateResponse = z.infer<typeof ResolveTemplateResponseSchema>;
