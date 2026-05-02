import { z } from "zod";
import {
  ActiveCycleReportingReadModelSchema,
  ReplayDebugReferenceSchema,
  WorkoutCompletionExplanationReadModelSchema,
} from "./reporting";

const DateFilterSchema = z.string().datetime({ offset: true });

// ============================================================================
// History List
// ============================================================================

export const HistoryListRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  dateFrom: DateFilterSchema.optional(),
  dateTo: DateFilterSchema.optional(),
});

export type HistoryListRequest = z.infer<typeof HistoryListRequestSchema>;

export const HistoryWorkoutSummarySchema = z.object({
  id: z.coerce.number().int().positive(),
  completedAt: z.string().min(1),
  programName: z.string().min(1),
  dayName: z.string().min(1),
  durationSeconds: z.coerce.number().int().min(0).nullable(),
  totalVolume: z.coerce.number().min(0).nullable(),
  setCount: z.coerce.number().int().min(0),
});

export type HistoryWorkoutSummary = z.infer<typeof HistoryWorkoutSummarySchema>;

export const HistoryListResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  total: z.coerce.number().int().min(0).optional(),
  totalPages: z.coerce.number().int().min(0).optional(),
  workouts: z.array(HistoryWorkoutSummarySchema).optional(),
  errors: z.array(z.string()).optional(),
});

export type HistoryListResponse = z.infer<typeof HistoryListResponseSchema>;

// ============================================================================
// History Detail
// ============================================================================

export const HistoryDetailRequestSchema = z.object({
  workoutId: z.coerce.number().int().positive(),
});

export type HistoryDetailRequest = z.infer<typeof HistoryDetailRequestSchema>;

export const HistoryDetailSetSchema = z.object({
  setIndex: z.coerce.number().int().min(1),
  weight: z.coerce.number().min(0),
  reps: z.coerce.number().int().min(0),
  rir: z.coerce.number().int().min(0).max(10).nullable(),
});

export type HistoryDetailSet = z.infer<typeof HistoryDetailSetSchema>;

export const HistoryDetailExerciseSchema = z.object({
  exerciseId: z.coerce.number().int().positive(),
  exerciseName: z.string().min(1),
  sets: z.array(HistoryDetailSetSchema),
});

export type HistoryDetailExercise = z.infer<typeof HistoryDetailExerciseSchema>;

export const HistoryWorkoutDetailSchema = z.object({
  id: z.coerce.number().int().positive(),
  completedAt: z.string().min(1),
  programName: z.string().min(1),
  dayName: z.string().min(1),
  durationSeconds: z.coerce.number().int().min(0).nullable(),
  totalVolume: z.coerce.number().min(0).nullable(),
  setCount: z.coerce.number().int().min(0),
  exercises: z.array(HistoryDetailExerciseSchema),
  explanation: WorkoutCompletionExplanationReadModelSchema.nullable(),
  reporting: ActiveCycleReportingReadModelSchema.nullable(),
  replayReference: ReplayDebugReferenceSchema.nullable(),
});

export type HistoryWorkoutDetail = z.infer<typeof HistoryWorkoutDetailSchema>;

export const HistoryDetailResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  workout: HistoryWorkoutDetailSchema.optional(),
  errors: z.array(z.string()).optional(),
});

export type HistoryDetailResponse = z.infer<typeof HistoryDetailResponseSchema>;
