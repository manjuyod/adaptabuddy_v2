import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  HistoryDetailExerciseSchema,
  HistoryDetailRequestSchema,
  type HistoryDetailResponse,
  HistoryDetailSetSchema,
  HistoryListRequestSchema,
  type HistoryListRequest,
  type HistoryListResponse,
  HistoryWorkoutDetailSchema,
  HistoryWorkoutSummarySchema,
  SetLogRowSchema,
  WorkoutLogRowSchema,
} from "./contracts";
import { getWorkoutCompletionReadModels } from "@/modules/reporting/service";

type NamedRelation = { name?: unknown } | Array<{ name?: unknown }> | null;

type WorkoutHistoryQueryRow = {
  programs?: NamedRelation;
  program_days?: NamedRelation;
};

type SetLogDetailQueryRow = {
  exercises?: NamedRelation;
};

const getRelationName = (relation: NamedRelation | undefined): string | null => {
  if (!relation) return null;
  const record = Array.isArray(relation) ? relation[0] : relation;
  return typeof record?.name === "string" && record.name.length > 0 ? record.name : null;
};

const getMetadataString = (metadata: unknown, key: string): string | null => {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const parseSetCountMap = async (
  supabase: SupabaseClient,
  workoutIds: number[]
): Promise<{ counts: Map<number, number>; error?: string }> => {
  if (workoutIds.length === 0) {
    return { counts: new Map<number, number>() };
  }

  const { data: setRows, error: setError } = await supabase
    .from("set_logs")
    .select("workout_log_id")
    .in("workout_log_id", workoutIds);

  if (setError) {
    return { counts: new Map<number, number>(), error: setError.message };
  }

  const counts = new Map<number, number>();
  for (const setRow of setRows ?? []) {
    const workoutLogId = Number((setRow as { workout_log_id?: unknown }).workout_log_id);
    if (!Number.isInteger(workoutLogId) || workoutLogId <= 0) continue;
    counts.set(workoutLogId, (counts.get(workoutLogId) ?? 0) + 1);
  }

  return { counts };
};

export async function getWorkoutHistory(
  userId: string,
  pagination: HistoryListRequest
): Promise<HistoryListResponse> {
  const parseResult = HistoryListRequestSchema.safeParse(pagination);
  if (!parseResult.success) {
    return {
      status: "error",
      errors: parseResult.error.errors.map((error) => error.message),
    };
  }

  const supabase = await createSupabaseServerActionClient();
  const { page, pageSize, dateFrom, dateTo } = parseResult.data;

  let query = supabase
    .from("workout_logs")
    .select(
      "id, user_id, program_id, program_day_id, completed_at, duration_seconds, total_volume, seed, metadata, programs(name), program_days(name)",
      { count: "exact" }
    )
    .eq("user_id", userId);

  if (dateFrom) {
    query = query.gte("completed_at", new Date(dateFrom).toISOString());
  }

  if (dateTo) {
    query = query.lte("completed_at", new Date(dateTo).toISOString());
  }

  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  const { data: workoutRows, error: workoutError, count } = await query
    .order("completed_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (workoutError) {
    return {
      status: "error",
      errors: ["Failed to load workout history"],
    };
  }

  const parsedWorkouts = (workoutRows ?? []).flatMap((workoutRow) => {
    const parsedWorkout = WorkoutLogRowSchema.safeParse(workoutRow);
    if (!parsedWorkout.success) return [];

    const row = workoutRow as WorkoutHistoryQueryRow;
    const workout = parsedWorkout.data;
    const metadata = workout.metadata;
    const programName =
      getRelationName(row.programs) ??
      getMetadataString(metadata, "programName") ??
      "Unassigned Program";
    const dayName =
      getRelationName(row.program_days) ??
      getMetadataString(metadata, "programDayName") ??
      "Workout Session";

    return [
      {
        id: workout.id,
        completedAt: workout.completed_at,
        programName,
        dayName,
        durationSeconds: workout.duration_seconds ?? null,
        totalVolume: workout.total_volume ?? null,
      },
    ];
  });

  const workoutIds = parsedWorkouts.map((workout) => workout.id);
  const { counts: setCountByWorkout, error: setCountError } = await parseSetCountMap(
    supabase,
    workoutIds
  );

  if (setCountError) {
    return {
      status: "error",
      errors: ["Failed to load workout set counts"],
    };
  }

  const workouts = parsedWorkouts.flatMap((workout) => {
    const parsedSummary = HistoryWorkoutSummarySchema.safeParse({
      ...workout,
      setCount: setCountByWorkout.get(workout.id) ?? 0,
    });
    return parsedSummary.success ? [parsedSummary.data] : [];
  });

  const total = count ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    status: "success",
    page,
    pageSize,
    total,
    totalPages,
    workouts,
  };
}

