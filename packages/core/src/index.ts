// Legacy workout generator
export { generateWorkout } from "./engine/workoutGenerator";
export { exerciseFixture } from "./domain/types";

// Domain types for session generation
export type { ExerciseData, MuscleMapping, ProgramSlot, ProgramDay } from "./domain/exerciseTypes";

// RNG utilities
export { createRng, deriveSeed } from "./engine/rng";
export type { Rng } from "./engine/rng";

// Exercise scoring
export { scoreExerciseForSlot, scoreExercisesForSlot } from "./engine/exerciseScorer";

// Slot filling
export { fillSlot } from "./engine/slotFiller";
export type { SlotFillerInput } from "./engine/slotFiller";

// Session generation
export { generateSession } from "./engine/sessionGenerator";
export type { SessionGeneratorInput, SessionGeneratorConfig } from "./engine/sessionGenerator";

// Fatigue engine
export {
  dissipateFatigue,
  accumulateFatigue,
  calculateFatigueCost,
  toMuscleFatigueRecord,
} from "./engine/fatigue";
export type { FatigueState, FatigueConfig, FatigueCostConfig } from "./engine/fatigue";

// Progression engine
export {
  estimate1RM,
  calculateWeightFromRM,
  recommendLoad,
  recommendProgression,
  updateCapacity,
  generateLoadRecommendations,
  generateLoadRecommendationsWithStrategy,
} from "./engine/progression";
export type { ProgressionConfig, ProgressionContext, RecommendProgressionInput } from "./engine/progression";

// Volume budget engine
export {
  calculateMEV,
  calculateMRV,
  allocateVolume,
  rebalanceVolume,
} from "./engine/volume";
export type { VolumeBudgetConfig, VolumeBudgetInput, VolumeRebalanceInput } from "./engine/volume";

// Program template engine
export { resolveTemplate, buildMicrocycle, getTemplateDay } from "./engine/template";
export type { ResolveTemplateInput, MicrocyclePlan } from "./engine/template";

// Chaos block engine
export { buildChaosBlock } from "./engine/chaos";
export type { ChaosBlockInput, ChaosSessionDetail, ChaosBlockPlanDetail } from "./engine/chaos";

// Completion processor
export { processCompletion, applyStatsUpdate } from "./engine/completion";
export type { CompletionInput, CompletionConfig } from "./engine/completion";

// Guardrails engine
export { evaluateRequest, classifyRisk, calculateTradeoffs } from "./engine/guardrails";
export type { GuardrailContext, TradeoffAnalysis } from "./engine/guardrails";

// Deviation handler engine
export { analyzeDeviation, rebalancePlan, projectImpact } from "./engine/deviation";
