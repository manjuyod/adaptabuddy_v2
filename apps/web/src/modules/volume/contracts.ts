// Re-export all volume-related contracts from packages/contracts
export {
  // Volume allocation
  VolumeAllocateRequestSchema,
  type VolumeAllocateRequest,
  VolumeAllocateResponseSchema,
  type VolumeAllocateResponse,
  VolumeAllocationSchema,
  type VolumeAllocation,

  // Training age
  TrainingAgeSchema,
  type TrainingAge,

  // Additional volume schemas for completeness
  VolumeBudgetSchema,
  type VolumeBudget,
  VolumeConstraintsSchema,
  type VolumeConstraints,
  VolumeRebalanceResultSchema,
  type VolumeRebalanceResult,
} from "@adaptabuddy/contracts";
