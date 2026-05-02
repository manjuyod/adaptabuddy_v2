import { createHash } from "node:crypto";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import {
  applyStatsUpdate,
  generateLoadRecommendations,
  generateSession,
  processCompletion,
} from "@adaptabuddy/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SetLogRowSchema,
  WorkoutLogRowSchema,
  type SetLogRow,
  CompleteSessionRequest,
  CompleteSessionResponse,
  GenerateSessionRequest,
  GenerateSessionResponse,
  UserStats,
  type WorkoutLogRow,
} from "./contracts";
import {
  buildFatigueState,
  getDefaultUserStats,
  normalizeStringList,
  toExerciseData,
  toMuscleMapping,
  toProgramDay,
  type ExerciseRow,
  type MuscleMappingRow,
  type SessionProgramSlotRow,
} from "@/lib/db-transformers";
import { toLookupId, toLookupIds } from "@/lib/ids";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logServerEvent } from "@/lib/observability/logger";
import { runEngineInput } from "@/lib/engine-runner";
import {
  CANON_REPLAY_CANONICALIZATION_VERSION,
  computeCanonicalReplayReferenceHash,
} from "@/lib/engine-replay";
import { derivePlanSessionExplanation } from "@/modules/reporting/service";

type MuscleMapJoinRow = {
  exercise_id: string | number;
  role: "primary" | "secondary" | "stabilizer";
  contribution: number;
  muscle_group_slug?: string | null;
  muscle_groups?: { slug: string } | Array<{ slug: string }> | null;
};

type ProgramDayLookupRow = {
  id: number;
  program_id: number;
  name: string;
};

type EngineCyclePlanRow = {
  id: number;
  user_id: string;
  primary_program_id?: number | null;
  resolved_class_archetype?: string | null;
  current_session_index: number;
  current_microcycle_index?: number | null;
  current_mesocycle_index?: number | null;
  is_active?: boolean | null;
};

type EngineCycleSessionRow = {
  id: number;
  plan_id: number;
  user_id: string;
  session_index: number;
  program_day_id: number;
  program_day_name?: string | null;
  session_seed?: string | null;
  slot_payload?: unknown;
  projected_fatigue_cost?: Record<string, number> | null;
  completed_at?: string | null;
};

type EngineGamificationStateRow = {
  id: number;
  user_id: string;
  plan_id: number;
  xp: number;
  level: number;
  adherence_streak: number;
  completed_session_count?: number | null;
  missed_session_count?: number | null;
  last_adherence_outcome_classification?: string | null;
  last_awarded_at?: string | null;
  class_archetype?: string | null;
};

type EngineProgressionStateRow = {
  id?: number;
  user_id: string;
  plan_id: number;
  exercise_id: string;
  current_action: string;
  trend: string;
  last_successful_load_weight?: number | null;
  last_successful_load_reps?: number | null;
  consecutive_successful_completions: number;
  consecutive_stall_or_regression_count: number;
  swap_recommendation_count: number;
  last_session_outcome_classification: string;
  last_completed_at: string;
};

type EngineSessionOutcomeClassification =
  | "complete_clean"
  | "complete_compromised"
  | "partial"
  | "missed";

type EngineProgressionAction = "overload" | "maintain" | "regress" | "swap";
type EngineProgressionTrend = "improving" | "stalled" | "regressing" | "blocked";
type EngineSystemicFatigue = "mild" | "moderate" | "severe";

type EngineProgressionPatchEntry = {
  currentAction: EngineProgressionAction;
  trend: EngineProgressionTrend;
  lastSuccessfulLoad?: {
    weight: number;
    reps: number;
  };
  consecutiveSuccessfulCompletions: number;
  consecutiveStallOrRegressionCount: number;
  swapRecommendationCount: number;
  lastSessionOutcomeClassification: EngineSessionOutcomeClassification;
  lastCompletedAt: string;
};

type EngineCompleteSessionOutput = {
  schemaVersion: string;
  operation: "complete_session";
  result: {
    sessionOutcomeClassification: EngineSessionOutcomeClassification;
    updatedProgressionActionSummary: Array<{
      exerciseId: string;
      action: EngineProgressionAction;
      trend: EngineProgressionTrend;
    }>;
    awardedXpSummary: {
      xpDelta: number;
      streakDelta: number;
      reason: string;
    };
    levelUpIndicator: boolean;
    warnings: string[];
  };
  statePatch: {
    progressionState?: Record<string, EngineProgressionPatchEntry>;
    readinessState?: {
      systemicFatigue: EngineSystemicFatigue;
    };
    gamificationState: {
      xp: number;
      level: number;
      adherenceStreak: number;
      completedSessionCount: number;
      missedSessionCount: number;
      lastAdherenceOutcomeClassification: EngineSessionOutcomeClassification;
      lastAwardedAt: string;
    };
  };
  decisionLog: unknown[];
  replayReceipt: {
    inputHash: string;
    outputHash: string;
    seedUsed: string;
    effectiveAt: string;
    implementationVersion: string;
    policyVersion: string;
    referenceHash: string;
  };
};

type EnginePlanSessionOutput = {
  schemaVersion: string;
  operation: "plan_session";
  result: {
    recommendedSessionId: string;
    recommendedMovementFamily: string;
    selectedExerciseIds: string[];
    sessionRationale: string;
    progressionActionSummary: Array<{
      exerciseId: string;
      action: EngineProgressionAction;
      trend: EngineProgressionTrend;
    }>;
    scoreBreakdown: {
      progressionNeed: number;
      fatigueCompatibility: number;
      classBias: number;
      novelty: number;
    };
  };
  decisionLog: unknown[];
  replayReceipt: {
    inputHash: string;
    outputHash: string;
    seedUsed: string;
    effectiveAt: string;
    implementationVersion: string;
    policyVersion: string;
    referenceHash: string;
  };
};

type EngineSessionTraceInsert = {
  user_id: string;
  operation: "plan_session" | "complete_session";
  cycle_plan_id: number | null;
  cycle_session_id: number | null;
  workout_log_id: number | null;
  input_material: Record<string, unknown> | null;
  decision_log: unknown[];
  replay_receipt: Record<string, unknown>;
  engine_result: Record<string, unknown>;
};

type CycleBackedCompletionContext = {
  plan: EngineCyclePlanRow;
  session: EngineCycleSessionRow;
  gamification: EngineGamificationStateRow;
  progression: EngineProgressionStateRow[];
};

type CycleBackedGenerationContext = {
  plan: EngineCyclePlanRow;
  session: EngineCycleSessionRow;
  gamification: EngineGamificationStateRow;
  progression: EngineProgressionStateRow[];
};

type ProgressionRollbackEntry =
  | { existed: true; previous: EngineProgressionStateRow }
  | { existed: false; exerciseId: string };

type CompleteSessionOptions = {
  idempotencyKey?: string | null;
  requestId?: string | null;
  route?: string;
};

type AtomicCompletionRpcResult = {
  workoutLogId: number;
  reused: boolean;
};

type CycleCompatibilityProjection = {
  currentDayIndex: number;
  currentMicrocycle: number;
};

type SyncNormalizedCycleResult =
  | {
      ok: true;
      compatibilityProjection: CycleCompatibilityProjection | null;
    }
  | { ok: false; error: string };

type SetLogInsertPayload = {
  exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  rir: number | null;
  failed: boolean;
};

const NUMERIC_ID_PATTERN = /^\d+$/;

const toNullableNumericId = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (
    typeof value === "string" &&
    NUMERIC_ID_PATTERN.test(value) &&
    Number(value) > 0
  ) {
    return Number(value);
  }

  return null;
};

const calculateSessionDurationSeconds = (
  startedAt: string,
  completedAt: string
): number | null => {
  const startTimestamp = Date.parse(startedAt);
  const completedTimestamp = Date.parse(completedAt);
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(completedTimestamp)) {
    return null;
  }

  const durationSeconds = Math.round((completedTimestamp - startTimestamp) / 1000);
  return durationSeconds >= 0 ? durationSeconds : null;
};

const calculateSessionVolume = (input: CompleteSessionRequest): number => {
  return input.exercises.reduce((sessionTotal, exercise) => {
    const exerciseTotal = exercise.sets.reduce((setTotal, set) => {
      return setTotal + set.weight * set.reps;
    }, 0);

    return sessionTotal + exerciseTotal;
  }, 0);
};

const normalizeIdempotencyKey = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
};

const deriveCompletionIdempotencyKey = (
  userId: string,
  input: CompleteSessionRequest
) => {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        userId,
        programDayId: input.programDayId,
        seed: input.seed ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        overallRpe: input.overallRpe ?? null,
        notes: input.notes ?? null,
        exercises: input.exercises.map((exercise) => ({
          slotId: exercise.slotId,
          exerciseId: exercise.exerciseId,
          sets: exercise.sets.map((set) => ({
            setIndex: set.setIndex,
            weight: set.weight,
            reps: set.reps,
            rir: set.rir ?? null,
          })),
        })),
      })
    )
    .digest("hex");

  return `derived-${digest.slice(0, 40)}`;
};

const normalizeOptionalSeed = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const createSetLogInsertPayload = (input: CompleteSessionRequest): SetLogInsertPayload[] | null => {
  const rows = input.exercises.flatMap((exercise) => {
    const exerciseId = toNullableNumericId(toLookupId(exercise.exerciseId));
    if (exerciseId === null) {
      return [];
    }

    return exercise.sets.map((set) => ({
      exercise_id: exerciseId,
      set_number: set.setIndex + 1,
      weight: set.weight,
      reps: set.reps,
      rpe: null,
      rir: set.rir ?? null,
      failed: false,
    }));
  });

  const expectedSetCount = input.exercises.reduce(
    (count, exercise) => count + exercise.sets.length,
    0
  );

  if (rows.length !== expectedSetCount) {
    return null;
  }

  return rows;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const replayInputRedactionKeys = new Set([
  "notes",
  "setnotes",
  "requestid",
  "correlationid",
  "request_id",
  "correlation_id",
]);

const redactReplayInputMaterial = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactReplayInputMaterial(entry));
  }

  if (!isObjectRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (replayInputRedactionKeys.has(key.toLowerCase())) {
        return [key, "[REDACTED]"] as const;
      }

      return [key, redactReplayInputMaterial(entryValue)] as const;
    })
  );
};

const toReplayTraceInputMaterial = (input: unknown): Record<string, unknown> | null => {
  const redacted = redactReplayInputMaterial(input);
  return isObjectRecord(redacted) ? redacted : null;
};

