import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SetLogRowSchema,
  WorkoutLogRowSchema,
  type SetLogRow,
  type WorkoutLogRow,
} from "@adaptabuddy/contracts";
import {
  ActiveCycleReportingReadModelSchema,
  CapacityTimelineSchema,
  DecisionLogEntrySchema,
  DeterministicAnalyticsReadModelSchema,
  FatigueSummarySchema,
  NormalizedProgressionStateRowSchema,
  PlanSessionExplanationReadModelSchema,
  ReplayDebugBundle,
  ReplayDebugBundleSchema,
  ReplayDebugInputMaterialAvailableSchema,
  ReplayDebugInputMaterialUnavailableSchema,
  ReplayReceiptSchema,
  ReplayDebugReferenceSchema,
  WorkoutCompletionExplanationReadModelSchema,
  WeeklyVolumeAnalyticsSchema,
  type DecisionLogEntry,
  type CapacityTimeline,
  type DeterministicAnalyticsReadModel,
  type FatigueSummary,
  type FatigueSummaryItem,
  type NormalizedProgressionStateRow,
  ActiveCycleReportingReadModel,
  PlanSessionExplanationReadModel,
  ReplayDebugReference,
  type ReplayDebugInputMaterial,
  WorkoutCompletionExplanationReadModel,
  type WeeklyVolumeAnalytics,
} from "./contracts";

type TraceRow = {
  id: number;
  user_id: string;
  operation: "plan_session" | "complete_session" | "advance_cycle";
  cycle_plan_id?: number | null;
  cycle_session_id?: number | null;
  workout_log_id?: number | null;
  input_material?: unknown;
  inputMaterial?: unknown;
  decision_log?: unknown;
  replay_receipt?: unknown;
  engine_result?: unknown;
};

type PlanRow = {
  id: number;
  current_session_index: number;
  current_microcycle_index?: number | null;
  total_sessions?: number | null;
  resolved_class_archetype?: string | null;
  class_preset_id?: string | null;
};

type CycleSessionRow = {
  id: number;
  plan_id: number;
  session_index: number;
  completed_at?: string | null;
};

type GamificationRow = {
  id: number;
  plan_id: number;
  xp: number;
  level: number;
  adherence_streak: number;
  completed_session_count?: number | null;
  missed_session_count?: number | null;
  last_adherence_outcome_classification?: string | null;
  last_awarded_at?: string | null;
};

type ProgressionRow = {
  id?: number;
  plan_id: number;
  exercise_id: string;
  current_action: "overload" | "maintain" | "regress" | "swap";
  trend: "improving" | "stalled" | "regressing" | "blocked";
  last_successful_load_weight?: number | null;
  last_successful_load_reps?: number | null;
  consecutive_successful_completions: number;
  consecutive_stall_or_regression_count: number;
  swap_recommendation_count: number;
  last_session_outcome_classification:
    | "complete_clean"
    | "complete_compromised"
    | "partial"
    | "missed";
  last_completed_at: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const asInteger = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  return value;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => (typeof entry === "string" && entry.length > 0 ? [entry] : []));
};

const asBlockedCandidateIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry === "string" && entry.length > 0) {
      return [entry];
    }
    if (isRecord(entry)) {
      return asString(entry.candidateId) ?? asString(entry.id) ?? [];
    }
    return [];
  });
};

const getMetadataString = (metadata: unknown, key: string): string | null => {
  if (!isRecord(metadata)) {
    return null;
  }
  return asString(metadata[key]);
};

const asClassPresetId = (
  value: unknown
): "classless" | "bb" | "powa" | "ninja" | "monk" | null => {
  return value === "classless" ||
    value === "bb" ||
    value === "powa" ||
    value === "ninja" ||
    value === "monk"
    ? value
    : null;
};

const parseReadModel = <T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  value: unknown
): T | null => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseEngineResult = (value: unknown): Record<string, unknown> | null =>
  isRecord(value) ? value : null;

const toStringId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }
  return null;
};

const redactValueKeys = new Set([
  "notes",
  "setnotes",
  "requestid",
  "correlationid",
  "request_id",
  "correlation_id",
]);

const redactBetaDebugValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactBetaDebugValue(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const entries = Object.entries(value).flatMap(([key, entryValue]) => {
    const normalizedKey = key.toLowerCase();
    if (redactValueKeys.has(normalizedKey)) {
      return [[key, "[REDACTED]"] as const];
    }

    return [[key, redactBetaDebugValue(entryValue)] as const];
  });

  return Object.fromEntries(entries);
};

const readReplayDebugInputMaterial = (trace: TraceRow): ReplayDebugInputMaterial => {
  const inputMaterial = trace.input_material ?? trace.inputMaterial;
  if (!isRecord(inputMaterial)) {
    return {
      availability: "unavailable",
      reason: "not_app_persisted",
      source: "app_input",
    };
  }

  return (
    parseReadModel(ReplayDebugInputMaterialAvailableSchema, {
      availability: "available",
      source: "app_input",
      material: redactBetaDebugValue(inputMaterial) as Record<string, unknown>,
    }) ??
    {
      availability: "unavailable",
      reason: "invalid_shape",
      source: "app_input",
    }
  );
};

