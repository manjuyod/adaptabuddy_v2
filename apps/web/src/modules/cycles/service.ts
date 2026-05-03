import type {
  ClassPresetId,
  CanonicalClassArchetype,
  InitializeCycleRequest,
  InitializeCycleResponse,
  NormalizedGamificationState,
  UserStats,
} from "@adaptabuddy/contracts";
import {
  CanonicalClassArchetypeSchema,
  ClassPresetIdSchema,
} from "@adaptabuddy/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerActionClient } from "@/lib/supabase/next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultUserStats } from "@/lib/db-transformers";
import { runEngineInput } from "@/lib/engine-runner";
import {
  CANON_REPLAY_CANONICALIZATION_VERSION,
  computeCanonicalReplayReferenceHash,
} from "@/lib/engine-replay";
import { logServerEvent } from "@/lib/observability/logger";
import {
  shapeSelectedProgramsForPreset,
  type CycleClassPresetRecord,
  type CycleExerciseReference,
  type CycleProgramSelectionPayload,
} from "./class-presets";

type ProgramRow = {
  id: number;
  slug?: string | null;
  name: string;
  is_active?: boolean | null;
};

type ProgramDayRow = {
  id: number;
  program_id: number;
  day_index: number;
  name: string;
};

type ProgramSlotRow = {
  id: number;
  program_day_id: number;
  slot_index: number;
  slot_type: string | null;
  movement_pattern?: string | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  muscle_targets?: Record<string, number> | null;
  tags_required?: string[] | null;
};

type ExerciseRow = {
  id: number;
  slug: string;
  name: string;
  movement_pattern?: string | null;
  equipment?: string[] | null;
  tags?: string[] | null;
  is_bodyweight?: boolean | null;
};

type ClassRow = {
  id: string;
  is_selectable?: boolean | null;
  status?: string | null;
  base_archetype?: string | null;
};

type EngineGamificationStateRow = {
  xp?: number | null;
  level?: number | null;
  adherence_streak?: number | null;
  completed_session_count?: number | null;
  missed_session_count?: number | null;
  last_adherence_outcome_classification?: string | null;
  last_awarded_at?: string | null;
};

const DEFAULT_CLASS_ROWS: ClassRow[] = [
  { id: "classless", is_selectable: true, status: "active", base_archetype: "hybrid" },
  { id: "bb", is_selectable: true, status: "active", base_archetype: "hybrid" },
  { id: "powa", is_selectable: true, status: "active", base_archetype: "strength" },
  { id: "ninja", is_selectable: true, status: "active", base_archetype: "hybrid" },
  { id: "monk", is_selectable: false, status: "planned", base_archetype: "hybrid" },
];

type EngineInitializeResponse = {
  result?: {
    resolvedClassArchetype?: CanonicalClassArchetype;
    primaryProgramId?: string;
    macrocycle?: {
      totalWeeks?: number;
      mesocycleCount?: number;
      currentMesocycleIndex?: number;
      currentMicrocycleIndex?: number;
      currentSessionIndex?: number;
      sessions?: Array<{
        sessionId: string;
        programId: string;
        programDayId: string;
        programDayName: string;
        macroWeek: number;
        mesocycleIndex: number;
        microcycleIndex: number;
        sessionIndex: number;
        plannedDayOfWeek: number;
        classArchetype: CanonicalClassArchetype;
        slotPayload: Array<Record<string, unknown>>;
      }>;
    };
    initialGamificationState?: {
      xp: number;
      level: number;
      adherenceStreak: number;
      completedSessionCount?: number;
      missedSessionCount?: number;
      lastAdherenceOutcomeClassification?: "complete_clean" | "complete_compromised" | "partial" | "missed";
      lastAwardedAt?: string;
    };
    programBlend?: Array<{
      programId: string;
      weight: number;
      role: string;
    }>;
  };
};