const isSessionOutcomeClassification = (
  value: unknown
): value is EngineSessionOutcomeClassification =>
  value === "complete_clean" ||
  value === "complete_compromised" ||
  value === "partial" ||
  value === "missed";

const isProgressionAction = (value: unknown): value is EngineProgressionAction =>
  value === "overload" || value === "maintain" || value === "regress" || value === "swap";

const isProgressionTrend = (value: unknown): value is EngineProgressionTrend =>
  value === "improving" ||
  value === "stalled" ||
  value === "regressing" ||
  value === "blocked";

const isSystemicFatigue = (value: unknown): value is EngineSystemicFatigue =>
  value === "mild" || value === "moderate" || value === "severe";

const toEngineSystemicFatigue = (value: UserStats["preferences"]["fatigueLevel"]): EngineSystemicFatigue => {
  switch (value) {
    case "light":
      return "mild";
    case "hard":
    case "brutal":
      return "severe";
    case "moderate":
    default:
      return "moderate";
  }
};

const toEngineMuscleFatigue = (stats: UserStats) => {
  const fatigue = buildFatigueState(stats);
  return Object.fromEntries(
    Object.entries(fatigue).map(([muscle, value]) => [muscle, Math.round(value)])
  );
};

const toEngineKnownLifts = (stats: UserStats) => {
  return Object.fromEntries(
    Object.entries(stats.capacities).flatMap(([exerciseId, capacity]) => {
      if (
        capacity.estimated1RM === null ||
        capacity.lastWeight === null ||
        capacity.lastReps === null
      ) {
        return [];
      }

      return [
        [
          exerciseId,
          {
            estimated1RM: capacity.estimated1RM,
            lastWeight: capacity.lastWeight,
            lastReps: capacity.lastReps,
          },
        ],
      ];
    })
  );
};

const toNormalizedGamificationPatchRow = (
  patch: EngineCompleteSessionOutput["statePatch"]["gamificationState"]
) => ({
  xp: patch.xp,
  level: patch.level,
  adherence_streak: patch.adherenceStreak,
  completed_session_count: patch.completedSessionCount,
  missed_session_count: patch.missedSessionCount,
  last_adherence_outcome_classification: patch.lastAdherenceOutcomeClassification,
  last_awarded_at: patch.lastAwardedAt,
});

const toProgressionInsertPayload = (
  userId: string,
  planId: number,
  exerciseId: string,
  patch: EngineProgressionPatchEntry
) => ({
  user_id: userId,
  plan_id: planId,
  exercise_id: exerciseId,
  current_action: patch.currentAction,
  trend: patch.trend,
  last_successful_load_weight: patch.lastSuccessfulLoad?.weight ?? null,
  last_successful_load_reps: patch.lastSuccessfulLoad?.reps ?? null,
  consecutive_successful_completions: patch.consecutiveSuccessfulCompletions,
  consecutive_stall_or_regression_count: patch.consecutiveStallOrRegressionCount,
  swap_recommendation_count: patch.swapRecommendationCount,
  last_session_outcome_classification: patch.lastSessionOutcomeClassification,
  last_completed_at: patch.lastCompletedAt,
});

const progressionRowToEngineRecord = (row: EngineProgressionStateRow) => ({
  exerciseId: row.exercise_id,
  previousPerformanceReference: {
    weight: row.last_successful_load_weight ?? 0,
    reps: row.last_successful_load_reps ?? 0,
  },
  trend: row.trend,
  currentAction: row.current_action,
  consecutiveSuccessfulCompletions: row.consecutive_successful_completions,
  consecutiveStallOrRegressionCount: row.consecutive_stall_or_regression_count,
  swapRecommendationCount: row.swap_recommendation_count,
  lastSessionOutcomeClassification: row.last_session_outcome_classification,
  lastCompletedAt: row.last_completed_at,
});

const recentCompletionsFromHistory = (
  workouts: RecentWorkoutHistoryItem[]
): Array<{
  exerciseId: string;
  completedAt: string;
  quality: EngineSessionOutcomeClassification;
}> => {
  const grouped = new Map<
    string,
    Array<{ exerciseId: string; completedAt: string; quality: EngineSessionOutcomeClassification }>
  >();

  for (const workout of workouts) {
    const seenExerciseIds = new Set<string>();
    for (const setRow of workout.sets) {
      const exerciseId = String(setRow.exercise_id);
      if (seenExerciseIds.has(exerciseId)) {
        continue;
      }
      seenExerciseIds.add(exerciseId);
      const entries = grouped.get(exerciseId) ?? [];
      entries.push({
        exerciseId,
        completedAt: workout.workout.completed_at,
        quality: "complete_clean",
      });
      grouped.set(exerciseId, entries);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([, entries]) =>
      entries
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
        .slice(0, 3)
    );
};

const parseEngineCompleteSessionOutput = (
  value: unknown
): EngineCompleteSessionOutput | null => {
  if (!isObjectRecord(value)) return null;
  if (value.schemaVersion !== "engine.v1" || value.operation !== "complete_session") {
    return null;
  }

  const result = value.result;
  const statePatch = value.statePatch;
  if (!isObjectRecord(result) || !isObjectRecord(statePatch)) {
    return null;
  }

  const gamificationState = statePatch.gamificationState;
  if (
    !isObjectRecord(gamificationState) ||
    typeof gamificationState.xp !== "number" ||
    typeof gamificationState.level !== "number" ||
    typeof gamificationState.adherenceStreak !== "number" ||
    typeof gamificationState.completedSessionCount !== "number" ||
    typeof gamificationState.missedSessionCount !== "number" ||
    !isSessionOutcomeClassification(gamificationState.lastAdherenceOutcomeClassification) ||
    typeof gamificationState.lastAwardedAt !== "string"
  ) {
    return null;
  }

  if (
    !isSessionOutcomeClassification(result.sessionOutcomeClassification) ||
    !Array.isArray(result.updatedProgressionActionSummary) ||
    !isObjectRecord(result.awardedXpSummary) ||
    typeof result.awardedXpSummary.xpDelta !== "number" ||
    typeof result.awardedXpSummary.streakDelta !== "number" ||
    typeof result.awardedXpSummary.reason !== "string" ||
    typeof result.levelUpIndicator !== "boolean" ||
    !Array.isArray(result.warnings) ||
    result.warnings.some((warning) => typeof warning !== "string")
  ) {
    return null;
  }

  if (
    result.updatedProgressionActionSummary.some(
      (entry) =>
        !isObjectRecord(entry) ||
        typeof entry.exerciseId !== "string" ||
        !isProgressionAction(entry.action) ||
        !isProgressionTrend(entry.trend)
    )
  ) {
    return null;
  }

  const readinessState = statePatch.readinessState;
  if (
    readinessState !== undefined &&
    (!isObjectRecord(readinessState) || !isSystemicFatigue(readinessState.systemicFatigue))
  ) {
    return null;
  }

  const progressionState = statePatch.progressionState;
  if (progressionState !== undefined) {
    if (!isObjectRecord(progressionState)) {
      return null;
    }

    for (const [exerciseId, entry] of Object.entries(progressionState)) {
      if (!exerciseId || !isObjectRecord(entry)) {
        return null;
      }

      if (
        !isProgressionAction(entry.currentAction) ||
        !isProgressionTrend(entry.trend) ||
        typeof entry.consecutiveSuccessfulCompletions !== "number" ||
        typeof entry.consecutiveStallOrRegressionCount !== "number" ||
        typeof entry.swapRecommendationCount !== "number" ||
        !isSessionOutcomeClassification(entry.lastSessionOutcomeClassification) ||
        typeof entry.lastCompletedAt !== "string"
      ) {
        return null;
      }

      if (
        entry.lastSuccessfulLoad !== undefined &&
        (!isObjectRecord(entry.lastSuccessfulLoad) ||
          typeof entry.lastSuccessfulLoad.weight !== "number" ||
          typeof entry.lastSuccessfulLoad.reps !== "number")
      ) {
        return null;
      }
    }
  }

  if (
    !Array.isArray(value.decisionLog) ||
    !isObjectRecord(value.replayReceipt) ||
    typeof value.replayReceipt.inputHash !== "string" ||
    typeof value.replayReceipt.outputHash !== "string" ||
    typeof value.replayReceipt.seedUsed !== "string" ||
    typeof value.replayReceipt.effectiveAt !== "string" ||
    typeof value.replayReceipt.implementationVersion !== "string" ||
    typeof value.replayReceipt.policyVersion !== "string" ||
    typeof value.replayReceipt.referenceHash !== "string"
  ) {
    return null;
  }

  return value as EngineCompleteSessionOutput;
};

const parseEnginePlanSessionOutput = (value: unknown): EnginePlanSessionOutput | null => {
  if (!isObjectRecord(value)) return null;
  if (value.schemaVersion !== "engine.v1" || value.operation !== "plan_session") {
    return null;
  }

  const result = value.result;
  if (!isObjectRecord(result)) {
    return null;
  }

  if (
    typeof result.recommendedSessionId !== "string" ||
    typeof result.recommendedMovementFamily !== "string" ||
    !Array.isArray(result.selectedExerciseIds) ||
    result.selectedExerciseIds.some((id) => typeof id !== "string" || id.length === 0) ||
    typeof result.sessionRationale !== "string" ||
    !Array.isArray(result.progressionActionSummary) ||
    result.progressionActionSummary.some(
      (entry) =>
        !isObjectRecord(entry) ||
        typeof entry.exerciseId !== "string" ||
        !isProgressionAction(entry.action) ||
        !isProgressionTrend(entry.trend)
    ) ||
    !isObjectRecord(result.scoreBreakdown) ||
    typeof result.scoreBreakdown.progressionNeed !== "number" ||
    typeof result.scoreBreakdown.fatigueCompatibility !== "number" ||
    typeof result.scoreBreakdown.classBias !== "number" ||
    typeof result.scoreBreakdown.novelty !== "number"
  ) {
    return null;
  }

  if (
    !Array.isArray(value.decisionLog) ||
    !isObjectRecord(value.replayReceipt) ||
    typeof value.replayReceipt.inputHash !== "string" ||
    typeof value.replayReceipt.outputHash !== "string" ||
    typeof value.replayReceipt.seedUsed !== "string" ||
    typeof value.replayReceipt.effectiveAt !== "string" ||
    typeof value.replayReceipt.implementationVersion !== "string" ||
    typeof value.replayReceipt.policyVersion !== "string" ||
    typeof value.replayReceipt.referenceHash !== "string"
  ) {
    return null;
  }

  return value as EnginePlanSessionOutput;
};

const persistEngineSessionTrace = async (
  client: SupabaseClient,
  trace: EngineSessionTraceInsert
): Promise<{ ok: true; id: number } | { ok: false; error: string }> => {
  const findExistingTraceId = async () => {
    if (trace.operation === "complete_session" && trace.workout_log_id !== null) {
      const { data: existing } = await client
        .from("engine_session_traces")
        .select("id")
        .eq("user_id", trace.user_id)
        .eq("operation", trace.operation)
        .eq("workout_log_id", trace.workout_log_id)
        .maybeSingle();
      return toNullableNumericId((existing as { id?: unknown } | null)?.id);
    }

    if (trace.operation === "plan_session" && trace.cycle_session_id !== null) {
      const { data: existing } = await client
        .from("engine_session_traces")
        .select("id")
        .eq("user_id", trace.user_id)
        .eq("operation", trace.operation)
        .eq("cycle_session_id", trace.cycle_session_id)
        .maybeSingle();
      return toNullableNumericId((existing as { id?: unknown } | null)?.id);
    }

    return null;
  };

  if (trace.operation === "complete_session" && trace.workout_log_id !== null) {
    const { data: existing } = await client
      .from("engine_session_traces")
      .select("id")
      .eq("user_id", trace.user_id)
      .eq("operation", trace.operation)
      .eq("workout_log_id", trace.workout_log_id)
      .maybeSingle();
    const existingId = toNullableNumericId((existing as { id?: unknown } | null)?.id);
    if (existingId !== null) {
      return { ok: true, id: existingId };
    }
  }

  if (trace.operation === "plan_session" && trace.cycle_session_id !== null) {
    const { data: existing } = await client
      .from("engine_session_traces")
      .select("id")
      .eq("user_id", trace.user_id)
      .eq("operation", trace.operation)
      .eq("cycle_session_id", trace.cycle_session_id)
      .maybeSingle();
    const existingId = toNullableNumericId((existing as { id?: unknown } | null)?.id);
    if (existingId !== null) {
      return { ok: true, id: existingId };
    }
  }

  const { data, error } = await client
    .from("engine_session_traces")
    .insert(trace)
    .select("id")
    .single();

  const traceId = toNullableNumericId((data as { id?: unknown } | null)?.id);
  if (error || traceId === null) {
    if ((error as { code?: string } | null)?.code === "23505") {
      const existingId = await findExistingTraceId();
      if (existingId !== null) {
        return { ok: true, id: existingId };
      }
    }

    return {
      ok: false,
      error: error?.message ?? "Failed to persist engine session trace",
    };
  }

  return {
    ok: true,
    id: traceId,
  };
};

const createTraceWriteClient = () => createSupabaseAdminClient();

const rollbackEngineSessionTrace = async (
  client: SupabaseClient,
  traceId: number
) => {
  const { error } = await client.from("engine_session_traces").delete().eq("id", traceId);
  if (error) {
    logServerEvent({
      route: "/api/v0/sessions/generate",
      action: "rollbackEngineSessionTrace",
      severity: "error",
      reason: "dependency_error",
      details: { traceId },
      error,
    });
  }
};

const toCycleSlots = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((slot) => {
    if (!slot || typeof slot !== "object") {
      return [];
    }

    const candidate = slot as Record<string, unknown>;
    const exerciseId = candidate.exerciseId;
    const exerciseSlug = candidate.exerciseSlug;
    const exerciseName = candidate.exerciseName;
    const slotId = candidate.slotId;
    const slotIndex = candidate.slotIndex;
    const slotType = candidate.slotType;
    const setsMin = candidate.setsMin;
    const setsMax = candidate.setsMax;
    const repsMin = candidate.repsMin;
    const repsMax = candidate.repsMax;
    const restSeconds = candidate.restSeconds;
    const score = candidate.score;
    const rationale = candidate.rationale;

    if (
      typeof exerciseId !== "string" ||
      typeof exerciseSlug !== "string" ||
      typeof exerciseName !== "string" ||
      typeof slotId !== "string" ||
      typeof slotIndex !== "number" ||
      typeof slotType !== "string" ||
      typeof setsMin !== "number" ||
      typeof setsMax !== "number" ||
      typeof repsMin !== "number" ||
      typeof repsMax !== "number"
    ) {
      return [];
    }

    return [
      {
        slotId,
        slotIndex,
        slotType,
        exerciseId,
        exerciseSlug,
        exerciseName,
        setsMin,
        setsMax,
        repsMin,
        repsMax,
        restSeconds: typeof restSeconds === "number" ? restSeconds : 90,
        score: typeof score === "number" ? score : 1,
        rationale: typeof rationale === "string" ? rationale : "Cycle-backed slot",
      },
    ];
  });
};