const readReplayVersions = (trace: TraceRow) => {
  const inputMaterial = trace.input_material ?? trace.inputMaterial;
  if (!isRecord(inputMaterial)) {
    return {
      schemaVersion: null,
      canonicalizationVersion: null,
      ruleVersion: null,
    };
  }

  const determinism = isRecord(inputMaterial.determinism)
    ? inputMaterial.determinism
    : null;

  return {
    schemaVersion: asString(inputMaterial.schemaVersion),
    canonicalizationVersion: asString(determinism?.canonicalizationVersion),
    ruleVersion: asString(determinism?.ruleVersion),
  };
};

const toReplayReceipt = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }

  return parseReadModel(ReplayReceiptSchema, {
    inputHash: asString(value.inputHash),
    outputHash: asString(value.outputHash),
    seedUsed: asString(value.seedUsed),
    effectiveAt: asString(value.effectiveAt),
    implementationVersion: asString(value.implementationVersion),
    policyVersion: asString(value.policyVersion),
    referenceHash: asString(value.referenceHash),
  });
};

const toReplayDebugReference = (
  traceId: number,
  replayReceipt: unknown
): ReplayDebugReference | null => {
  const reference = toReplayReceipt(replayReceipt);
  if (!reference) {
    return null;
  }

  return parseReadModel(ReplayDebugReferenceSchema, {
    ...reference,
    traceId: String(traceId),
  });
};

const readDebugDecisionLog = (trace: TraceRow) =>
  readDecisionLog(trace.decision_log).map((entry) => ({
    ...entry,
    details: isRecord(entry.details)
      ? (redactBetaDebugValue(entry.details) as Record<string, unknown>)
      : entry.details,
  }));

const buildReplayDebugBundle = (
  trace: TraceRow,
  availability: "unavailable",
  reason:
    | "trace_not_found"
    | "missing_replay_receipt"
    | "missing_engine_result"
    | "missing_input_material"
    | "invalid_trace_material",
  operation: "plan_session" | "complete_session" | "advance_cycle"
): ReplayDebugBundle => {
  const redactedDecisionLog = readDebugDecisionLog(trace);
  const replayReceipt = toReplayReceipt(trace.replay_receipt);
  const rawEngineResult = parseEngineResult(trace.engine_result);
  const redactedEngineResult = rawEngineResult
    ? (redactBetaDebugValue(rawEngineResult) as Record<string, unknown>)
    : null;
  const replayVersions = readReplayVersions(trace);
  const parsed = parseReadModel(ReplayDebugBundleSchema, {
    availability,
    reason,
    operation,
    traceId: String(trace.id),
    cyclePlanId: toStringId(trace.cycle_plan_id),
    cycleSessionId: toStringId(trace.cycle_session_id),
    workoutLogId: toStringId(trace.workout_log_id),
    decisionLog: redactedDecisionLog,
    engineResult: redactedEngineResult ?? null,
    replayReceipt,
    ...replayVersions,
    referenceHash: replayReceipt ? replayReceipt.referenceHash : null,
    policyVersion: replayReceipt ? replayReceipt.policyVersion : null,
    inputMaterial: readReplayDebugInputMaterial(trace),
  });

  return (
    parsed ?? {
      availability: "unavailable",
      reason: "invalid_trace_material",
      operation,
      traceId: String(trace.id),
      cyclePlanId: toStringId(trace.cycle_plan_id),
      cycleSessionId: toStringId(trace.cycle_session_id),
      workoutLogId: toStringId(trace.workout_log_id),
      decisionLog: redactedDecisionLog,
      engineResult: redactedEngineResult,
      replayReceipt: null,
      schemaVersion: replayVersions.schemaVersion,
      canonicalizationVersion: replayVersions.canonicalizationVersion,
      ruleVersion: replayVersions.ruleVersion,
      referenceHash: null,
      policyVersion: null,
      inputMaterial: {
        availability: "unavailable",
        reason: "not_app_persisted",
        source: "app_input",
      },
    }
  );
};

const buildReplayDebugBundleFromParsedTrace = (
  trace: TraceRow,
  operation: "plan_session" | "complete_session" | "advance_cycle",
  replayMaterial: Record<string, unknown>,
  engineResult: Record<string, unknown>,
  decisionLog: Array<DecisionLogEntry>
): ReplayDebugBundle =>
  parseReadModel(ReplayDebugBundleSchema, {
    availability: "available",
    operation,
    traceId: String(trace.id),
    cyclePlanId: toStringId(trace.cycle_plan_id),
    cycleSessionId: toStringId(trace.cycle_session_id),
    workoutLogId: toStringId(trace.workout_log_id),
    ...readReplayVersions(trace),
    replayReceipt: {
      inputHash: asString(replayMaterial.inputHash) ?? "",
      outputHash: asString(replayMaterial.outputHash) ?? "",
      seedUsed: asString(replayMaterial.seedUsed) ?? "",
      effectiveAt: asString(replayMaterial.effectiveAt) ?? "",
      implementationVersion: asString(replayMaterial.implementationVersion) ?? "",
      policyVersion: asString(replayMaterial.policyVersion) ?? "",
      referenceHash: asString(replayMaterial.referenceHash) ?? "",
    },
    referenceHash: asString(replayMaterial.referenceHash) ?? "",
    policyVersion: asString(replayMaterial.policyVersion) ?? "",
    decisionLog,
    engineResult,
    inputMaterial: readReplayDebugInputMaterial(trace),
  }) ?? buildReplayDebugBundle(trace, "unavailable", "invalid_trace_material", operation);

