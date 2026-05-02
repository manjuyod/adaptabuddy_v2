import { z } from "zod";

// ============================================================================
// Training Age (volume tolerance scaling)
// ============================================================================

export const TrainingAgeSchema = z.enum(["novice", "intermediate", "advanced"]);

export type TrainingAge = z.infer<typeof TrainingAgeSchema>;

// ============================================================================
// Volume Budget Inputs
// ============================================================================

export const VolumeBudgetSchema = z.object({
  totalSets: z.number().min(0),
  musclePriorities: z.record(z.string(), z.number().min(0)),
  volumeMultiplier: z.number().min(0.5).max(3).default(1),
});

export type VolumeBudget = z.infer<typeof VolumeBudgetSchema>;

export const VolumeConstraintsSchema = z.object({
  mev: z.record(z.string(), z.number().min(0)),
  mrv: z.record(z.string(), z.number().min(0)),
});

export type VolumeConstraints = z.infer<typeof VolumeConstraintsSchema>;

// ============================================================================
// Volume Budget Outputs
// ============================================================================

export const VolumeAllocationSchema = z.object({
  allocations: z.record(z.string(), z.number().min(0)),
  totalAllocated: z.number().min(0),
  remainingSets: z.number(),
  cappedByMRV: z.array(z.string()).default([]),
  mevByMuscle: z.record(z.string(), z.number().min(0)).optional(),
  mrvByMuscle: z.record(z.string(), z.number().min(0)).optional(),
});

export type VolumeAllocation = z.infer<typeof VolumeAllocationSchema>;

export const VolumeRebalanceResultSchema = z.object({
  remainingTargets: z.record(z.string(), z.number().min(0)),
  perSessionTargets: z.record(z.string(), z.number().min(0)),
  cappedByMRV: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

export type VolumeRebalanceResult = z.infer<typeof VolumeRebalanceResultSchema>;

// ============================================================================
// Volume Allocate API Request/Response
// ============================================================================

export const VolumeAllocateRequestSchema = z.object({
  totalSets: z.number().min(0),
  musclePriorities: z.record(z.string(), z.number().min(0)),
  trainingAge: TrainingAgeSchema.default("intermediate"),
});

export type VolumeAllocateRequest = z.infer<typeof VolumeAllocateRequestSchema>;

export const VolumeAllocateResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  allocation: VolumeAllocationSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type VolumeAllocateResponse = z.infer<typeof VolumeAllocateResponseSchema>;