const derivePlanSessionFocus = (
  session: Pick<EngineCycleSessionRow, "program_day_name" | "slot_payload">
) => {
  const rawSlots = Array.isArray(session.slot_payload) ? session.slot_payload : [];
  const firstSlot = rawSlots.find((slot) => isObjectRecord(slot)) as Record<string, unknown> | undefined;
  const movementPattern =
    typeof firstSlot?.movementPattern === "string" ? firstSlot.movementPattern : "push";
  const dayName = (session.program_day_name ?? "").toLowerCase();
  const region = dayName.includes("lower") || dayName.includes("leg") ? "lower" : "upper";
  const family = movementPattern === "pull" ? "pull" : "push";

  return `${region}_${family}`;
};

const hasTargetedGenerationRequest = (input: GenerateSessionRequest) => {
  return Boolean(input.slotId) || (input.excludeExerciseIds?.length ?? 0) > 0;
};

const matchesRequestedCycleProgramDay = (
  cycleSession: Pick<EngineCycleSessionRow, "program_day_id">,
  requestedProgramDayId: unknown
) => {
  const resolvedProgramDayId = toNullableNumericId(requestedProgramDayId);
  return (
    resolvedProgramDayId !== null &&
    resolvedProgramDayId === cycleSession.program_day_id
  );
};

const matchesActiveCycleCompletion = (
  cycleSession: Pick<EngineCycleSessionRow, "program_day_id" | "session_seed">,
  input: CompleteSessionRequest
) => {
  const resolvedProgramDayId = toNullableNumericId(input.programDayId);
  if (
    resolvedProgramDayId === null ||
    resolvedProgramDayId !== cycleSession.program_day_id
  ) {
    return false;
  }

  const activeSeed = normalizeOptionalSeed(cycleSession.session_seed);
  const submittedSeed = normalizeOptionalSeed(input.seed);

  if (activeSeed !== null) {
    return submittedSeed !== null && activeSeed === submittedSeed;
  }

  return true;
};

const buildCycleBackedCompleteSessionEngineInput = async (
  client: SupabaseClient,
  userId: string,
  input: CompleteSessionRequest,
  currentStats: UserStats,
  context: CycleBackedCompletionContext,
  requestId?: string | null
) => {
  const recentHistory = await getRecentWorkoutHistory(client, userId, 20);
  if (recentHistory.error) {
    return {
      ok: false as const,
      error: recentHistory.error,
    };
  }

  const progressionRecords = context.progression
    .slice()
    .sort((left, right) => left.exercise_id.localeCompare(right.exercise_id))
    .map(progressionRowToEngineRecord);

  const referenceSnapshot = {
    referenceVersion: "2026-03",
    exercises: input.exercises
      .slice()
      .sort((left, right) =>
        String(left.exerciseId).localeCompare(String(right.exerciseId))
      )
      .map((exercise) => ({
        id: String(exercise.exerciseId),
        slug: String(exercise.exerciseId),
        name: String(exercise.exerciseId),
        movementPattern: "unknown",
        equipment: [],
        tags: [],
      })),
    programs: context.plan.primary_program_id
      ? [
          {
            id: String(context.plan.primary_program_id),
            slug: String(context.plan.primary_program_id),
            name: String(context.plan.primary_program_id),
            daysPerWeek: currentStats.activeProgram?.daysPerWeek ?? 3,
          },
        ]
      : [],
  };

  let referenceHash: string;
  try {
    referenceHash = computeCanonicalReplayReferenceHash(referenceSnapshot);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to compute reference hash",
    };
  }

  return {
    ok: true as const,
    input: {
      schemaVersion: "engine.v1",
      operation: "complete_session",
      determinism: {
        seed: input.seed,
        effectiveAt: input.completedAt,
        ruleVersion: "rules-2026-03",
        referenceHash,
        canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      },
      referenceSnapshot,
      stateSnapshot: {
        athleteProfile: {
          height: 0,
          weight: 0,
          trainingAge: 0,
          goalBias: "general",
          availableDaysPerWeek: currentStats.activeProgram?.daysPerWeek ?? 3,
          classArchetype:
            context.plan.resolved_class_archetype ??
            context.gamification.class_archetype ??
            "hybrid",
        },
        readinessState: {
          systemicFatigue: toEngineSystemicFatigue(currentStats.preferences.fatigueLevel),
          muscleFatigue: toEngineMuscleFatigue(currentStats),
        },
        injuryState: {
          activeLimitations: currentStats.preferences.injuries,
          blockedMovementPatterns: [],
        },
        performanceState: {
          knownLifts: toEngineKnownLifts(currentStats),
        },
        progressionState: {
          records: progressionRecords,
        },
        gamificationState: {
          xp: context.gamification.xp,
          level: context.gamification.level,
          adherenceStreak: context.gamification.adherence_streak,
          completedSessionCount: Number(context.gamification.completed_session_count ?? 0),
          missedSessionCount: Number(context.gamification.missed_session_count ?? 0),
          lastAdherenceOutcomeClassification: isSessionOutcomeClassification(
            context.gamification.last_adherence_outcome_classification
          )
            ? context.gamification.last_adherence_outcome_classification
            : "complete_clean",
          lastAwardedAt:
            context.gamification.last_awarded_at ??
            recentHistory.workouts[0]?.workout.completed_at ??
            input.startedAt,
        },
        activeProgramState: {
          programId: String(context.plan.primary_program_id ?? input.programDayId),
          currentDayIndex: currentStats.activeProgram?.currentDayIndex ?? 0,
          currentMicrocycle: Number((context.plan.current_microcycle_index ?? 0) + 1),
        },
        recentCompletions: recentCompletionsFromHistory(recentHistory.workouts),
      },
      policySnapshot: {
        noveltyBudget: 1,
        classArchetypeBias: 0.1,
        fatigueBlockThreshold: "severe",
        seededTieBreakBand: 0.05,
      },
      request: {
        session: input,
      },
      metadata: {
        correlationId: requestId ?? `complete-session-${userId}`,
      },
    },
  };
};

