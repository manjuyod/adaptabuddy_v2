import { z } from "zod";
import {
  ClassPresetIdSchema,
  CanonicalClassArchetypeSchema,
  ProgramRowSchema,
  ActiveProgramSchema,
  type ProgramRow,
  type ActiveProgram,
  type ClassPresetId,
  type CanonicalClassArchetype,
} from "@adaptabuddy/contracts";

// Re-export from contracts
export { ProgramRowSchema, ActiveProgramSchema };
export type { ProgramRow, ActiveProgram };

export type ActiveCycleView = {
  source: "normalized" | "legacy";
  status: "active" | "completed";
  programId: string;
  startedAt: string;
  daysPerWeek: number;
  currentDayIndex: number | null;
  currentMicrocycle: number | null;
  programDayId: string | null;
  programDayName: string | null;
  classPresetId: ClassPresetId | null;
  resolvedClassArchetype: CanonicalClassArchetype | null;
};

export { CanonicalClassArchetypeSchema, ClassPresetIdSchema };

// ============================================================================
// Program List Item (for display in UI)
// ============================================================================

export const ProgramListItemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  default_days_per_week: z.number().int().min(1).max(7),
  min_days_per_week: z.number().int().min(1).max(7),
  max_days_per_week: z.number().int().min(1).max(7),
  is_active: z.boolean()
});

export type ProgramListItem = z.infer<typeof ProgramListItemSchema>;

export const ProgramSlotDetailSchema = z.object({
  id: z.number().int().positive(),
  slotIndex: z.number().int().min(0),
  slotType: z.enum(["main", "accessory", "conditioning", "warmup", "cooldown"]),
  setsMin: z.number().int().min(1),
  setsMax: z.number().int().min(1),
  repsMin: z.number().int().min(1),
  repsMax: z.number().int().min(1),
  muscleTargets: z.record(z.string(), z.number().min(0).max(1)),
});

export type ProgramSlotDetail = z.infer<typeof ProgramSlotDetailSchema>;

export const ProgramDayDetailSchema = z.object({
  id: z.number().int().positive(),
  dayIndex: z.number().int().min(0),
  name: z.string().min(1),
  slots: z.array(ProgramSlotDetailSchema),
});

export type ProgramDayDetail = z.infer<typeof ProgramDayDetailSchema>;

export const MuscleCoverageSchema = z.object({
  muscle: z.string().min(1),
  score: z.number().min(0),
});

export type MuscleCoverage = z.infer<typeof MuscleCoverageSchema>;

export const ProgramCatalogItemSchema = ProgramListItemSchema.extend({
  days: z.array(ProgramDayDetailSchema),
  muscleCoverage: z.array(MuscleCoverageSchema),
});

export type ProgramCatalogItem = z.infer<typeof ProgramCatalogItemSchema>;

// ============================================================================
// Activate Program Action
// ============================================================================

export const ActivateProgramInputSchema = z.object({
  programId: z.number().int().positive()
});

export type ActivateProgramInput = z.infer<typeof ActivateProgramInputSchema>;

export type ActivateProgramResult = {
  success: boolean;
  error?: string;
  activeProgram?: ActiveProgram;
};