const parseCanonicalClassArchetype = (
  value: unknown
): CanonicalClassArchetype | null => {
  const parsed = CanonicalClassArchetypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseClassPresetId = (value: unknown): ClassPresetId | null => {
  const parsed = ClassPresetIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const defaultNormalizedGamificationState = (
  effectiveAt: string
): NormalizedGamificationState => ({
  xp: 140,
  level: 3,
  adherenceStreak: 6,
  completedSessionCount: 0,
  missedSessionCount: 0,
  lastAdherenceOutcomeClassification: "complete_clean",
  lastAwardedAt: effectiveAt,
});

const toNormalizedGamificationState = (
  row: EngineGamificationStateRow | null | undefined,
  effectiveAt: string
): NormalizedGamificationState => {
  const fallback = defaultNormalizedGamificationState(effectiveAt);

  if (!row) {
    return fallback;
  }

  return {
    xp: Number(row.xp ?? fallback.xp),
    level: Number(row.level ?? fallback.level),
    adherenceStreak: Number(row.adherence_streak ?? fallback.adherenceStreak),
    completedSessionCount: Number(
      row.completed_session_count ?? fallback.completedSessionCount
    ),
    missedSessionCount: Number(
      row.missed_session_count ?? fallback.missedSessionCount
    ),
    lastAdherenceOutcomeClassification:
      row.last_adherence_outcome_classification === "complete_clean" ||
      row.last_adherence_outcome_classification === "complete_compromised" ||
      row.last_adherence_outcome_classification === "partial" ||
      row.last_adherence_outcome_classification === "missed"
        ? row.last_adherence_outcome_classification
        : fallback.lastAdherenceOutcomeClassification,
    lastAwardedAt:
      typeof row.last_awarded_at === "string" && row.last_awarded_at.length > 0
        ? row.last_awarded_at
        : fallback.lastAwardedAt,
  };
};

const toProgramSelectionPayload = (
  selectedPrograms: InitializeCycleRequest["selectedPrograms"],
  dayRows: ProgramDayRow[],
  slotRows: ProgramSlotRow[]
): CycleProgramSelectionPayload[] => {
  return selectedPrograms.map((selection) => {
    const programId = Number(selection.programId);
    const days = dayRows
      .filter((row) => row.program_id === programId)
      .sort((left, right) => left.day_index - right.day_index)
      .map((day) => ({
        programDayId: String(day.id),
        dayIndex: day.day_index,
        name: day.name,
        slots: slotRows
          .filter((row) => row.program_day_id === day.id)
          .sort((left, right) => left.slot_index - right.slot_index)
          .map((slot) => ({
            slotId: String(slot.id),
            slotIndex: slot.slot_index,
            slotType: slot.slot_type ?? "accessory",
            movementPattern: slot.movement_pattern ?? null,
            setsMin: slot.sets_min,
            setsMax: slot.sets_max,
            repsMin: slot.reps_min,
            repsMax: slot.reps_max,
            muscleTargets: slot.muscle_targets ?? {},
            tagsRequired: slot.tags_required ?? [],
          })),
      }));

    return {
      programId: String(selection.programId),
      weight: selection.weight,
      days,
    };
  });
};

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flat(Infinity)
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
};

const toExerciseReference = (row: ExerciseRow): CycleExerciseReference => ({
  id: String(row.id),
  slug: row.slug,
  name: row.name,
  movementPattern: row.movement_pattern ?? "",
  equipment: normalizeStringList(row.equipment),
  tags: normalizeStringList(row.tags),
  isBodyweight: row.is_bodyweight ?? false,
});

const resolveClassPreset = (rows: ClassRow[], presetId: ClassPresetId) => {
  const row = rows.find((candidate) => candidate.id === presetId);
  if (!row) {
    return { ok: false as const, error: "Selected class preset is not available" };
  }

  const parsedId = parseClassPresetId(row.id);
  const baseArchetype = parseCanonicalClassArchetype(row.base_archetype);
  if (!parsedId || !baseArchetype) {
    return { ok: false as const, error: "Selected class preset is not available" };
  }

  if (row.is_selectable === false || row.status !== "active") {
    return { ok: false as const, error: "Selected class preset is not available" };
  }

  const preset: CycleClassPresetRecord = {
    id: parsedId,
    isSelectable: true,
    status: row.status ?? "active",
    baseArchetype,
  };

  return { ok: true as const, preset };
};

const findProgramTemplateIntegrityErrors = (
  selectedPrograms: InitializeCycleRequest["selectedPrograms"],
  programRows: ProgramRow[],
  dayRows: ProgramDayRow[],
  slotRows: ProgramSlotRow[]
) => {
  const programIds = new Set(programRows.map((program) => program.id));

  return selectedPrograms.flatMap((selection) => {
    const programId = Number(selection.programId);

    if (!programIds.has(programId)) {
      return [`program ${selection.programId} template is missing`];
    }

    const programDays = dayRows
      .filter((row) => row.program_id === programId)
      .sort((left, right) => left.day_index - right.day_index);

    if (programDays.length === 0) {
      return [`program ${selection.programId} has no program days`];
    }

    return programDays.flatMap((day) => {
      const daySlots = slotRows.filter((row) => row.program_day_id === day.id);
      if (daySlots.length > 0) {
        return [];
      }

      return [`program ${selection.programId} day ${day.id} has no program slots`];
    });
  });
};

const buildProjection = (
  currentStats: UserStats,
  input: InitializeCycleRequest,
  result: NonNullable<EngineInitializeResponse["result"]>,
  effectiveAt: string
): UserStats => {
  const activeSession =
    result.macrocycle?.sessions?.find(
      (session) => session.sessionIndex === (result.macrocycle?.currentSessionIndex ?? 0)
    ) ?? null;
  const nextStats: UserStats = {
    ...currentStats,
    activeProgram: result.primaryProgramId
      ? {
        programId: result.primaryProgramId,
          startedAt: effectiveAt,
          currentDayIndex: activeSession?.plannedDayOfWeek ?? 0,
          currentMicrocycle: (activeSession?.microcycleIndex ?? 0) + 1,
          daysPerWeek: input.availableDaysPerWeek,
        }
      : currentStats.activeProgram,
  };

  return nextStats;
};

const readInsertedId = (data: unknown): number | null => {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }

  const candidate = (row as { id?: unknown }).id;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return null;
  }

  return candidate;
};