export const derivePlanSessionReplayDebugBundle = (trace: TraceRow): ReplayDebugBundle => {
  if (trace.operation !== "plan_session") {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "invalid_trace_material",
      "plan_session"
    );
  }

  const decisionLog = readDebugDecisionLog(trace);
  const engineResult = parseEngineResult(trace.engine_result);
  const replayReceipt = toReplayReceipt(trace.replay_receipt);
  if (!engineResult) {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "missing_engine_result",
      "plan_session"
    );
  }
  if (!replayReceipt) {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "missing_replay_receipt",
      "plan_session"
    );
  }
  if (readReplayDebugInputMaterial(trace).availability !== "available") {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "missing_input_material",
      "plan_session"
    );
  }

  return buildReplayDebugBundleFromParsedTrace(
    trace,
    "plan_session",
    replayReceipt as Record<string, unknown>,
    redactBetaDebugValue(engineResult) as Record<string, unknown>,
    decisionLog
  );
};

export const deriveWorkoutCompletionReplayDebugBundle = (trace: TraceRow): ReplayDebugBundle => {
  if (trace.operation !== "complete_session") {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "invalid_trace_material",
      "complete_session"
    );
  }

  const decisionLog = readDebugDecisionLog(trace);
  const engineResult = parseEngineResult(trace.engine_result);
  const replayReceipt = toReplayReceipt(trace.replay_receipt);
  if (!engineResult) {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "missing_engine_result",
      "complete_session"
    );
  }
  if (!replayReceipt) {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "missing_replay_receipt",
      "complete_session"
    );
  }
  if (readReplayDebugInputMaterial(trace).availability !== "available") {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "missing_input_material",
      "complete_session"
    );
  }

  return buildReplayDebugBundleFromParsedTrace(
    trace,
    "complete_session",
    replayReceipt as Record<string, unknown>,
    redactBetaDebugValue(engineResult) as Record<string, unknown>,
    decisionLog
  );
};

const findDecisionEntry = (
  decisionLog: DecisionLogEntry[],
  stepType: string
) => decisionLog.find((entry) => entry.stepType === stepType);

const readDecisionLog = (value: unknown): DecisionLogEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const parsed = parseReadModel(DecisionLogEntrySchema, entry);
    return parsed ? [parsed] : [];
  });
};

const readProgressionChanges = (
  value: unknown
): Array<{ exerciseId: string; action: string; trend: string }> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];

    const exerciseId = asString(entry.exerciseId);
    const action = asString(entry.action);
    const trend = asString(entry.trend);
    if (!exerciseId || !action || !trend) return [];

    return [{ exerciseId, action, trend }];
  });
};

const readNormalizedProgressionRows = (value: unknown): NormalizedProgressionStateRow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const parsed = parseReadModel(NormalizedProgressionStateRowSchema, {
      exerciseId: asString(entry.exercise_id),
      currentAction: asString(entry.current_action),
      trend: asString(entry.trend),
      lastSuccessfulLoadWeight: asNumber(entry.last_successful_load_weight),
      lastSuccessfulLoadReps: asInteger(entry.last_successful_load_reps),
      consecutiveSuccessfulCompletions: asInteger(entry.consecutive_successful_completions),
      consecutiveStallOrRegressionCount: asInteger(entry.consecutive_stall_or_regression_count),
      swapRecommendationCount: asInteger(entry.swap_recommendation_count),
      lastSessionOutcomeClassification: asString(entry.last_session_outcome_classification),
      lastCompletedAt: asString(entry.last_completed_at),
    });

    return parsed ? [parsed] : [];
  });
};

type WorkoutHistoryContext = {
  workouts: WorkoutLogRow[];
  setRows: SetLogRow[];
  dayNameById: Map<number, string>;
  muscleMappingsByExerciseId: Map<number, Array<{ muscle: string; contribution: number }>>;
};

type ExerciseMuscleMapJoinRow = {
  exercise_id?: unknown;
  contribution?: unknown;
  muscle_groups?: unknown;
};