const buildCycleBackedPlanSessionEngineInput = async (
  client: SupabaseClient,
  userId: string,
  currentStats: UserStats,
  context: CycleBackedGenerationContext,
  exercises: ExerciseRow[],
  requestId?: string | null
) => {
  const recentHistory = await getRecentWorkoutHistory(client, userId, 20);
  if (recentHistory.error) {
    return {
      ok: false as const,
      error: recentHistory.error,
    };
  }

  const effectiveAt =
    context.gamification.last_awarded_at ??
    recentHistory.workouts[0]?.workout.completed_at ??
    currentStats.activeProgram?.startedAt;
  if (!effectiveAt) {
    return {
      ok: false as const,
      error: "Missing effectiveAt for cycle-backed plan_session input",
    };
  }

  const referenceSnapshot = {
    referenceVersion: "2026-03",
    exercises: exercises
      .slice()
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .map((exercise) => ({
        id: String(exercise.id),
        slug: exercise.slug,
        name: exercise.name,
        movementPattern: exercise.movement_pattern ?? "",
        equipment: normalizeStringList(exercise.equipment),
        tags: normalizeStringList(exercise.tags),
      })),
    programs: context.plan.primary_program_id
      ? [
          {
            id: String(context.plan.primary_program_id),
            slug: String(context.plan.primary_program_id),
            name: String(context.plan.primary_program_id),
            daysPerWeek: currentStats.activeProgram?.daysPerWeek ?? 3,
          },
        ]
      : [],
  };

  let referenceHash: string;
  try {
    referenceHash = computeCanonicalReplayReferenceHash(referenceSnapshot);
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to compute reference hash",
    };
  }

  return {
    ok: true as const,
    input: {
      schemaVersion: "engine.v1",
      operation: "plan_session",
      determinism: {
        seed:
          normalizeOptionalSeed(context.session.session_seed) ??
          `cycle-plan-${context.session.session_index}`,
        effectiveAt:
          context.gamification.last_awarded_at ??
          recentHistory.workouts[0]?.workout.completed_at ??
          effectiveAt,
        ruleVersion: "rules-2026-03",
        referenceHash,
        canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      },
      referenceSnapshot,
      stateSnapshot: {
        athleteProfile: {
          height: 0,
          weight: 0,
          trainingAge: 0,
          goalBias: "general",
          availableDaysPerWeek: currentStats.activeProgram?.daysPerWeek ?? 3,
          classArchetype:
            context.plan.resolved_class_archetype ??
            context.gamification.class_archetype ??
            "hybrid",
        },
        readinessState: {
          systemicFatigue: toEngineSystemicFatigue(currentStats.preferences.fatigueLevel),
          muscleFatigue: toEngineMuscleFatigue(currentStats),
        },
        injuryState: {
          activeLimitations: currentStats.preferences.injuries,
          blockedMovementPatterns: [],
        },
        performanceState: {
          knownLifts: toEngineKnownLifts(currentStats),
        },
        progressionState: {
          records: context.progression
            .slice()
            .sort((left, right) => left.exercise_id.localeCompare(right.exercise_id))
            .map(progressionRowToEngineRecord),
        },
        gamificationState: {
          xp: context.gamification.xp,
          level: context.gamification.level,
          adherenceStreak: context.gamification.adherence_streak,
          completedSessionCount: Number(context.gamification.completed_session_count ?? 0),
          missedSessionCount: Number(context.gamification.missed_session_count ?? 0),
          lastAdherenceOutcomeClassification: isSessionOutcomeClassification(
            context.gamification.last_adherence_outcome_classification
          )
            ? context.gamification.last_adherence_outcome_classification
            : "complete_clean",
          lastAwardedAt:
            context.gamification.last_awarded_at ??
            recentHistory.workouts[0]?.workout.completed_at ??
            effectiveAt,
        },
        activeProgramState: {
          programId: String(context.plan.primary_program_id ?? context.session.program_day_id),
          currentDayIndex: currentStats.activeProgram?.currentDayIndex ?? 0,
          currentMicrocycle: Number((context.plan.current_microcycle_index ?? 0) + 1),
        },
        recentCompletions: recentCompletionsFromHistory(recentHistory.workouts),
      },
      policySnapshot: {
        noveltyBudget: 1,
        classArchetypeBias: 0.1,
        fatigueBlockThreshold: "severe",
        seededTieBreakBand: 0.05,
      },
      request: {
        programId: String(context.plan.primary_program_id ?? context.session.program_day_id),
        sessionFocus: derivePlanSessionFocus(context.session),
        microcycleIndex: Number((context.plan.current_microcycle_index ?? 0) + 1),
      },
      metadata: {
        correlationId: requestId ?? `generate-session-${userId}`,
      },
    },
  };
};

const rollbackNormalizedCycleCompletion = async (
  client: SupabaseClient,
  params: {
    session: Pick<EngineCycleSessionRow, "id" | "completed_at">;
    plan: Pick<EngineCyclePlanRow, "id" | "current_session_index">;
    gamification: EngineGamificationStateRow | null;
    sessionUpdated: boolean;
    gamificationUpdated: boolean;
    progressionRollbacks: ProgressionRollbackEntry[];
    planUpdated: boolean;
  }
) => {
  const rollbackErrors: string[] = [];

  if (params.planUpdated) {
    const { error } = await client
      .from("engine_cycle_plans")
      .update({
        current_session_index: params.plan.current_session_index,
      })
      .eq("id", params.plan.id);
    if (error) {
      rollbackErrors.push(error.message ?? "Failed to roll back normalized cycle state");
    }
  }

  for (const rollback of [...params.progressionRollbacks].reverse()) {
    if (rollback.existed) {
      const { error } = await client
        .from("engine_progression_states")
        .update({
          current_action: rollback.previous.current_action,
          trend: rollback.previous.trend,
          last_successful_load_weight: rollback.previous.last_successful_load_weight ?? null,
          last_successful_load_reps: rollback.previous.last_successful_load_reps ?? null,
          consecutive_successful_completions:
            rollback.previous.consecutive_successful_completions,
          consecutive_stall_or_regression_count:
            rollback.previous.consecutive_stall_or_regression_count,
          swap_recommendation_count: rollback.previous.swap_recommendation_count,
          last_session_outcome_classification:
            rollback.previous.last_session_outcome_classification,
          last_completed_at: rollback.previous.last_completed_at,
        })
        .eq("plan_id", rollback.previous.plan_id)
        .eq("exercise_id", rollback.previous.exercise_id);
      if (error) {
        rollbackErrors.push(error.message ?? "Failed to roll back normalized cycle state");
      }
      continue;
    }

    const { error } = await client
      .from("engine_progression_states")
      .delete()
      .eq("plan_id", params.plan.id)
      .eq("exercise_id", rollback.exerciseId);
    if (error) {
      rollbackErrors.push(error.message ?? "Failed to roll back normalized cycle state");
    }
  }

  if (params.gamificationUpdated && params.gamification) {
    const { error } = await client
      .from("engine_gamification_states")
      .update({
        xp: params.gamification.xp,
        level: params.gamification.level,
        adherence_streak: params.gamification.adherence_streak,
        completed_session_count: params.gamification.completed_session_count ?? null,
        missed_session_count: params.gamification.missed_session_count ?? null,
        last_adherence_outcome_classification:
          params.gamification.last_adherence_outcome_classification ?? null,
        last_awarded_at: params.gamification.last_awarded_at ?? null,
        class_archetype: params.gamification.class_archetype ?? null,
      })
      .eq("id", params.gamification.id);
    if (error) {
      rollbackErrors.push(error.message ?? "Failed to roll back normalized cycle state");
    }
  }

  if (params.sessionUpdated) {
    const { error } = await client
      .from("engine_cycle_sessions")
      .update({ completed_at: params.session.completed_at })
      .eq("id", params.session.id);
    if (error) {
      rollbackErrors.push(error.message ?? "Failed to roll back normalized cycle state");
    }
  }

  return rollbackErrors[0] ?? null;
};

const buildCycleCompatibilityProjection = (
  stats: UserStats,
  projection: {
    currentDayIndex: number;
    currentMicrocycle: number;
  }
): UserStats => {
  if (!stats.activeProgram) {
    return stats;
  }

  return {
    ...stats,
    activeProgram: {
      ...stats.activeProgram,
      currentDayIndex: projection.currentDayIndex,
      currentMicrocycle: projection.currentMicrocycle,
    },
  };
};

const persistCycleCompatibilityProjection = async (
  client: SupabaseClient,
  userId: string,
  projection: CycleCompatibilityProjection | null
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (projection === null) {
    return { ok: true };
  }

  const { data: userRow, error: userError } = await client
    .from("users")
    .select("stats_json")
    .eq("id", userId)
    .single();
  if (userError) {
    return {
      ok: false,
      error: userError.message ?? "Failed to load user cycle projection",
    };
  }

  const currentStats = (userRow?.stats_json as UserStats | null) ?? getDefaultUserStats();
  const projectedStats = buildCycleCompatibilityProjection(currentStats, projection);
  const { error } = await client.from("users").update({ stats_json: projectedStats }).eq("id", userId);
  if (error) {
    return {
      ok: false,
      error: error.message ?? "Failed to update user cycle projection",
    };
  }

  return { ok: true };
};

const loadCurrentCycleCompatibilityProjection = async (
  client: SupabaseClient,
  plan: Pick<EngineCyclePlanRow, "id" | "current_session_index">
): Promise<
  | { ok: true; projection: CycleCompatibilityProjection | null }
  | { ok: false; error: string }
> => {
  const { data: sessionRow, error } = await client
    .from("engine_cycle_sessions")
    .select("planned_day_of_week, microcycle_index")
    .eq("plan_id", plan.id)
    .eq("session_index", plan.current_session_index)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message ?? "Failed to load current normalized cycle session",
    };
  }

  if (!sessionRow) {
    return { ok: true, projection: null };
  }

  return {
    ok: true,
    projection: {
      currentDayIndex: Number(
        (sessionRow as { planned_day_of_week?: unknown }).planned_day_of_week
      ),
      currentMicrocycle:
        Number((sessionRow as { microcycle_index?: unknown }).microcycle_index) + 1,
    },
  };
};

const repairCompatibilityProjectionForCurrentCycle = async (
  client: SupabaseClient,
  userId: string,
  plan: EngineCyclePlanRow | null
): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (!plan) {
    return { ok: true };
  }

  const projectionResult = await loadCurrentCycleCompatibilityProjection(client, plan);
  if (!projectionResult.ok) {
    return projectionResult;
  }

  return persistCycleCompatibilityProjection(client, userId, projectionResult.projection);
};

