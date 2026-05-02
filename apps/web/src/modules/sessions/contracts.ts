// Re-export all session-related contracts from packages/contracts
export {
  // Stats
  UserStatsSchema,
  type UserStats,
  type ActiveProgram,
  type MuscleFatigue,
  type ExerciseMastery,
  type ExerciseCapacity,
  type Progression,
  type UserPreferences,

  // DB rows
  WorkoutLogRowSchema,
  type WorkoutLogRow,
  SetLogRowSchema,
  type SetLogRow,

  // Engine types
  SlotContextSchema,
  type SlotContext,
  type ScoredExercise,
  FilledSlotSchema,
  type FilledSlot,
  GeneratedSessionSchema,
  type GeneratedSession,
  LoadRecommendationSchema,
  type LoadRecommendation,
  SetLogSchema,
  type SetLog,
  ExerciseLogSchema,
  type ExerciseLog,
  CompletedSessionSchema,
  type CompletedSession,
  StatsUpdateSchema,
  type StatsUpdate,

  // API contracts
  GenerateSessionRequestSchema,
  type GenerateSessionRequest,
  GenerateSessionResponseSchema,
  type GenerateSessionResponse,
  CompleteSessionRequestSchema,
  type CompleteSessionRequest,
  CompleteSessionResponseSchema,
  type CompleteSessionResponse,
} from "@adaptabuddy/contracts";