const formatExerciseLabel = (exerciseId: string): string => {
  if (/^\d+$/.test(exerciseId)) {
    return `Exercise ${exerciseId}`;
  }

  if (exerciseId.includes("-") && exerciseId.length >= 8) {
    return `Exercise ${exerciseId.slice(0, 8)}`;
  }

  return exerciseId
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getWorkoutHistoryContext = async (
  supabase: SupabaseClient,
  userId: string
): Promise<WorkoutHistoryContext> => {
  const { data: workoutRows, error: workoutError } = await supabase
    .from("workout_logs")
    .select(
      "id, user_id, program_id, program_day_id, completed_at, duration_seconds, total_volume, seed, metadata"
    )
    .eq("user_id", userId);

  if (workoutError) {
    return {
      workouts: [],
      setRows: [],
      dayNameById: new Map(),
      muscleMappingsByExerciseId: new Map(),
    };
  }

  const workouts = (workoutRows ?? []).flatMap((row) => {
    const parsed = WorkoutLogRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  const workoutIds = workouts.map((workout) => workout.id);
  const setRows = workoutIds.length === 0
    ? []
    : await (async () => {
        const { data: setRowsData, error: setError } = await supabase
          .from("set_logs")
          .select(
            "id, workout_log_id, exercise_id, set_number, weight, reps, rpe, rir, failed, created_at"
          )
          .in("workout_log_id", workoutIds);

        if (setError) {
          return [];
        }

        return (setRowsData ?? []).flatMap((row) => {
          const parsed = SetLogRowSchema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        });
      })();

  const dayIds = [
    ...new Set(
      workouts.flatMap((workout) =>
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

    if (!dayError) {
      for (const dayRow of dayRows ?? []) {
        if (!isRecord(dayRow)) {
          continue;
        }
        const id = asInteger(dayRow.id);
        const name = asString(dayRow.name);
        if (id !== null && name !== null) {
          dayNameById.set(id, name);
        }
      }
    }
  }

  const exerciseIds = [
    ...new Set(setRows.map((setRow) => setRow.exercise_id)),
  ];
  const muscleMappingsByExerciseId = new Map<number, Array<{ muscle: string; contribution: number }>>();
  if (exerciseIds.length > 0) {
    const { data: mappingRows, error: mappingError } = await supabase
      .from("exercise_muscle_map")
      .select("exercise_id, contribution, muscle_groups!inner(slug)")
      .in("exercise_id", exerciseIds);

    if (!mappingError) {
      for (const mappingRow of (mappingRows ?? []) as unknown[]) {
        if (!isRecord(mappingRow)) {
          continue;
        }
        const exerciseId = asInteger(mappingRow.exercise_id);
        const contribution = asNumber(mappingRow.contribution);
        const muscleGroups = mappingRow.muscle_groups;
        const nested = Array.isArray(muscleGroups) ? muscleGroups[0] : muscleGroups;
        const muscle = isRecord(nested) ? asString(nested.slug) : null;
        if (exerciseId === null || contribution === null || muscle === null) {
          continue;
        }
        const existing = muscleMappingsByExerciseId.get(exerciseId) ?? [];
        existing.push({ muscle, contribution });
        muscleMappingsByExerciseId.set(exerciseId, existing);
      }
    }
  }

  return {
    workouts,
    setRows,
    dayNameById,
    muscleMappingsByExerciseId,
  };
};

const getFatigueSeverity = (value: number): FatigueSummaryItem["severity"] => {
  if (value >= 70) return "high";
  if (value >= 40) return "moderate";
  return "low";
};

const getFatigueSummaryFromCycleSessions = async (
  supabase: SupabaseClient,
  cyclePlanId: string
): Promise<FatigueSummary> => {
  const planId = Number(cyclePlanId);
  if (!Number.isFinite(planId)) {
    return { items: [] };
  }

  const { data: sessionRows, error } = await supabase
    .from("engine_cycle_sessions")
    .select("id, plan_id, session_index, completed_at, projected_fatigue_cost")
    .eq("plan_id", planId);

  if (error) {
    return { items: [] };
  }

  const fatigueTotals = new Map<string, number>();
  for (const row of (sessionRows ?? []) as unknown[]) {
    if (!isRecord(row)) {
      continue;
    }
    if (!asString(row.completed_at)) {
      continue;
    }
    const projectedFatigueCost = isRecord(row.projected_fatigue_cost)
      ? row.projected_fatigue_cost
      : null;
    if (!projectedFatigueCost) {
      continue;
    }
    for (const [muscle, value] of Object.entries(projectedFatigueCost)) {
      const numeric = asNumber(value);
      if (numeric === null || numeric < 0) {
        continue;
      }
      fatigueTotals.set(muscle, (fatigueTotals.get(muscle) ?? 0) + numeric);
    }
  }

  const items = [...fatigueTotals.entries()]
    .map(([muscle, current]) => ({
      muscle,
      current,
      severity: getFatigueSeverity(current),
    }))
    .sort((left, right) => {
      if (right.current !== left.current) {
        return right.current - left.current;
      }
      return left.muscle.localeCompare(right.muscle);
    });

  return parseReadModel(FatigueSummarySchema, { items }) ?? { items: [] };
};

const buildBestCapacityPoint = (
  setRow: SetLogRow,
  workoutCompletedAt: string
): { date: string; estimated1RM: number; setNumber: number; setId: number } | null => {
  if (setRow.failed) {
    return null;
  }

  if (setRow.weight <= 0 || setRow.reps <= 0) {
    return null;
  }

  const estimated1RM = Math.round(setRow.weight * (1 + setRow.reps / 30) * 100) / 100;
  if (!Number.isFinite(estimated1RM) || estimated1RM <= 0) {
    return null;
  }

  return {
    date: workoutCompletedAt,
    estimated1RM,
    setNumber: setRow.set_number,
    setId: setRow.id,
  };
};

const getCapacityTimeline = (
  context: WorkoutHistoryContext
): CapacityTimeline => {
  const workoutsById = new Map<number, WorkoutLogRow>();
  for (const workout of context.workouts) {
    workoutsById.set(workout.id, workout);
  }

  const pointsByExercise = new Map<
    number,
    Array<{ date: string; estimated1RM: number; workoutId: number }>
  >();

  const bestSetByWorkoutExercise = new Map<
    string,
    { workoutId: number; exerciseId: number; date: string; estimated1RM: number; setNumber: number; setId: number }
  >();

  for (const setRow of context.setRows) {
    const workout = workoutsById.get(setRow.workout_log_id);
    if (!workout || !workout.completed_at) {
      continue;
    }

    const point = buildBestCapacityPoint(setRow, workout.completed_at);
    if (!point) {
      continue;
    }

    const dedupeKey = `${setRow.workout_log_id}:${setRow.exercise_id}`;
    const existing = bestSetByWorkoutExercise.get(dedupeKey);
    if (
      existing &&
      (existing.estimated1RM > point.estimated1RM ||
        (existing.estimated1RM === point.estimated1RM &&
          (existing.setNumber < point.setNumber ||
            (existing.setNumber === point.setNumber && existing.setId < point.setId))))
    ) {
      continue;
    }

    bestSetByWorkoutExercise.set(dedupeKey, {
      workoutId: setRow.workout_log_id,
      exerciseId: setRow.exercise_id,
      ...point,
    });
  }

  for (const value of bestSetByWorkoutExercise.values()) {
    const points = pointsByExercise.get(value.exerciseId) ?? [];
    points.push({
      date: value.date,
      estimated1RM: value.estimated1RM,
      workoutId: value.workoutId,
    });
    pointsByExercise.set(value.exerciseId, points);
  }

  const series = [...pointsByExercise.entries()]
    .map(([exerciseId, points]) => {
      const sortedPoints = [...points].sort((left, right) => {
        const leftTime = new Date(left.date).getTime();
        const rightTime = new Date(right.date).getTime();
        if (leftTime !== rightTime) {
          return leftTime - rightTime;
        }
        return left.workoutId - right.workoutId;
      });

      return {
        exerciseId: String(exerciseId),
        exerciseLabel: formatExerciseLabel(String(exerciseId)),
        confidence: null,
        points: sortedPoints.map(({ date, estimated1RM }) => ({ date, estimated1RM })),
      };
    })
    .sort((left, right) => {
      const leftLast = new Date(left.points[left.points.length - 1]?.date ?? 0).getTime();
      const rightLast = new Date(right.points[right.points.length - 1]?.date ?? 0).getTime();
      if (rightLast !== leftLast) {
        return rightLast - leftLast;
      }
      return left.exerciseId.localeCompare(right.exerciseId);
    });

  return parseReadModel(CapacityTimelineSchema, { series }) ?? { series: [] };
};

const getWeeklyVolumeAnalytics = (
  context: WorkoutHistoryContext
): WeeklyVolumeAnalytics => {
  const completedWorkouts = context.workouts
    .filter((workout) => asString(workout.completed_at))
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at).getTime();
      const rightTime = new Date(right.completed_at).getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return left.id - right.id;
    });

  if (completedWorkouts.length === 0) {
    return parseReadModel(WeeklyVolumeAnalyticsSchema, {
      windowStartedAt: null,
      windowEndedAt: null,
      items: [],
    }) ?? { windowStartedAt: null, windowEndedAt: null, items: [] };
  }

  const windowEndedAt = completedWorkouts[completedWorkouts.length - 1].completed_at;
  const windowEndedAtDate = new Date(windowEndedAt);
  const windowStartedAtDate = new Date(windowEndedAtDate);
  windowStartedAtDate.setUTCDate(windowStartedAtDate.getUTCDate() - 6);
  const windowStartedAt = windowStartedAtDate.toISOString();
  const windowEnd = windowEndedAtDate.toISOString();

  const workoutIdsInWindow = new Set(
    completedWorkouts
      .filter((workout) => new Date(workout.completed_at).getTime() >= windowStartedAtDate.getTime())
      .map((workout) => workout.id)
  );

  const setCountByMuscle = new Map<string, number>();
  for (const setRow of context.setRows) {
    if (!workoutIdsInWindow.has(setRow.workout_log_id)) {
      continue;
    }
    const mappings = context.muscleMappingsByExerciseId.get(setRow.exercise_id) ?? [];
    for (const mapping of mappings) {
      if (mapping.contribution <= 0) {
        continue;
      }
      setCountByMuscle.set(
        mapping.muscle,
        (setCountByMuscle.get(mapping.muscle) ?? 0) + mapping.contribution
      );
    }
  }

  const items = [...setCountByMuscle.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((left, right) => {
      if (right.sets !== left.sets) {
        return right.sets - left.sets;
      }
      return left.muscle.localeCompare(right.muscle);
    });

  return parseReadModel(WeeklyVolumeAnalyticsSchema, {
    windowStartedAt,
    windowEndedAt: windowEnd,
    items,
  }) ?? { windowStartedAt, windowEndedAt: windowEnd, items: [] };
};

export const derivePlanSessionExplanation = (
  trace: TraceRow
): PlanSessionExplanationReadModel | null => {
  const result = parseEngineResult(trace.engine_result);
  if (trace.operation !== "plan_session" || !result) {
    return null;
  }

  const replayReference = toReplayDebugReference(trace.id, trace.replay_receipt);
  const sessionRationale = asString(result.sessionRationale);
  const recommendedMovementFamily = asString(result.recommendedMovementFamily);
  const selectedExerciseIds = asStringArray(result.selectedExerciseIds);

  if (!replayReference || !sessionRationale || !recommendedMovementFamily) {
    return null;
  }

  const progressionChanges = readProgressionChanges(result.progressionActionSummary);

  const decisionLog = readDecisionLog(trace.decision_log);
  const scopeEntry = findDecisionEntry(decisionLog, "scope");
  const filterEntry = findDecisionEntry(decisionLog, "filter");
  const tieBreakEntry = findDecisionEntry(decisionLog, "tie_break");

  const scopeDetails = isRecord(scopeEntry?.details) ? scopeEntry.details : null;
  const filterDetails = isRecord(filterEntry?.details) ? filterEntry.details : null;
  const tieBreakDetails = isRecord(tieBreakEntry?.details) ? tieBreakEntry.details : null;

  return parseReadModel(PlanSessionExplanationReadModelSchema, {
    sessionRationale,
    recommendedMovementFamily,
    selectedExerciseIds,
    progressionChanges,
    scope: scopeEntry
      ? {
          ruleId: asString(scopeEntry.ruleId) ?? "scope",
          outcome: asString(scopeEntry.outcome) ?? "unknown",
          resolvedFocus: asString(scopeDetails?.resolvedFocus),
          preferredScopeBucket: asString(scopeDetails?.preferredScopeBucket),
          survivingScopeBucket: asString(scopeDetails?.survivingScopeBucket),
          wideningApplied: asBoolean(scopeDetails?.wideningApplied),
        }
      : null,
    filter: filterEntry
      ? {
          ruleId: asString(filterEntry.ruleId) ?? "filter",
          outcome: asString(filterEntry.outcome) ?? "unknown",
          evaluatedCandidateIds: asStringArray(filterDetails?.evaluatedCandidateIds),
          survivingCandidateIds: asStringArray(filterDetails?.survivingCandidateIds),
          blockedCandidateIds: asBlockedCandidateIds(filterDetails?.blocked),
        }
      : null,
    tieBreak: tieBreakEntry
      ? {
          ruleId: asString(tieBreakEntry.ruleId) ?? "tie_break",
          outcome: asString(tieBreakEntry.outcome) ?? "unknown",
          selectedCandidateId: asString(tieBreakDetails?.selectedCandidateId),
          eligibleCandidateIds: asStringArray(tieBreakDetails?.eligibleCandidateIds),
          topScore: asNumber(tieBreakDetails?.topScore),
          bandWidth: asNumber(tieBreakDetails?.bandWidth),
        }
      : null,
    replayReference,
  });
};

export const deriveWorkoutCompletionExplanation = (
  trace: TraceRow
): {
  explanation: WorkoutCompletionExplanationReadModel | null;
  replayReference: ReplayDebugReference | null;
} => {
  const result = parseEngineResult(trace.engine_result);
  if (trace.operation !== "complete_session" || !result) {
    return { explanation: null, replayReference: null };
  }

  const decisionLog = readDecisionLog(trace.decision_log);
  const replayReference = toReplayDebugReference(trace.id, trace.replay_receipt);
  const outcome =
    asString(result.sessionOutcomeClassification) ?? asString(findDecisionEntry(decisionLog, "classify")?.outcome);

  if (!replayReference || !outcome) {
    return { explanation: null, replayReference: null };
  }

  const updatedProgression = readProgressionChanges(result.updatedProgressionActionSummary);

  const awardedXpSummary = isRecord(result.awardedXpSummary) ? result.awardedXpSummary : null;
  const classifyDetails = isRecord(findDecisionEntry(decisionLog, "classify")?.details)
    ? (findDecisionEntry(decisionLog, "classify")?.details as Record<string, unknown>)
    : null;
  const stateUpdateDetails = isRecord(findDecisionEntry(decisionLog, "state_update")?.details)
    ? (findDecisionEntry(decisionLog, "state_update")?.details as Record<string, unknown>)
    : null;

  const explanation = parseReadModel(WorkoutCompletionExplanationReadModelSchema, {
    sessionOutcomeClassification: outcome,
    warnings: asStringArray(result.warnings),
    progressionChanges: updatedProgression,
    xp: {
      xpDelta: asInteger(awardedXpSummary?.xpDelta) ?? 0,
      streakDelta: asInteger(awardedXpSummary?.streakDelta) ?? 0,
      reason: asString(awardedXpSummary?.reason) ?? "unknown",
    },
    primaryExerciseId: asString(classifyDetails?.primaryExerciseId),
    touchedBuckets: asStringArray(stateUpdateDetails?.touchedBuckets),
  });

  return {
    explanation,
    replayReference,
  };
};

export const getActiveCycleReporting = async (
  supabase: SupabaseClient,
  userId: string,
  planId?: number | null
): Promise<ActiveCycleReportingReadModel | null> => {
  let planRow: PlanRow | null = null;

  if (typeof planId === "number" && Number.isFinite(planId)) {
    const { data } = await supabase
      .from("engine_cycle_plans")
      .select(
        "id, current_session_index, current_microcycle_index, total_sessions, resolved_class_archetype, class_preset_id"
      )
      .eq("user_id", userId)
      .eq("id", planId)
      .maybeSingle();
    planRow = (data as PlanRow | null) ?? null;
  } else {
    const { data } = await supabase
      .from("engine_cycle_plans")
      .select(
        "id, current_session_index, current_microcycle_index, total_sessions, resolved_class_archetype, class_preset_id"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    planRow = (data as PlanRow | null) ?? null;
  }

  if (!planRow) {
    return null;
  }

  const [{ data: sessionRows }, { data: gamificationRow }, { data: progressionRows }] =
    await Promise.all([
      supabase
        .from("engine_cycle_sessions")
        .select("id, plan_id, session_index, completed_at")
        .eq("plan_id", planRow.id),
      supabase
        .from("engine_gamification_states")
        .select(
          "id, plan_id, xp, level, adherence_streak, completed_session_count, missed_session_count, last_adherence_outcome_classification, last_awarded_at"
        )
        .eq("plan_id", planRow.id)
        .maybeSingle(),
      supabase
        .from("engine_progression_states")
        .select(
          "id, plan_id, exercise_id, current_action, trend, last_successful_load_weight, last_successful_load_reps, consecutive_successful_completions, consecutive_stall_or_regression_count, swap_recommendation_count, last_session_outcome_classification, last_completed_at"
        )
        .eq("plan_id", planRow.id),
    ]);

  const sessions = (sessionRows ?? []) as CycleSessionRow[];
  const gamification = (gamificationRow as GamificationRow | null) ?? null;
  const progression = readNormalizedProgressionRows(progressionRows ?? []);

  if (!gamification) {
    return null;
  }

  const completedSessions = sessions.filter((session) => session.completed_at != null).length;
  const totalSessions = Number(planRow.total_sessions ?? sessions.length ?? 0);
  const currentSessionIndex = Number(planRow.current_session_index ?? 0);
  const nextSessionIndex =
    currentSessionIndex < Math.max(totalSessions - 1, 0) ? currentSessionIndex + 1 : null;

  return parseReadModel(ActiveCycleReportingReadModelSchema, {
    cyclePlanId: String(planRow.id),
    classContext: {
      resolvedClassArchetype:
        planRow.resolved_class_archetype === "strength" ||
        planRow.resolved_class_archetype === "hybrid"
          ? planRow.resolved_class_archetype
          : null,
      classPresetId: asClassPresetId(planRow.class_preset_id),
    },
    adherence: {
      xp: Number(gamification.xp ?? 0),
      level: Number(gamification.level ?? 1),
      adherenceStreak: Number(gamification.adherence_streak ?? 0),
      completedSessionCount: Number(gamification.completed_session_count ?? 0),
      missedSessionCount: Number(gamification.missed_session_count ?? 0),
      lastAdherenceOutcomeClassification:
        gamification.last_adherence_outcome_classification === "complete_clean" ||
        gamification.last_adherence_outcome_classification === "complete_compromised" ||
        gamification.last_adherence_outcome_classification === "partial" ||
        gamification.last_adherence_outcome_classification === "missed"
          ? gamification.last_adherence_outcome_classification
          : null,
      lastAwardedAt: gamification.last_awarded_at ?? null,
    },
    cycleProgress: {
      currentSessionIndex,
      currentMicrocycleIndex:
        typeof planRow.current_microcycle_index === "number"
          ? planRow.current_microcycle_index
          : null,
      totalSessions,
      completedSessions,
      remainingSessions: Math.max(totalSessions - completedSessions, 0),
      nextSessionIndex,
    },
    progression: {
      totalExercises: progression.length,
      improvingCount: progression.filter((row) => row.trend === "improving").length,
      stalledCount: progression.filter((row) => row.trend === "stalled").length,
      regressingCount: progression.filter((row) => row.trend === "regressing").length,
      blockedCount: progression.filter((row) => row.trend === "blocked").length,
      swapRecommendationCount: progression.reduce(
        (total, row) => total + row.swapRecommendationCount,
        0
      ),
      exercises: progression,
    },
  });
};

type DeterministicAnalyticsOptions = {
  recentSessionLimit?: number;
  planId?: number | null;
};

const clampRecentSessionLimit = (limit: unknown): number => {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 5;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 20);
};

const roundPercentage = (value: number): number => Math.round(value * 100) / 100;

const calculateCompletionPercentage = (
  completedSessions: number,
  totalSessions: number
): number => {
  if (totalSessions <= 0) {
    return 0;
  }

  return roundPercentage(
    Math.min(Math.max((completedSessions / totalSessions) * 100, 0), 100)
  );
};

const getRecentSessionAnalytics = async (
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  context?: WorkoutHistoryContext
): Promise<DeterministicAnalyticsReadModel["recentSessions"]> => {
  const workoutContext = context ?? (await getWorkoutHistoryContext(supabase, userId));
  if (workoutContext.workouts.length === 0) {
    return [];
  }

  const setCountByWorkout = new Map<number, number>();
  for (const set of workoutContext.setRows) {
    setCountByWorkout.set(
      set.workout_log_id,
      (setCountByWorkout.get(set.workout_log_id) ?? 0) + 1
    );
  }

  return workoutContext.workouts
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at).getTime();
      const rightTime = new Date(right.completed_at).getTime();
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return right.id - left.id;
    })
    .slice(0, limit)
      .flatMap((workout) => {
      const parsed = parseReadModel(DeterministicAnalyticsReadModelSchema.shape.recentSessions.element, {
        workoutLogId: workout.id,
        completedAt: workout.completed_at,
        dayName:
          workout.program_day_id !== null && workout.program_day_id !== undefined
            ? workoutContext.dayNameById.get(workout.program_day_id) ??
              getMetadataString(workout.metadata, "programDayName") ??
              getMetadataString(workout.metadata, "dayName") ??
              "Workout Session"
            : getMetadataString(workout.metadata, "programDayName") ??
              getMetadataString(workout.metadata, "dayName") ??
              "Workout Session",
        durationSeconds: workout.duration_seconds ?? null,
        totalVolume: workout.total_volume ?? null,
        setCount: setCountByWorkout.get(workout.id) ?? 0,
        seed: workout.seed ?? null,
      });
      return parsed ? [parsed] : [];
    });
};