const syncNormalizedCycleCompletion = async (
  client: SupabaseClient,
  context: CycleBackedCompletionContext,
  engineOutput: EngineCompleteSessionOutput
): Promise<SyncNormalizedCycleResult> => {
  const { plan, session, gamification } = context;
  const { gamificationState, progressionState } = engineOutput.statePatch;

  let sessionUpdated = false;
  if (session.completed_at === null) {
    const { error: sessionUpdateError } = await client
      .from("engine_cycle_sessions")
      .update({ completed_at: gamificationState.lastAwardedAt })
      .eq("id", session.id);
    if (sessionUpdateError) {
      return {
        ok: false,
        error: sessionUpdateError.message ?? "Failed to synchronize normalized cycle state",
      };
    }
    sessionUpdated = true;
  }

  let gamificationUpdated = false;
  const { error: gamificationUpdateError } = await client
    .from("engine_gamification_states")
    .update(toNormalizedGamificationPatchRow(gamificationState))
    .eq("id", gamification.id);

  if (gamificationUpdateError) {
    const rollbackError = await rollbackNormalizedCycleCompletion(client, {
      session,
      plan,
      gamification,
      sessionUpdated,
      gamificationUpdated,
      progressionRollbacks: [],
      planUpdated: false,
    });
    return {
      ok: false,
      error:
        rollbackError ??
        gamificationUpdateError.message ??
        "Failed to synchronize normalized cycle state",
    };
  }
  gamificationUpdated = true;

  const progressionRollbacks: ProgressionRollbackEntry[] = [];
  if (progressionState) {
    for (const [exerciseId, patch] of Object.entries(progressionState)) {
      const previous = context.progression.find((row) => row.exercise_id === exerciseId) ?? null;
      const payload = toProgressionInsertPayload(gamification.user_id, plan.id, exerciseId, patch);

      if (previous) {
        const { error } = await client
          .from("engine_progression_states")
          .update({
            current_action: payload.current_action,
            trend: payload.trend,
            last_successful_load_weight: payload.last_successful_load_weight,
            last_successful_load_reps: payload.last_successful_load_reps,
            consecutive_successful_completions: payload.consecutive_successful_completions,
            consecutive_stall_or_regression_count:
              payload.consecutive_stall_or_regression_count,
            swap_recommendation_count: payload.swap_recommendation_count,
            last_session_outcome_classification: payload.last_session_outcome_classification,
            last_completed_at: payload.last_completed_at,
          })
          .eq("plan_id", previous.plan_id)
          .eq("exercise_id", previous.exercise_id);

        if (error) {
          const rollbackError = await rollbackNormalizedCycleCompletion(client, {
            session,
            plan,
            gamification,
            sessionUpdated,
            gamificationUpdated,
            progressionRollbacks,
            planUpdated: false,
          });
          return {
            ok: false,
            error:
              rollbackError ?? error.message ?? "Failed to synchronize normalized cycle state",
          };
        }

        progressionRollbacks.push({ existed: true, previous });
        continue;
      }

      const { error } = await client.from("engine_progression_states").insert(payload);
      if (error) {
        const rollbackError = await rollbackNormalizedCycleCompletion(client, {
          session,
          plan,
          gamification,
          sessionUpdated,
          gamificationUpdated,
          progressionRollbacks,
          planUpdated: false,
        });
        return {
          ok: false,
          error:
            rollbackError ?? error.message ?? "Failed to synchronize normalized cycle state",
        };
      }

      progressionRollbacks.push({ existed: false, exerciseId });
    }
  }

  let planUpdated = false;

  const { error: planUpdateError } = await client
    .from("engine_cycle_plans")
    .update({
      current_session_index: plan.current_session_index + 1,
    })
    .eq("id", plan.id);
  if (planUpdateError) {
    const rollbackError = await rollbackNormalizedCycleCompletion(client, {
      session,
      plan,
      gamification,
      sessionUpdated,
      gamificationUpdated,
      progressionRollbacks,
      planUpdated,
    });
    return {
      ok: false,
      error:
        rollbackError ??
        planUpdateError.message ??
        "Failed to synchronize normalized cycle state",
    };
  }
  planUpdated = true;

  const { data: nextSessionRow, error: nextSessionError } = await client
    .from("engine_cycle_sessions")
    .select("planned_day_of_week, microcycle_index")
    .eq("plan_id", plan.id)
    .eq("session_index", plan.current_session_index + 1)
    .maybeSingle();
  if (nextSessionError) {
    const rollbackError = await rollbackNormalizedCycleCompletion(client, {
      session,
      plan,
      gamification,
      sessionUpdated,
      gamificationUpdated,
      progressionRollbacks,
      planUpdated,
    });
    return {
      ok: false,
      error:
        rollbackError ??
        nextSessionError.message ??
        "Failed to load next normalized cycle session",
    };
  }

  return {
    ok: true,
    compatibilityProjection: nextSessionRow
      ? {
          currentDayIndex: Number(nextSessionRow.planned_day_of_week),
          currentMicrocycle: Number(nextSessionRow.microcycle_index) + 1,
        }
      : null,
  };
};

const toAtomicCompletionResult = (data: unknown): AtomicCompletionRpcResult | null => {
  const firstRow = Array.isArray(data) ? data[0] : data;
  if (!firstRow || typeof firstRow !== "object") return null;

  const firstObject = firstRow as Record<string, unknown>;
  const workoutLogId = toNullableNumericId(firstObject.workout_log_id);
  if (workoutLogId === null) {
    return null;
  }

  return {
    workoutLogId,
    reused: firstObject.reused === true,
  };
};

const rollbackWorkoutLog = async (
  client: SupabaseClient,
  userId: string,
  workoutLogId: number
) => {
  const { data: workoutRow, error: workoutLookupError } = await client
    .from("workout_logs")
    .select("id")
    .eq("id", workoutLogId)
    .eq("user_id", userId)
    .maybeSingle();
  if (workoutLookupError || !workoutRow) {
    logServerEvent({
      route: "/api/v0/sessions/complete",
      action: "rollbackWorkoutLog",
      severity: "error",
      reason: "dependency_error",
      details: { workoutLogId },
      error:
        workoutLookupError ??
        new Error("Refusing to roll back workout log without matching user ownership"),
    });
    return;
  }

  const { error: traceDeleteError } = await client
    .from("engine_session_traces")
    .delete()
    .eq("user_id", userId)
    .eq("workout_log_id", workoutLogId);
  if (traceDeleteError) {
    logServerEvent({
      route: "/api/v0/sessions/complete",
      action: "rollbackWorkoutLog",
      severity: "error",
      reason: "dependency_error",
      details: { workoutLogId },
      error: traceDeleteError,
    });
  }

  const { error: setLogDeleteError } = await client
    .from("set_logs")
    .delete()
    .eq("workout_log_id", workoutLogId);
  if (setLogDeleteError) {
    logServerEvent({
      route: "/api/v0/sessions/complete",
      action: "rollbackWorkoutLog",
      severity: "error",
      reason: "dependency_error",
      details: { workoutLogId },
      error: setLogDeleteError,
    });
  }

  const { error } = await client
    .from("workout_logs")
    .delete()
    .eq("id", workoutLogId)
    .eq("user_id", userId);
  if (error) {
    logServerEvent({
      route: "/api/v0/sessions/complete",
      action: "rollbackWorkoutLog",
      severity: "error",
      reason: "dependency_error",
      details: { workoutLogId },
      error,
    });
  }
};

const restoreUserStatsProjection = async (
  client: SupabaseClient,
  userId: string,
  stats: UserStats
) => {
  const { error } = await client.from("users").update({ stats_json: stats }).eq("id", userId);
  if (error) {
    logServerEvent({
      route: "/api/v0/sessions/complete",
      action: "restoreUserStatsProjection",
      severity: "error",
      reason: "dependency_error",
      userId,
      error,
    });
  }
};

export type RecentWorkoutHistoryItem = {
  workout: WorkoutLogRow;
  dayName: string;
  sets: SetLogRow[];
};

const toMuscleMappingRows = (rows: MuscleMapJoinRow[]): MuscleMappingRow[] => {
  return rows.flatMap((row) => {
    const nested = Array.isArray(row.muscle_groups)
      ? row.muscle_groups[0]
      : row.muscle_groups;
    const slug = row.muscle_group_slug ?? nested?.slug ?? null;
    if (!slug) return [];
    return [
      {
        exercise_id: row.exercise_id,
        muscle_group_slug: slug,
        role: row.role,
        contribution: row.contribution,
      },
    ];
  });
};