export async function getWorkoutDetail(
  userId: string,
  workoutId: number
): Promise<HistoryDetailResponse> {
  const parseResult = HistoryDetailRequestSchema.safeParse({ workoutId });
  if (!parseResult.success) {
    return {
      status: "error",
      errors: parseResult.error.errors.map((error) => error.message),
    };
  }

  const supabase = await createSupabaseServerActionClient();

  const { data: workoutRow, error: workoutError } = await supabase
    .from("workout_logs")
    .select(
      "id, user_id, program_id, program_day_id, completed_at, duration_seconds, total_volume, seed, metadata, programs(name), program_days(name)"
    )
    .eq("user_id", userId)
    .eq("id", parseResult.data.workoutId)
    .single();

  if (workoutError || !workoutRow) {
    return {
      status: "error",
      errors: ["Workout not found"],
    };
  }

  const parsedWorkout = WorkoutLogRowSchema.safeParse(workoutRow);
  if (!parsedWorkout.success) {
    return {
      status: "error",
      errors: ["Failed to parse workout history entry"],
    };
  }

  const { data: setRows, error: setError } = await supabase
    .from("set_logs")
    .select(
      "id, workout_log_id, exercise_id, set_number, weight, reps, rpe, rir, failed, created_at, exercises(name)"
    )
    .eq("workout_log_id", parseResult.data.workoutId)
    .order("set_number", { ascending: true })
    .order("id", { ascending: true });

  if (setError) {
    return {
      status: "error",
      errors: ["Failed to load workout set history"],
    };
  }

  const exerciseMap = new Map<number, { exerciseId: number; exerciseName: string; sets: unknown[] }>();

  for (const setRow of setRows ?? []) {
    const parsedSet = SetLogRowSchema.safeParse(setRow);
    if (!parsedSet.success) continue;

    const set = parsedSet.data;
    const row = setRow as SetLogDetailQueryRow;
    const exerciseName = getRelationName(row.exercises) ?? `Exercise ${set.exercise_id}`;

    const existingExercise = exerciseMap.get(set.exercise_id) ?? {
      exerciseId: set.exercise_id,
      exerciseName,
      sets: [],
    };

    const parsedDetailSet = HistoryDetailSetSchema.safeParse({
      setIndex: set.set_number,
      weight: set.weight,
      reps: set.reps,
      rir: set.rir ?? null,
    });

    if (parsedDetailSet.success) {
      existingExercise.sets.push(parsedDetailSet.data);
      exerciseMap.set(set.exercise_id, existingExercise);
    }
  }

  const exercises = Array.from(exerciseMap.values()).flatMap((exercise) => {
    const parsedExercise = HistoryDetailExerciseSchema.safeParse({
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      sets: exercise.sets,
    });
    return parsedExercise.success ? [parsedExercise.data] : [];
  });

  const workout = parsedWorkout.data;
  const workoutJoinRow = workoutRow as WorkoutHistoryQueryRow;
  const readModels = await getWorkoutCompletionReadModels(
    supabase,
    userId,
    parseResult.data.workoutId
  );
  const workoutDetail = HistoryWorkoutDetailSchema.safeParse({
    id: workout.id,
    completedAt: workout.completed_at,
    programName:
      getRelationName(workoutJoinRow.programs) ??
      getMetadataString(workout.metadata, "programName") ??
      "Unassigned Program",
    dayName:
      getRelationName(workoutJoinRow.program_days) ??
      getMetadataString(workout.metadata, "programDayName") ??
      "Workout Session",
    durationSeconds: workout.duration_seconds ?? null,
    totalVolume: workout.total_volume ?? null,
    setCount: exercises.reduce((count, exercise) => count + exercise.sets.length, 0),
    exercises,
    explanation: readModels.explanation,
    reporting: readModels.reporting,
    replayReference: readModels.replayReference,
  });

  if (!workoutDetail.success) {
    return {
      status: "error",
      errors: ["Failed to build workout history detail"],
    };
  }

  return {
    status: "success",
    workout: workoutDetail.data,
  };
}