export const getDeterministicAnalyticsReadModel = async (
  supabase: SupabaseClient,
  userId: string,
  options: DeterministicAnalyticsOptions = {}
): Promise<DeterministicAnalyticsReadModel | null> => {
  const reporting = await getActiveCycleReporting(supabase, userId, options.planId ?? null);
  if (!reporting) {
    return null;
  }

  const recentSessionLimit = clampRecentSessionLimit(options.recentSessionLimit);
  const workoutHistoryContext = await getWorkoutHistoryContext(supabase, userId);
  const recentSessions = await getRecentSessionAnalytics(
    supabase,
    userId,
    recentSessionLimit,
    workoutHistoryContext
  );
  const fatigueSummary = await getFatigueSummaryFromCycleSessions(supabase, reporting.cyclePlanId);
  const capacityTimeline = getCapacityTimeline(workoutHistoryContext);
  const weeklyVolume = getWeeklyVolumeAnalytics(workoutHistoryContext);

  const exercises = reporting.progression.exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    action: exercise.currentAction,
    trend: exercise.trend,
    swapRecommendationCount: exercise.swapRecommendationCount,
    lastOutcome: exercise.lastSessionOutcomeClassification,
    lastCompletedAt: exercise.lastCompletedAt,
  }));

  const swapPressureExerciseIds = exercises
    .filter((exercise) => exercise.swapRecommendationCount > 0)
    .map((exercise) => exercise.exerciseId)
    .sort((left, right) => left.localeCompare(right));

  return parseReadModel(DeterministicAnalyticsReadModelSchema, {
    cyclePlanId: reporting.cyclePlanId,
    cycleCompletion: {
      ...reporting.cycleProgress,
      completionPercentage: calculateCompletionPercentage(
        reporting.cycleProgress.completedSessions,
        reporting.cycleProgress.totalSessions
      ),
    },
    fatigueSummary,
    capacityTimeline,
    weeklyVolume,
    adherence: {
      streak: reporting.adherence.adherenceStreak,
      completedCount: reporting.adherence.completedSessionCount,
      missedCount: reporting.adherence.missedSessionCount,
      lastOutcome: reporting.adherence.lastAdherenceOutcomeClassification,
      xp: reporting.adherence.xp,
      level: reporting.adherence.level,
    },
    progression: {
      totalExercises: exercises.length,
      trendCounts: {
        improving: exercises.filter((exercise) => exercise.trend === "improving").length,
        stalled: exercises.filter((exercise) => exercise.trend === "stalled").length,
        regressing: exercises.filter((exercise) => exercise.trend === "regressing").length,
        blocked: exercises.filter((exercise) => exercise.trend === "blocked").length,
      },
      actionCounts: {
        overload: exercises.filter((exercise) => exercise.action === "overload").length,
        maintain: exercises.filter((exercise) => exercise.action === "maintain").length,
        regress: exercises.filter((exercise) => exercise.action === "regress").length,
        swap: exercises.filter((exercise) => exercise.action === "swap").length,
      },
      swapPressure: {
        affectedExerciseCount: swapPressureExerciseIds.length,
        recommendationCount: exercises.reduce(
          (total, exercise) => total + exercise.swapRecommendationCount,
          0
        ),
        exerciseIds: swapPressureExerciseIds,
      },
      exercises,
    },
    recentSessions,
  });
};