const loadActiveCyclePlan = async (client: SupabaseClient, userId: string) => {
  const { data: planRow, error } = await client
    .from("engine_cycle_plans")
    .select(
      "id, user_id, primary_program_id, resolved_class_archetype, current_session_index, current_microcycle_index, current_mesocycle_index, is_active"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return {
    plan: planRow as EngineCyclePlanRow | null,
    error: error?.message ?? null,
  };
};

// -----------------------------------------------------------------------------
// Generate Session Handler
// -----------------------------------------------------------------------------

export async function handleGenerateSession(
  userId: string,
  input: GenerateSessionRequest
): Promise<GenerateSessionResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    const { plan: cyclePlan, error: cyclePlanError } = await loadActiveCyclePlan(supabase, userId);
    if (cyclePlanError) {
      return {
        status: "error",
        errors: ["Failed to load active cycle plan"],
      };
    }
    const targetedGeneration = hasTargetedGenerationRequest(input);
    let cycleBackedFallback: {
      cycleSessionId: number;
      programDayId: string;
      programDayName: string;
      seed: string;
      projectedFatigueCost: Record<string, number>;
    } | null = null;
    let cycleGenerationContext: CycleBackedGenerationContext | null = null;

    if (cyclePlan) {
      const { data: cycleSessionRow, error: cycleSessionError } = await supabase
        .from("engine_cycle_sessions")
        .select(
          "id, plan_id, user_id, session_index, program_day_id, program_day_name, session_seed, slot_payload, projected_fatigue_cost, completed_at"
        )
        .eq("plan_id", cyclePlan.id)
        .eq("session_index", cyclePlan.current_session_index)
        .maybeSingle();

      if (cycleSessionError) {
        return {
          status: "error",
          errors: ["Failed to load active cycle session"],
        };
      }

      const cycleSession = cycleSessionRow as EngineCycleSessionRow | null;
      if (!cycleSession) {
        return {
          status: "error",
          errors: ["Active cycle is completed"],
        };
      }

      if (
        cycleSession.completed_at == null &&
        !matchesRequestedCycleProgramDay(cycleSession, input.programDayId)
      ) {
        return {
          status: "error",
          errors: ["Requested program day does not match the active cycle session"],
        };
      }

      if (
        cycleSession.completed_at == null &&
        !targetedGeneration
      ) {
        const cycleSlots = toCycleSlots(cycleSession.slot_payload);
        if (cycleSlots.length > 0) {
        return {
          status: "success",
          session: {
            programDayId: String(cycleSession.program_day_id),
            programDayName: cycleSession.program_day_name ?? "Cycle Session",
            seed:
              cycleSession.session_seed ??
              input.seed ??
              `cycle-session-${cycleSession.session_index}`,
            generatedAt: new Date().toISOString(),
            slots: cycleSlots,
            projectedFatigueCost: cycleSession.projected_fatigue_cost ?? {},
          },
          loadRecommendations: [],
        };
      }

        cycleBackedFallback = {
          cycleSessionId: cycleSession.id,
          programDayId: String(cycleSession.program_day_id),
          programDayName: cycleSession.program_day_name ?? "Cycle Session",
          seed:
            cycleSession.session_seed ??
            input.seed ??
            `cycle-session-${cycleSession.session_index}`,
          projectedFatigueCost: cycleSession.projected_fatigue_cost ?? {},
        };

        const { data: gamificationRow, error: gamificationError } = await supabase
          .from("engine_gamification_states")
          .select(
            "id, user_id, plan_id, xp, level, adherence_streak, completed_session_count, missed_session_count, last_adherence_outcome_classification, last_awarded_at, class_archetype"
          )
          .eq("plan_id", cyclePlan.id)
          .maybeSingle();

        if (gamificationError) {
          return {
            status: "error",
            errors: [gamificationError.message ?? "Failed to load normalized gamification state"],
          };
        }

        if (!gamificationRow) {
          return {
            status: "error",
            errors: ["Missing normalized gamification state"],
          };
        }

        const { data: progressionRows, error: progressionError } = await supabase
          .from("engine_progression_states")
          .select(
            "id, user_id, plan_id, exercise_id, current_action, trend, last_successful_load_weight, last_successful_load_reps, consecutive_successful_completions, consecutive_stall_or_regression_count, swap_recommendation_count, last_session_outcome_classification, last_completed_at"
          )
          .eq("plan_id", cyclePlan.id);

        if (progressionError) {
          return {
            status: "error",
            errors: [progressionError.message ?? "Failed to load normalized progression state"],
          };
        }

        cycleGenerationContext = {
          plan: cyclePlan,
          session: cycleSession,
          gamification: gamificationRow as EngineGamificationStateRow,
          progression: (progressionRows ?? []) as EngineProgressionStateRow[],
        };
      }
    }

    // 1. Load program day with slots
    const { data: programDay, error: dayError } = await supabase
      .from("program_days")
      .select(
        `
        id,
        program_id,
        name,
        day_index,
        program_slots (
          id,
          program_day_id,
          slot_index,
          slot_type,
          lock_type,
          locked_exercise_id,
          muscle_targets,
          sets_min,
          sets_max,
          reps_min,
          reps_max,
          tags_required
        )
      `
      )
      .eq(
        "id",
        toLookupId(cycleBackedFallback?.programDayId ?? input.programDayId)
      )
      .single();

    if (dayError || !programDay) {
      return {
        status: "error",
        errors: ["Program day not found"],
      };
    }

    // 2. Load all exercises
    const { data: exercises, error: exError } = await supabase
      .from("exercises")
      .select(
        `
        id,
        slug,
        name,
        movement_pattern,
        equipment,
        tags,
        contraindications,
        is_bodyweight
      `
      );

    if (exError || !exercises) {
      return {
        status: "error",
        errors: ["Failed to load exercises"],
      };
    }

    // 3. Load muscle mappings
    const { data: muscleMaps, error: mapError } = await supabase
      .from("exercise_muscle_map")
      .select("exercise_id, role, contribution, muscle_groups!inner(slug)");

    if (mapError || !muscleMaps) {
      return {
        status: "error",
        errors: ["Failed to load muscle mappings"],
      };
    }

    // 4. Load user stats
    const { data: user } = await supabase
      .from("users")
      .select("stats_json")
      .eq("id", userId)
      .single();

    const userStats: UserStats = (user?.stats_json as UserStats) ?? getDefaultUserStats();

    // 5. Transform to engine types
    const slots = (programDay.program_slots ?? []) as SessionProgramSlotRow[];
    const engineProgramDay = toProgramDay(programDay, slots);

    const engineExercises = (exercises as ExerciseRow[]).map(toExerciseData);
    const engineMuscleMappings = toMuscleMappingRows(muscleMaps as MuscleMapJoinRow[]).map(
      toMuscleMapping
    );
    const fatigueMap = buildFatigueState(userStats);

    const requestedSlotId = input.slotId ? String(input.slotId) : null;
    const excludedExerciseIds = Array.from(
      new Set((input.excludeExerciseIds ?? []).map((id) => String(id)))
    );
    let planExplanation: GenerateSessionResponse["explanation"];
    let parsedPlanOutput: EnginePlanSessionOutput | null = null;
    let planTraceInputMaterial: Record<string, unknown> | null = null;

    let targetProgramDay = engineProgramDay;
    if (requestedSlotId) {
      const targetSlot = engineProgramDay.slots.find((slot) => slot.id === requestedSlotId);
      if (!targetSlot) {
        return {
          status: "error",
          errors: ["Program slot not found"],
        };
      }

      targetProgramDay = {
        ...engineProgramDay,
        slots: [targetSlot],
      };
    }

    let filteredEngineExercises = engineExercises;
    if (cycleBackedFallback && cycleGenerationContext) {
      const planInputResult = await buildCycleBackedPlanSessionEngineInput(
        supabase,
        userId,
        userStats,
        cycleGenerationContext,
        exercises as ExerciseRow[],
        null
      );

      if (!planInputResult.ok) {
        return {
          status: "error",
          errors: [planInputResult.error],
        };
      }

      const engineOutput = await runEngineInput(planInputResult.input);
      planTraceInputMaterial = toReplayTraceInputMaterial(planInputResult.input);
      parsedPlanOutput = parseEnginePlanSessionOutput(engineOutput);
      if (!parsedPlanOutput) {
        return {
          status: "error",
          errors: ["Engine returned invalid plan_session output"],
        };
      }

      const selectedExerciseIds = new Set(parsedPlanOutput.result.selectedExerciseIds);
      filteredEngineExercises = engineExercises.filter((exercise) =>
        selectedExerciseIds.has(String(exercise.id))
      );
      if (filteredEngineExercises.length === 0) {
        return {
          status: "error",
          errors: ["Engine returned no selectable exercises for the active cycle session"],
        };
      }
    }

    // 6. Generate session
    const session = generateSession({
      programDay: targetProgramDay,
      exercises: filteredEngineExercises,
      muscleMappings: engineMuscleMappings,
      fatigue: fatigueMap,
      equipment: userStats.preferences.equipment,
      injuries: userStats.preferences.injuries,
      fatigueLevel: userStats.preferences.fatigueLevel,
      seed: cycleBackedFallback?.seed ?? input.seed,
      excludeExerciseIds: excludedExerciseIds,
    });

    if (requestedSlotId && session.slots.length === 0) {
      return {
        status: "error",
        errors: ["No alternative exercise available for this slot"],
      };
    }

    // 7. Generate load recommendations for each filled slot
    const exercisesForLoad = session.slots.map((slot) => ({
      exerciseId: slot.exerciseId,
      repsMin: slot.repsMin,
      repsMax: slot.repsMax,
    }));

    const loadRecommendations = generateLoadRecommendations(
      exercisesForLoad,
      userStats.capacities
    );

    if (cycleBackedFallback) {
      let planTraceClient: SupabaseClient | null = null;
      let persistedPlanTraceId: number | null = null;

      if (parsedPlanOutput && cycleGenerationContext) {
        const traceInsert: EngineSessionTraceInsert = {
          user_id: userId,
          operation: "plan_session",
          cycle_plan_id: cycleGenerationContext.plan.id,
          cycle_session_id: cycleGenerationContext.session.id,
          workout_log_id: null,
          input_material: planTraceInputMaterial,
          decision_log: parsedPlanOutput.decisionLog,
          replay_receipt: parsedPlanOutput.replayReceipt,
          engine_result: parsedPlanOutput.result as unknown as Record<string, unknown>,
        };
        const traceClient = createTraceWriteClient();
        if (!traceClient) {
          return {
            status: "error",
            errors: ["Engine trace persistence requires a server trace writer"],
          };
        }
        const persistedTrace = await persistEngineSessionTrace(traceClient, traceInsert);
        if (!persistedTrace.ok) {
          return {
            status: "error",
            errors: [persistedTrace.error],
          };
        }
        planTraceClient = traceClient;
        persistedPlanTraceId = persistedTrace.id;

        if (traceInsert.workout_log_id === null && parsedPlanOutput) {
          planExplanation = derivePlanSessionExplanation({
            id: persistedTrace.id,
            user_id: traceInsert.user_id,
            operation: traceInsert.operation,
            cycle_plan_id: traceInsert.cycle_plan_id,
            cycle_session_id: traceInsert.cycle_session_id,
            workout_log_id: traceInsert.workout_log_id,
            input_material: traceInsert.input_material,
            decision_log: traceInsert.decision_log,
            replay_receipt: traceInsert.replay_receipt,
            engine_result: traceInsert.engine_result,
          }) ?? undefined;
        }
      }

      const { error: persistCycleSessionError } = await supabase
        .from("engine_cycle_sessions")
        .update({
          slot_payload: session.slots,
          projected_fatigue_cost: session.projectedFatigueCost,
        })
        .eq("id", cycleBackedFallback.cycleSessionId);
      if (persistCycleSessionError) {
        if (persistedPlanTraceId !== null && planTraceClient) {
          await rollbackEngineSessionTrace(planTraceClient, persistedPlanTraceId);
        }
        return {
          status: "error",
          errors: ["Failed to persist generated active cycle session"],
        };
      }
    }

    return {
      status: "success",
      session: cycleBackedFallback
        ? {
            ...session,
            programDayId: cycleBackedFallback.programDayId,
            programDayName: cycleBackedFallback.programDayName,
            seed: cycleBackedFallback.seed,
            projectedFatigueCost:
              Object.keys(cycleBackedFallback.projectedFatigueCost).length > 0
                ? cycleBackedFallback.projectedFatigueCost
                : session.projectedFatigueCost,
          }
        : session,
      loadRecommendations,
      explanation: planExplanation,
    };
  } catch (error) {
    logServerEvent({
      route: "/api/v0/sessions/generate",
      action: "handleGenerateSession",
      severity: "error",
      reason: "unexpected_error",
      userId,
      error,
    });
    return {
      status: "error",
      errors: ["An unexpected error occurred"],
    };
  }
}