const cleanupInitializedCycleState = async (
  client: SupabaseClient,
  profileId: number,
  planId: number | null,
  previousActivePlanId: number | null
) => {
  if (planId !== null) {
    await client.from("engine_gamification_states").delete().eq("plan_id", planId);
    await client.from("engine_cycle_sessions").delete().eq("plan_id", planId);
    await client.from("engine_cycle_plans").delete().eq("id", planId);
  }

  await client.from("engine_cycle_program_mix").delete().eq("profile_id", profileId);
  await client.from("engine_cycle_profiles").delete().eq("id", profileId);

  if (previousActivePlanId !== null) {
    await client.from("engine_cycle_plans").update({ is_active: true }).eq("id", previousActivePlanId);
  }
};

export async function handleInitializeCycle(
  userId: string,
  input: InitializeCycleRequest
): Promise<InitializeCycleResponse> {
  const supabase = await createSupabaseServerActionClient();
  const writeClient = createSupabaseAdminClient() ?? supabase;
  const effectiveAt = new Date().toISOString();

  const [
    { data: userRow, error: userError },
    { data: classRows, error: classError },
    { data: programRows, error: programError },
    { data: dayRows, error: dayError },
    { data: slotRows, error: slotError },
    { data: exerciseRows, error: exerciseError },
    { data: muscleRows, error: muscleError },
    { data: previousActivePlanData, error: previousActivePlanError },
  ] =
    await Promise.all([
      supabase.from("users").select("stats_json").eq("id", userId).single(),
      supabase.from("classes").select("id, is_selectable, status, base_archetype"),
      supabase.from("programs").select("id, slug, name, is_active").in("id", input.selectedPrograms.map((program) => Number(program.programId))),
      supabase.from("program_days").select("id, program_id, day_index, name").in("program_id", input.selectedPrograms.map((program) => Number(program.programId))),
      supabase.from("program_slots").select("id, program_day_id, slot_index, slot_type, movement_pattern, sets_min, sets_max, reps_min, reps_max, muscle_targets, tags_required"),
      supabase.from("exercises").select("id, slug, name, movement_pattern, equipment, tags, is_bodyweight"),
      supabase.from("muscle_groups").select("id, slug, name"),
      supabase.from("engine_cycle_plans").select("id").eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle(),
    ]);

  if (userError) {
    return {
      status: "error",
      errors: [`Failed to load current user state: ${userError.message}`],
    };
  }

  if (classError || !classRows) {
    return {
      status: "error",
      errors: ["Failed to load class presets for cycle initialization"],
    };
  }

  if (programError || dayError || slotError || !programRows || !dayRows || !slotRows) {
    return {
      status: "error",
      errors: ["Failed to load program templates for cycle initialization"],
    };
  }

  if (exerciseError || !exerciseRows) {
    return {
      status: "error",
      errors: ["Failed to load exercise reference data for cycle initialization"],
    };
  }

  const activeProgramIds = new Set(
    ((programRows ?? []) as ProgramRow[])
      .filter((program) => program.is_active === true)
      .map((program) => program.id)
  );
  const unavailableProgram = input.selectedPrograms.find(
    (selection) => !activeProgramIds.has(Number(selection.programId))
  );
  if (unavailableProgram) {
    return {
      status: "error",
      errors: ["Selected program is unavailable"],
    };
  }

  const templateIntegrityErrors = findProgramTemplateIntegrityErrors(
    input.selectedPrograms,
    programRows as ProgramRow[],
    dayRows as ProgramDayRow[],
    slotRows as ProgramSlotRow[]
  );
  if (templateIntegrityErrors.length > 0) {
    return {
      status: "error",
      errors: [`Selected program templates are incomplete: ${templateIntegrityErrors.join("; ")}`],
    };
  }

  if (muscleError) {
    return {
      status: "error",
      errors: ["Failed to load muscle groups for cycle initialization"],
    };
  }

  if (previousActivePlanError) {
    return {
      status: "error",
      errors: [`Failed to load current active cycle plan: ${previousActivePlanError.message}`],
    };
  }

  const validInjuries = new Set(
    ((muscleRows ?? []) as Array<{ slug?: string | null }>)
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0)
  );
  const invalidInjury = input.injuryMuscleGroupSlugs.find((slug) => !validInjuries.has(slug));
  if (invalidInjury) {
    return {
      status: "error",
      errors: [`Unknown muscle group slug: ${invalidInjury}`],
    };
  }

  const presetResolution = resolveClassPreset(
    ((classRows ?? []) as ClassRow[]).length > 0
      ? ((classRows ?? []) as ClassRow[])
      : DEFAULT_CLASS_ROWS,
    input.classPresetId
  );
  if (!presetResolution.ok) {
    return {
      status: "error",
      errors: [presetResolution.error],
    };
  }
  const resolvedPreset = presetResolution.preset;
  const exerciseReferences = (exerciseRows as ExerciseRow[]).map(toExerciseReference);
  const shapedProgramSelection = shapeSelectedProgramsForPreset({
    preset: resolvedPreset,
    selectedPrograms: toProgramSelectionPayload(
      input.selectedPrograms,
      dayRows as ProgramDayRow[],
      slotRows as ProgramSlotRow[]
    ),
    exercises: exerciseReferences,
  });
  if (!shapedProgramSelection.ok) {
    return {
      status: "error",
      errors: [shapedProgramSelection.error],
    };
  }

  const currentStats = (userRow?.stats_json as UserStats | null) ?? getDefaultUserStats();
  const previousActivePlanId = readInsertedId(previousActivePlanData);
  let currentGamificationState = defaultNormalizedGamificationState(effectiveAt);

  if (previousActivePlanId !== null) {
    const { data: currentGamificationRow, error: currentGamificationError } = await supabase
      .from("engine_gamification_states")
      .select(
        "xp, level, adherence_streak, completed_session_count, missed_session_count, last_adherence_outcome_classification, last_awarded_at"
      )
      .eq("plan_id", previousActivePlanId)
      .maybeSingle();

    if (currentGamificationError) {
      return {
        status: "error",
        errors: [`Failed to load current cycle gamification state: ${currentGamificationError.message}`],
      };
    }

    if (!currentGamificationRow) {
      return {
        status: "error",
        errors: ["Failed to load current cycle gamification state: missing active gamification row"],
      };
    }

    currentGamificationState = toNormalizedGamificationState(
      currentGamificationRow as EngineGamificationStateRow,
      effectiveAt
    );
  }

  const referenceSnapshot = {
    referenceVersion: "2026-03",
    exercises: exerciseReferences
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((exercise) => ({
        id: exercise.id,
        slug: exercise.slug,
        name: exercise.name,
        movementPattern: exercise.movementPattern,
        equipment: exercise.equipment,
        tags: exercise.tags,
      })),
    programs: (programRows as ProgramRow[])
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((program) => ({
        id: String(program.id),
        slug: program.slug ?? String(program.id),
        name: program.name,
        daysPerWeek: input.availableDaysPerWeek,
      })),
  };
  let referenceHash: string;
  try {
    referenceHash = computeCanonicalReplayReferenceHash(referenceSnapshot);
  } catch (error) {
    return {
      status: "error",
      errors: [error instanceof Error ? error.message : "Failed to compute reference hash"],
    };
  }

  const engineInput = {
    schemaVersion: "engine.v1",
    operation: "initialize_cycle",
    determinism: {
      seed: `init-${userId}`,
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
        goalBias: input.goalBias,
        availableDaysPerWeek: input.availableDaysPerWeek,
        classArchetype: resolvedPreset.baseArchetype,
      },
      readinessState: {
        systemicFatigue: "moderate",
        muscleFatigue: {},
      },
      injuryState: {
        activeLimitations: [],
        blockedMovementPatterns: [],
      },
      performanceState: {
        knownLifts: {},
      },
      progressionState: {
        records: [],
      },
      gamificationState: currentGamificationState,
      activeProgramState: {
        programId: String(input.selectedPrograms[0]?.programId ?? ""),
        currentDayIndex: 0,
        currentMicrocycle: 1,
      },
      recentCompletions: [],
    },
    policySnapshot: {
      noveltyBudget: 1,
      classArchetypeBias: 0.1,
      fatigueBlockThreshold: "severe",
      seededTieBreakBand: 0.05,
    },
    request: {
      profile: {
        classChoice: resolvedPreset.baseArchetype,
        goalBias: input.goalBias,
        availableDaysPerWeek: input.availableDaysPerWeek,
        fatiguePreference: input.fatiguePreference,
        injuryMuscleGroupSlugs: input.injuryMuscleGroupSlugs,
      },
      macrocycleWeeks: input.macrocycleWeeks,
      selectedPrograms: shapedProgramSelection.payload,
    },
    metadata: {
      correlationId: `cycle-init-${userId}`,
    },
  };

  let engineOutput: EngineInitializeResponse;
  try {
    engineOutput = (await runEngineInput(engineInput)) as EngineInitializeResponse;
  } catch (error) {
    logServerEvent({
      route: "/api/v0/sessions/initialize",
      action: "handleInitializeCycle",
      severity: "error",
      reason: "dependency_error",
      userId,
      details: {
        operation: "initialize_cycle",
        classPresetId: input.classPresetId,
        goalBias: input.goalBias,
      },
      error,
    });

    return {
      status: "error",
      errors: ["Engine cycle initialization failed. Please try again."],
    };
  }
  const result = engineOutput.result;
  const macrocycle = result?.macrocycle;
  const resolvedClassArchetype = parseCanonicalClassArchetype(
    result?.resolvedClassArchetype
  );
  const sessions = macrocycle?.sessions;

  if (!result || !macrocycle || !sessions || !result.primaryProgramId || !resolvedClassArchetype) {
    return {
      status: "error",
      errors: ["Engine did not return an initialize_cycle result"],
    };
  }

  if (sessions.some((session) => session.classArchetype !== resolvedClassArchetype)) {
    return {
      status: "error",
      errors: ["Engine did not return a canonical initialize_cycle result"],
    };
  }

  const { data: profileData, error: profileError } = await writeClient
    .from("engine_cycle_profiles")
    .insert({
      user_id: userId,
      class_choice: resolvedPreset.baseArchetype,
      class_preset_id: input.classPresetId,
      goal_bias: input.goalBias,
      available_days_per_week: input.availableDaysPerWeek,
      fatigue_preference: input.fatiguePreference,
      injury_muscle_group_slugs: input.injuryMuscleGroupSlugs,
      macrocycle_weeks: input.macrocycleWeeks,
    })
    .select("id")
    .single();
  if (profileError) {
    return {
      status: "error",
      errors: [`Failed to persist cycle profile: ${profileError.message}`],
    };
  }
  const profileId = readInsertedId(profileData);
  if (profileId === null) {
    return {
      status: "error",
      errors: ["Cycle profile insert did not return an id"],
    };
  }

  if (result.programBlend?.length) {
    const { error: programMixError } = await writeClient.from("engine_cycle_program_mix").insert(
      result.programBlend.map((entry) => ({
        user_id: userId,
        profile_id: profileId,
        program_id: Number(entry.programId),
        selection_weight: entry.weight,
        role: entry.role,
      }))
    );
    if (programMixError) {
      await cleanupInitializedCycleState(writeClient, profileId, null, null);
      return {
        status: "error",
        errors: [`Failed to persist cycle program mix: ${programMixError.message}`],
      };
    }
  }

  if (previousActivePlanId !== null) {
    const { error: deactivateActivePlanError } = await writeClient
      .from("engine_cycle_plans")
      .update({ is_active: false })
      .eq("id", previousActivePlanId);
    if (deactivateActivePlanError) {
      await cleanupInitializedCycleState(writeClient, profileId, null, null);
      return {
        status: "error",
        errors: [`Failed to deactivate existing cycle plan: ${deactivateActivePlanError.message}`],
      };
    }
  }

  const { data: planData, error: planError } = await writeClient
    .from("engine_cycle_plans")
    .insert({
      user_id: userId,
      profile_id: profileId,
      class_preset_id: input.classPresetId,
      primary_program_id: Number(result.primaryProgramId),
      resolved_class_archetype: resolvedClassArchetype,
      total_weeks: macrocycle.totalWeeks ?? input.macrocycleWeeks,
      mesocycle_count: macrocycle.mesocycleCount ?? 1,
      current_mesocycle_index: macrocycle.currentMesocycleIndex ?? 0,
      current_microcycle_index: macrocycle.currentMicrocycleIndex ?? 0,
      current_session_index: macrocycle.currentSessionIndex ?? 0,
      total_sessions: sessions.length,
      is_active: true,
    })
    .select("id")
    .single();
  if (planError) {
    await cleanupInitializedCycleState(writeClient, profileId, null, previousActivePlanId);
    return {
      status: "error",
      errors: [`Failed to persist cycle plan: ${planError.message}`],
    };
  }
  const planId = readInsertedId(planData);
  if (planId === null) {
    await cleanupInitializedCycleState(writeClient, profileId, null, previousActivePlanId);
    return {
      status: "error",
      errors: ["Cycle plan insert did not return an id"],
    };
  }

  const { error: sessionInsertError } = await writeClient.from("engine_cycle_sessions").insert(
    sessions.map((session) => ({
      user_id: userId,
      plan_id: planId,
      session_index: session.sessionIndex,
      program_id: Number(session.programId),
      program_day_id: Number(session.programDayId),
      program_day_name: session.programDayName,
      macro_week: session.macroWeek,
      mesocycle_index: session.mesocycleIndex,
      microcycle_index: session.microcycleIndex,
      planned_day_of_week: session.plannedDayOfWeek,
      class_archetype: resolvedClassArchetype,
      slot_payload: session.slotPayload,
      session_seed: session.sessionId,
      projected_fatigue_cost: {},
      completed_at: null,
    }))
  );
  if (sessionInsertError) {
    await cleanupInitializedCycleState(writeClient, profileId, planId, previousActivePlanId);
    return {
      status: "error",
      errors: [`Failed to persist cycle sessions: ${sessionInsertError.message}`],
    };
  }

  const { error: gamificationInsertError } = await writeClient.from("engine_gamification_states").insert({
    user_id: userId,
    plan_id: planId,
    xp: result.initialGamificationState?.xp ?? 0,
    level: result.initialGamificationState?.level ?? 1,
    adherence_streak: result.initialGamificationState?.adherenceStreak ?? 0,
    completed_session_count:
      result.initialGamificationState?.completedSessionCount ?? 0,
    missed_session_count:
      result.initialGamificationState?.missedSessionCount ?? 0,
    last_adherence_outcome_classification:
      result.initialGamificationState?.lastAdherenceOutcomeClassification ?? null,
    last_awarded_at: result.initialGamificationState?.lastAwardedAt ?? null,
    class_archetype: resolvedClassArchetype,
  });
  if (gamificationInsertError) {
    await cleanupInitializedCycleState(writeClient, profileId, planId, previousActivePlanId);
    return {
      status: "error",
      errors: [`Failed to persist cycle gamification state: ${gamificationInsertError.message}`],
    };
  }

  const nextStats = buildProjection(currentStats, input, result, effectiveAt);
  const { error: statsUpdateError } = await writeClient
    .from("users")
    .update({ stats_json: nextStats })
    .eq("id", userId);
  if (statsUpdateError) {
    await cleanupInitializedCycleState(writeClient, profileId, planId, previousActivePlanId);
    return {
      status: "error",
      errors: [`Failed to update user cycle projection: ${statsUpdateError.message}`],
    };
  }

  return {
    status: "success",
    planId: String(planId),
    resolvedClassArchetype,
    primaryProgramId: result.primaryProgramId,
    totalSessions: sessions.length,
  };
}