export const getWorkoutCompletionReadModels = async (
  supabase: SupabaseClient,
  userId: string,
  workoutLogId: number
): Promise<{
  explanation: WorkoutCompletionExplanationReadModel | null;
  reporting: ActiveCycleReportingReadModel | null;
  replayReference: ReplayDebugReference | null;
  replayDebugBundle: ReplayDebugBundle;
}> => {
  const { data: traceRow } = await supabase
    .from("engine_session_traces")
    .select(
      "id, user_id, operation, cycle_plan_id, cycle_session_id, workout_log_id, input_material, decision_log, replay_receipt, engine_result"
    )
    .eq("user_id", userId)
    .eq("workout_log_id", workoutLogId)
    .eq("operation", "complete_session")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const trace = (traceRow as TraceRow | null) ?? null;
  if (!trace) {
    const missingTrace = buildReplayDebugBundle(
      {
        id: 0,
        user_id: userId,
        operation: "complete_session",
      },
      "unavailable",
      "trace_not_found",
      "complete_session"
    );
    return {
      explanation: null,
      reporting: null,
      replayReference: null,
      replayDebugBundle: missingTrace,
    };
  }

  const { explanation, replayReference } = deriveWorkoutCompletionExplanation(trace);
  const reporting = await getActiveCycleReporting(supabase, userId, trace.cycle_plan_id ?? null);
  const replayDebugBundle = deriveWorkoutCompletionReplayDebugBundle(trace);

  return {
    explanation,
    reporting,
    replayReference,
    replayDebugBundle,
  };
};
export const deriveAdvanceCycleReplayDebugBundle = (trace: TraceRow): ReplayDebugBundle => {
  if (trace.operation !== "advance_cycle") {
    return buildReplayDebugBundle(
      trace,
      "unavailable",
      "invalid_trace_material",
      "advance_cycle"
    );
  }

  const decisionLog = readDebugDecisionLog(trace);
  const engineResult = parseEngineResult(trace.engine_result);
  const replayReceipt = toReplayReceipt(trace.replay_receipt);
  if (!engineResult) {
    return buildReplayDebugBundle(trace, "unavailable", "missing_engine_result", "advance_cycle");
  }
  if (!replayReceipt) {
    return buildReplayDebugBundle(trace, "unavailable", "missing_replay_receipt", "advance_cycle");
  }
  if (readReplayDebugInputMaterial(trace).availability !== "available") {
    return buildReplayDebugBundle(trace, "unavailable", "missing_input_material", "advance_cycle");
  }

  return buildReplayDebugBundleFromParsedTrace(
    trace,
    "advance_cycle",
    replayReceipt as Record<string, unknown>,
    redactBetaDebugValue(engineResult) as Record<string, unknown>,
    decisionLog
  );
};