// -----------------------------------------------------------------------------
// Complete Session Handler
// -----------------------------------------------------------------------------

export async function handleCompleteSession(
  userId: string,
  input: CompleteSessionRequest,
  options: CompleteSessionOptions = {}
): Promise<CompleteSessionResponse> {
  const supabase = await createSupabaseServerActionClient();

  try {
    // 1. Load current user stats
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("stats_json")
      .eq("id", userId)
      .single();

    if (userError) {
      return {
        status: "error",
        errors: ["Failed to load user data"],
      };
    }

    const currentStats: UserStats = (user?.stats_json as UserStats) ?? getDefaultUserStats();
    const idempotencyKey =
      normalizeIdempotencyKey(options.idempotencyKey) ??
      deriveCompletionIdempotencyKey(userId, input);
    const resolvedProgramDayId = toNullableNumericId(input.programDayId);
    let resolvedProgramId = toNullableNumericId(currentStats.activeProgram?.programId ?? null);
    let resolvedProgramDayName: string | null = null;
    let cycleCompletionContext: CycleBackedCompletionContext | null = null;

    const { plan: activeCyclePlan, error: activeCyclePlanError } =
      await loadActiveCyclePlan(supabase, userId);
    if (activeCyclePlanError) {
      return {
        status: "error",
        errors: ["Failed to load active cycle plan"],
      };
    }
    if (activeCyclePlan) {
      const { data: activeCycleSessionRow, error: activeCycleSessionError } = await supabase
        .from("engine_cycle_sessions")
        .select(
          "id, plan_id, user_id, session_index, program_day_id, session_seed, completed_at"
        )
        .eq("plan_id", activeCyclePlan.id)
        .eq("session_index", activeCyclePlan.current_session_index)
        .maybeSingle();
      if (activeCycleSessionError) {
        return {
          status: "error",
          errors: ["Failed to load active cycle session"],
        };
      }

      const activeCycleSession = activeCycleSessionRow as EngineCycleSessionRow | null;
      if (!activeCycleSession) {
        const { data: existingCompletionRow, error: existingCompletionError } =
          await supabase
            .from("workout_logs")
            .select("id")
            .eq("user_id", userId)
            .eq("idempotency_key", idempotencyKey)
            .limit(1)
            .maybeSingle();
        if (existingCompletionError || !existingCompletionRow) {
          return {
            status: "error",
            errors: ["Failed to load active cycle session"],
          };
        }
      }

      if (!activeCycleSession) {
        // Allow the atomic persistence layer to return an existing idempotent
        // completion without rebuilding a stale cycle-backed engine input.
      } else if (matchesActiveCycleCompletion(activeCycleSession, input)) {
        resolvedProgramId = toNullableNumericId(activeCyclePlan.primary_program_id ?? null);

        const { data: gamificationRow, error: gamificationError } = await supabase
          .from("engine_gamification_states")
          .select(
            "id, user_id, plan_id, xp, level, adherence_streak, completed_session_count, missed_session_count, last_adherence_outcome_classification, last_awarded_at, class_archetype"
          )
          .eq("plan_id", activeCyclePlan.id)
          .maybeSingle();

        if (gamificationError) {
          return {
            status: "error",
            errors: [gamificationError.message ?? "Failed to load normalized gamification state"],
          };
        }

        if (!gamificationRow) {
          return {
            status: "error",
            errors: ["Missing normalized gamification state"],
          };
        }

        const { data: progressionRows, error: progressionError } = await supabase
          .from("engine_progression_states")
          .select(
            "id, user_id, plan_id, exercise_id, current_action, trend, last_successful_load_weight, last_successful_load_reps, consecutive_successful_completions, consecutive_stall_or_regression_count, swap_recommendation_count, last_session_outcome_classification, last_completed_at"
          )
          .eq("plan_id", activeCyclePlan.id);

        if (progressionError) {
          return {
            status: "error",
            errors: [progressionError.message ?? "Failed to load normalized progression state"],
          };
        }

        cycleCompletionContext = {
          plan: activeCyclePlan,
          session: activeCycleSession,
          gamification: gamificationRow as EngineGamificationStateRow,
          progression: (progressionRows ?? []) as EngineProgressionStateRow[],
        };
      }
    }

    // 2. Get exercise IDs from the session
    const exerciseIds = toLookupIds(input.exercises.map((ex) => ex.exerciseId));

    // 3. Load muscle mappings for these exercises
    const { data: muscleMaps, error: mapError } = await supabase
      .from("exercise_muscle_map")
      .select("exercise_id, role, contribution, muscle_groups!inner(slug)")
      .in("exercise_id", exerciseIds);

    if (mapError) {
      return {
        status: "error",
        errors: ["Failed to load muscle mappings"],
      };
    }

    const engineMuscleMappings = toMuscleMappingRows((muscleMaps ?? []) as MuscleMapJoinRow[]).map(
      toMuscleMapping
    );

    // 4. Resolve program metadata for workout log enrichment
    if (resolvedProgramDayId !== null) {
      const { data: programDayRow } = await supabase
        .from("program_days")
        .select("id, program_id, name")
        .eq("id", resolvedProgramDayId)
        .single();

      const typedProgramDayRow = programDayRow as ProgramDayLookupRow | null;
      if (typedProgramDayRow) {
        resolvedProgramId = toNullableNumericId(
          resolvedProgramId ?? typedProgramDayRow.program_id
        );
        resolvedProgramDayName = typedProgramDayRow.name;
      }
    }

    // 5. Process completion to get stats update
    const statsUpdate = processCompletion(
      { session: input, muscleMappings: engineMuscleMappings },
      currentStats
    );

    // 6. Apply update to get new stats
    const updatedStats = applyStatsUpdate(currentStats, statsUpdate);
    const sessionVolume = calculateSessionVolume(input);
    const durationSeconds = calculateSessionDurationSeconds(
      input.startedAt,
      input.completedAt
    );
    let parsedEngineOutput: EngineCompleteSessionOutput | null = null;
    let completeTraceInputMaterial: Record<string, unknown> | null = null;

    if (cycleCompletionContext) {
      const engineInputResult = await buildCycleBackedCompleteSessionEngineInput(
        supabase,
        userId,
        input,
        currentStats,
        cycleCompletionContext,
        options.requestId ?? null
      );

      if (!engineInputResult.ok) {
        return {
          status: "error",
          errors: [engineInputResult.error],
        };
      }

      const engineOutput = await runEngineInput(engineInputResult.input);
      completeTraceInputMaterial = toReplayTraceInputMaterial(engineInputResult.input);
      parsedEngineOutput = parseEngineCompleteSessionOutput(engineOutput);
      if (!parsedEngineOutput) {
        return {
          status: "error",
          errors: ["Engine returned invalid complete_session output"],
        };
      }
    }

    // 7. Persist completion atomically via RPC.
    const adminClient = createSupabaseAdminClient();
    const writeClient = adminClient ?? supabase;
    const workoutMetadata = {
      startedAt: input.startedAt,
      notes: input.notes ?? null,
      overallRpe: input.overallRpe,
      programDayName: resolvedProgramDayName,
      exerciseCount: input.exercises.length,
      setCount: input.exercises.reduce((count, exercise) => count + exercise.sets.length, 0),
    } satisfies Record<string, unknown>;
    const setLogPayload = createSetLogInsertPayload(input);
    if (!setLogPayload) {
      return {
        status: "error",
        errors: ["Failed to save set history due to unsupported exercise identifiers"],
      };
    }

    const canUseRpc =
      adminClient !== null && typeof (writeClient as { rpc?: unknown }).rpc === "function";
    const persistCompletionTrace = async (
      client: SupabaseClient,
      workoutLogId: number
    ): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!cycleCompletionContext || !parsedEngineOutput) {
        return { ok: true };
      }

      const traceInsert: EngineSessionTraceInsert = {
        user_id: userId,
        operation: "complete_session",
        cycle_plan_id: cycleCompletionContext.plan.id,
        cycle_session_id: cycleCompletionContext.session.id,
        workout_log_id: workoutLogId,
        input_material: completeTraceInputMaterial,
        decision_log: parsedEngineOutput.decisionLog,
        replay_receipt: parsedEngineOutput.replayReceipt,
        engine_result: parsedEngineOutput.result as unknown as Record<string, unknown>,
      };

      const persistedTrace = await persistEngineSessionTrace(client, traceInsert);
      if (!persistedTrace.ok) {
        return persistedTrace;
      }

      return { ok: true };
    };

    if (canUseRpc) {
      const { data: rpcData, error: rpcError } = await (
        writeClient as SupabaseClient & {
          rpc: (
            fn: string,
            args: Record<string, unknown>
          ) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
        }
      ).rpc("complete_session_atomic", {
        p_user_id: userId,
        p_program_id: resolvedProgramId,
        p_program_day_id: resolvedProgramDayId,
        p_completed_at: input.completedAt,
        p_duration_seconds: durationSeconds,
        p_total_volume: sessionVolume,
        p_seed: input.seed ?? null,
        p_metadata: workoutMetadata,
        p_set_logs: setLogPayload,
        p_stats_json: updatedStats,
        p_cycle_plan_id: cycleCompletionContext?.plan.id ?? null,
        p_cycle_session_id: cycleCompletionContext?.session.id ?? null,
        p_engine_decision_log: parsedEngineOutput?.decisionLog ?? null,
        p_engine_replay_receipt: parsedEngineOutput?.replayReceipt ?? null,
        p_engine_result: parsedEngineOutput?.result ?? null,
        p_engine_input_material: completeTraceInputMaterial,
        p_idempotency_key: idempotencyKey,
      });

      if (!rpcError) {
        const rpcResult = toAtomicCompletionResult(rpcData);
        if (rpcResult) {
          const { workoutLogId, reused } = rpcResult;
          if (cycleCompletionContext && parsedEngineOutput) {
            const traceResult = await persistCompletionTrace(writeClient, workoutLogId);
            if (!traceResult.ok) {
              if (!reused) {
                await restoreUserStatsProjection(writeClient, userId, currentStats);
                await rollbackWorkoutLog(writeClient, userId, workoutLogId);
              }
              return {
                status: "error",
                errors: [traceResult.error],
              };
            }

            const syncResult = await syncNormalizedCycleCompletion(
              writeClient,
              cycleCompletionContext,
              parsedEngineOutput
            );
            if (!syncResult.ok) {
              if (!reused) {
                await restoreUserStatsProjection(writeClient, userId, currentStats);
                await rollbackWorkoutLog(writeClient, userId, workoutLogId);
              }
              logServerEvent({
                route: options.route ?? "/api/v0/sessions/complete",
                action: "handleCompleteSession",
                severity: "error",
                reason: "dependency_error",
                requestId: options.requestId ?? null,
                userId,
                error: new Error(syncResult.error),
              });
              return {
                status: "error",
                errors: ["Failed to synchronize normalized cycle state"],
              };
            }
            const projectionResult = await persistCycleCompatibilityProjection(
              writeClient,
              userId,
              syncResult.compatibilityProjection
            );
            if (!projectionResult.ok) {
              return {
                status: "error",
                errors: [projectionResult.error],
              };
            }
          } else if (rpcResult.reused) {
            const repairResult = await repairCompatibilityProjectionForCurrentCycle(
              writeClient,
              userId,
              activeCyclePlan
            );
            if (!repairResult.ok) {
              return {
                status: "error",
                errors: [repairResult.error],
              };
            }
          }
          return {
            status: "success",
            message: "Session completed successfully",
          };
        }

        return {
          status: "error",
          errors: ["Failed to resolve workout history identifier"],
        };
      }

      const rpcMissing =
        rpcError.code === "PGRST202" ||
        (rpcError.message ?? "").toLowerCase().includes("complete_session_atomic");

      if (!rpcMissing) {
        logServerEvent({
          route: options.route ?? "/api/v0/sessions/complete",
          action: "handleCompleteSession",
          severity: "error",
          reason: "dependency_error",
          requestId: options.requestId ?? null,
          userId,
          error: rpcError,
        });
        return {
          status: "error",
          errors: ["Failed to save session completion"],
        };
      }
    }

    // Compatibility fallback for local/test setups where RPC migration is unavailable.
    const { data: workoutLogRow, error: workoutLogError } = await writeClient
      .from("workout_logs")
      .insert({
        user_id: userId,
        program_id: resolvedProgramId,
        program_day_id: resolvedProgramDayId,
        completed_at: input.completedAt,
        duration_seconds: durationSeconds,
        total_volume: sessionVolume,
        seed: input.seed,
        metadata: workoutMetadata,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      })
      .select("id")
      .single();

    let workoutLogWasReused = false;
    if (workoutLogError || !workoutLogRow) {
      const isDuplicateIdempotency =
        idempotencyKey !== null &&
        (workoutLogError as { code?: string } | null)?.code === "23505";
      if (isDuplicateIdempotency) {
        workoutLogWasReused = true;
        const { data: existingWorkoutLogRow, error: existingWorkoutLogError } =
          await writeClient
            .from("workout_logs")
            .select("id")
            .eq("user_id", userId)
            .eq("idempotency_key", idempotencyKey)
            .limit(1)
            .maybeSingle();
        const existingWorkoutLogId = toNullableNumericId(
          (existingWorkoutLogRow as { id?: unknown } | null)?.id
        );
        if (existingWorkoutLogError || existingWorkoutLogId === null) {
          return {
            status: "error",
            errors: ["Failed to resolve existing workout history identifier"],
          };
        }

        if (cycleCompletionContext && parsedEngineOutput) {
          const traceResult = await persistCompletionTrace(writeClient, existingWorkoutLogId);
          if (!traceResult.ok) {
            return {
              status: "error",
              errors: [traceResult.error],
            };
          }

          const syncResult = await syncNormalizedCycleCompletion(
            writeClient,
            cycleCompletionContext,
            parsedEngineOutput
          );
          if (!syncResult.ok) {
            logServerEvent({
              route: options.route ?? "/api/v0/sessions/complete",
              action: "handleCompleteSession",
              severity: "error",
              reason: "dependency_error",
              requestId: options.requestId ?? null,
              userId,
              error: new Error(syncResult.error),
            });
            return {
              status: "error",
              errors: ["Failed to synchronize normalized cycle state"],
            };
          }
          const projectionResult = await persistCycleCompatibilityProjection(
            writeClient,
            userId,
            syncResult.compatibilityProjection
          );
          if (!projectionResult.ok) {
            return {
              status: "error",
              errors: [projectionResult.error],
            };
          }
        } else {
          const repairResult = await repairCompatibilityProjectionForCurrentCycle(
            writeClient,
            userId,
            activeCyclePlan
          );
          if (!repairResult.ok) {
            return {
              status: "error",
              errors: [repairResult.error],
            };
          }
        }
        return {
          status: "success",
          message: "Session completed successfully",
        };
      }

      return {
        status: "error",
        errors: ["Failed to save workout history"],
      };
    }

    const workoutLogId = toNullableNumericId((workoutLogRow as { id?: unknown }).id);
    if (workoutLogId === null) {
      return {
        status: "error",
        errors: ["Failed to resolve workout history identifier"],
      };
    }

    if (setLogPayload.length > 0) {
      const setLogRows = setLogPayload.map((entry) => ({
        workout_log_id: workoutLogId,
        ...entry,
      }));
      const { error: setLogError } = await writeClient.from("set_logs").insert(setLogRows);
      if (setLogError) {
        await rollbackWorkoutLog(writeClient, userId, workoutLogId);
        return {
          status: "error",
          errors: ["Failed to save set history"],
        };
      }
    }

    const { error: updateError } = await writeClient
      .from("users")
      .update({ stats_json: updatedStats })
      .eq("id", userId);

    if (updateError) {
      await rollbackWorkoutLog(writeClient, userId, workoutLogId);
      return {
        status: "error",
        errors: ["Failed to save session completion"],
      };
    }

    if (cycleCompletionContext && parsedEngineOutput) {
      const traceResult = await persistCompletionTrace(writeClient, workoutLogId);
      if (!traceResult.ok) {
        await restoreUserStatsProjection(writeClient, userId, currentStats);
        await rollbackWorkoutLog(writeClient, userId, workoutLogId);
        return {
          status: "error",
          errors: [traceResult.error],
        };
      }

      const syncResult = await syncNormalizedCycleCompletion(
        writeClient,
        cycleCompletionContext,
        parsedEngineOutput
      );
      if (!syncResult.ok) {
        if (!workoutLogWasReused) {
          await restoreUserStatsProjection(writeClient, userId, currentStats);
          await rollbackWorkoutLog(writeClient, userId, workoutLogId);
        }
        logServerEvent({
          route: options.route ?? "/api/v0/sessions/complete",
          action: "handleCompleteSession",
          severity: "error",
          reason: "dependency_error",
          requestId: options.requestId ?? null,
          userId,
          error: new Error(syncResult.error),
        });
        return {
          status: "error",
          errors: ["Failed to synchronize normalized cycle state"],
        };
      }
      const projectionResult = await persistCycleCompatibilityProjection(
        writeClient,
        userId,
        syncResult.compatibilityProjection
      );
      if (!projectionResult.ok) {
        return {
          status: "error",
          errors: [projectionResult.error],
        };
      }
    }

    return {
      status: "success",
      message: "Session completed successfully",
    };
  } catch (error) {
    logServerEvent({
      route: options.route ?? "/api/v0/sessions/complete",
      action: "handleCompleteSession",
      severity: "error",
      reason: "unexpected_error",
      requestId: options.requestId ?? null,
      userId,
      error,
    });
    return {
      status: "error",
      errors: ["An unexpected error occurred"],
    };
  }
}

// -----------------------------------------------------------------------------
// Workout History Query Helper
// -----------------------------------------------------------------------------

export async function getRecentWorkoutHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<{ workouts: RecentWorkoutHistoryItem[]; error?: string }> {
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const { data: workoutRows, error: workoutError } = await supabase
    .from("workout_logs")
    .select(
      "id, user_id, program_id, program_day_id, completed_at, duration_seconds, total_volume, seed, metadata"
    )
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(safeLimit);

  if (workoutError) {
    return { workouts: [], error: workoutError.message };
  }

  const parsedWorkouts = (workoutRows ?? []).flatMap((row) => {
    const parsed = WorkoutLogRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  if (parsedWorkouts.length === 0) {
    return { workouts: [] };
  }

  const workoutIds = parsedWorkouts.map((workout) => workout.id);
  const { data: setRows, error: setError } = await supabase
    .from("set_logs")
    .select(
      "id, workout_log_id, exercise_id, set_number, weight, reps, rpe, rir, failed, created_at"
    )
    .in("workout_log_id", workoutIds)
    .order("set_number", { ascending: true });

  if (setError) {
    return { workouts: [], error: setError.message };
  }

  const parsedSetRows = (setRows ?? []).flatMap((row) => {
    const parsed = SetLogRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  const setsByWorkout = new Map<number, SetLogRow[]>();
  for (const setRow of parsedSetRows) {
    const existing = setsByWorkout.get(setRow.workout_log_id) ?? [];
    existing.push(setRow);
    setsByWorkout.set(setRow.workout_log_id, existing);
  }

  const dayIds = [
    ...new Set(
      parsedWorkouts.flatMap((workout) =>
        workout.program_day_id ? [workout.program_day_id] : []
      )
    ),
  ];

  const dayNameById = new Map<number, string>();
  if (dayIds.length > 0) {
    const { data: dayRows, error: dayError } = await supabase
      .from("program_days")
      .select("id, name")
      .in("id", dayIds);

    if (dayError) {
      return { workouts: [], error: dayError.message };
    }

    for (const dayRow of dayRows ?? []) {
      const id = toNullableNumericId((dayRow as { id?: unknown }).id);
      const name = (dayRow as { name?: unknown }).name;
      if (id !== null && typeof name === "string" && name.length > 0) {
        dayNameById.set(id, name);
      }
    }
  }

  const workouts = parsedWorkouts.map((workout) => ({
    workout,
    dayName:
      workout.program_day_id !== null && workout.program_day_id !== undefined
        ? dayNameById.get(workout.program_day_id) ?? "Workout Session"
        : "Workout Session",
    sets: (setsByWorkout.get(workout.id) ?? []).sort(
      (left, right) => left.set_number - right.set_number
    ),
  }));

  return { workouts };
}
