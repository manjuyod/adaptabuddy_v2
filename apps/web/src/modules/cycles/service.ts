import type {
  ClassPresetId,
  CanonicalClassArchetype,
  AdvanceCycleRequest,
  AdvanceCycleResponse,
  InitializeCycleRequest,
  InitializeCycleResponse,
  NormalizedGamificationState,
  UserStats,
} from "@adaptabuddy/contracts";
import {
  AdvanceCycleResponseSchema,
  CanonicalClassArchetypeSchema,
  ClassPresetIdSchema,
  InitializeCycleRequestSchema,
  SelectableClassPresetIdSchema,
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
  metadata?: Record<string, unknown> | null;
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
  locked_exercise_id?: number | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  muscle_targets?: Record<string, number> | null;
  tags_required?: string[] | null;
  prescription?: Record<string, unknown> | null;
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

type EngineCyclePlanRow = {
  id: number;
  user_id: string;
  profile_id: number;
  primary_program_id?: number | null;
  resolved_class_archetype?: string | null;
  total_weeks?: number | null;
  total_sessions?: number | null;
  current_session_index?: number | null;
  current_microcycle_index?: number | null;
  current_mesocycle_index?: number | null;
  is_active?: boolean | null;
};

type EngineCycleProfileRow = {
  id: number;
  user_id: string;
  class_preset_id?: string | null;
  class_choice?: string | null;
  goal_bias?: string | null;
  available_days_per_week?: number | null;
  fatigue_preference?: "low" | "moderate" | "high" | null;
  injury_muscle_group_slugs?: string[] | null;
  macrocycle_weeks?: number | null;
};

type EngineCycleProgramMixRow = {
  program_id?: number | null;
  selection_weight?: number | string | null;
  role?: string | null;
};

type EngineCycleSessionRow = {
  id: number;
  user_id: string;
  plan_id: number;
  session_index: number;
  completed_at?: string | null;
  program_id?: number | null;
  program_day_id?: number | null;
  program_day_name?: string | null;
};

type EngineAdvanceCycleOutput = {
  result?: Record<string, unknown> | null;
  statePatch?: Record<string, unknown> | null;
  decisionLog?: unknown[] | null;
  replayReceipt?: Record<string, unknown> | null;
};

const DEFAULT_CLASS_ROWS: ClassRow[] = [
  {
    id: "classless",
    is_selectable: true,
    status: "active",
    base_archetype: "hybrid",
  },
  { id: "bb", is_selectable: true, status: "active", base_archetype: "hybrid" },
  {
    id: "powa",
    is_selectable: true,
    status: "active",
    base_archetype: "strength",
  },
  {
    id: "ninja",
    is_selectable: true,
    status: "active",
    base_archetype: "hybrid",
  },
  {
    id: "monk",
    is_selectable: false,
    status: "planned",
    base_archetype: "hybrid",
  },
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
      lastAdherenceOutcomeClassification?:
        | "complete_clean"
        | "complete_compromised"
        | "partial"
        | "missed";
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
  value: unknown,
): CanonicalClassArchetype | null => {
  const parsed = CanonicalClassArchetypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseClassPresetId = (value: unknown): ClassPresetId | null => {
  const parsed = ClassPresetIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const parseSelectableClassPresetId = (
  value: unknown,
): InitializeCycleRequest["classPresetId"] | null => {
  const parsed = SelectableClassPresetIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const defaultNormalizedGamificationState = (
  effectiveAt: string,
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
  effectiveAt: string,
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
      row.completed_session_count ?? fallback.completedSessionCount,
    ),
    missedSessionCount: Number(
      row.missed_session_count ?? fallback.missedSessionCount,
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

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const adaptiveTemplateKind = (
  metadata: unknown,
): "slot_based" | "challenge_progression" | "hypertrophy_engine_v1" => {
  const record = readRecord(metadata);
  const family = record.adaptive_template_family;
  if (
    family === "challenge_progression" ||
    family === "hypertrophy_engine_v1"
  ) {
    return family;
  }

  const template = readRecord(record.source_template_json);
  if (template.challenge || template.initial_test_groups) {
    return "challenge_progression";
  }
  if (Array.isArray(template.sessions) && template.sessions.length > 0) {
    return "hypertrophy_engine_v1";
  }

  return "slot_based";
};

const sourceTemplate = (metadata: unknown): Record<string, unknown> =>
  readRecord(readRecord(metadata).source_template_json);

const requiredChallengeSlug = (
  template: Record<string, unknown>,
): string | null => {
  const exercise = readRecord(template.exercise);
  return typeof exercise.slug === "string" && exercise.slug.length > 0
    ? exercise.slug
    : null;
};

const hasCompleteAdaptiveTemplate = (
  kind: "slot_based" | "challenge_progression" | "hypertrophy_engine_v1",
  template: Record<string, unknown>,
) => {
  if (kind === "challenge_progression") {
    return (
      requiredChallengeSlug(template) !== null &&
      Array.isArray(template.initial_test_groups) &&
      template.initial_test_groups.length > 0 &&
      typeof template.groups === "object" &&
      template.groups !== null
    );
  }

  if (kind === "hypertrophy_engine_v1") {
    return (
      Array.isArray(template.sessions) &&
      template.sessions.length === 3 &&
      template.sessions.every((session) => {
        const record = readRecord(session);
        return (
          typeof record.session_key === "string" &&
          record.session_key.length > 0 &&
          Array.isArray(record.slots) &&
          record.slots.length > 0
        );
      })
    );
  }

  return false;
};

const toProgramSelectionPayload = (
  selectedPrograms: InitializeCycleRequest["selectedPrograms"],
  programRows: ProgramRow[],
  dayRows: ProgramDayRow[],
  slotRows: ProgramSlotRow[],
): CycleProgramSelectionPayload[] => {
  return selectedPrograms.map((selection) => {
    const programId = Number(selection.programId);
    const programRow = programRows.find((row) => row.id === programId);
    const templateKind = adaptiveTemplateKind(programRow?.metadata);
    const adaptiveTemplate = sourceTemplate(programRow?.metadata);
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
            lockedExerciseId:
              slot.locked_exercise_id === null ||
              slot.locked_exercise_id === undefined
                ? null
                : String(slot.locked_exercise_id),
            setsMin: slot.sets_min,
            setsMax: slot.sets_max,
            repsMin: slot.reps_min,
            repsMax: slot.reps_max,
            muscleTargets: slot.muscle_targets ?? {},
            tagsRequired: slot.tags_required ?? [],
            prescription: slot.prescription ?? {},
          })),
      }));

    return {
      programId: String(selection.programId),
      weight: selection.weight,
      templateKind,
      ...(templateKind !== "slot_based" ? { adaptiveTemplate } : {}),
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
    .filter(
      (entry): entry is string => typeof entry === "string" && entry.length > 0,
    );
};

const normalizeUniqueStringList = (value: string[]): string[] =>
  Array.from(new Set(value)).sort((left, right) => left.localeCompare(right));

const toInitializeSystemicFatigue = (
  value: InitializeCycleRequest["fatiguePreference"],
): "mild" | "moderate" | "severe" => {
  if (value === "low") return "mild";
  if (value === "high") return "severe";
  return "moderate";
};

const normalizeNumericRecord = (
  value: unknown,
): Record<string, number> | null => {
  const record = readRecord(value);
  const normalized = Object.entries(record).flatMap(([key, rawValue]) => {
    if (!key) return [];
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return [[key, Math.round(rawValue)] as const];
    }

    const nested = readRecord(rawValue);
    const nestedValue = nested.current ?? nested.value ?? nested.score;
    if (typeof nestedValue === "number" && Number.isFinite(nestedValue)) {
      return [[key, Math.round(nestedValue)] as const];
    }

    return [];
  });

  if (normalized.length === 0) {
    return null;
  }

  return Object.fromEntries(
    normalized.sort(([left], [right]) => left.localeCompare(right)),
  );
};

const toInitializeMuscleFatigue = (
  currentStats: UserStats,
  injuryMuscleGroupSlugs: string[],
): Record<string, number> => {
  const fromStats = normalizeNumericRecord(currentStats.fatigue) ?? {};
  const entries = new Map(Object.entries(fromStats));
  for (const slug of normalizeUniqueStringList(injuryMuscleGroupSlugs)) {
    if (!entries.has(slug)) {
      entries.set(slug, 100);
    }
  }

  return Object.fromEntries(
    Array.from(entries.entries()).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
};

const normalizeStrengthBaselines = (
  value: unknown,
): Record<
  string,
  { estimatedOneRepMax: number; unit: string; source?: string }
> | undefined => {
  const baselines = readRecord(value);
  const entries = Object.entries(baselines).flatMap(([exerciseSlug, raw]) => {
    if (!exerciseSlug) return [];
    const rawBaseline = readRecord(raw);
    const estimatedOneRepMax = rawBaseline.estimatedOneRepMax;
    const unit = rawBaseline.unit;
    const source = rawBaseline.source;
    if (
      typeof estimatedOneRepMax !== "number" ||
      !Number.isFinite(estimatedOneRepMax) ||
      estimatedOneRepMax <= 0 ||
      (unit !== "kg" && unit !== "lbs") ||
      (source !== undefined &&
        (typeof source !== "string" || source.trim().length === 0))
    ) {
      return [];
    }

    return [
      [
        exerciseSlug,
        {
          estimatedOneRepMax,
          unit,
          ...(typeof source === "string" ? { source: source.trim() } : {}),
        },
      ] as const,
    ];
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(
    entries.sort(([left], [right]) => left.localeCompare(right)),
  );
};

const strengthBaselineKeys = [
  "squat",
  "deadlift",
  "bench_press",
  "overhead_press",
] as const;

const hasRequiredStrengthBaselines = (
  value: InitializeCycleRequest["programAdaptationInputs"] | undefined,
) => {
  const baselines = normalizeStrengthBaselines(
    readRecord(value).strengthBaselines,
  );
  if (!baselines) {
    return false;
  }

  return strengthBaselineKeys.every((key) => baselines[key] !== undefined);
};

const normalizeProgramAdaptationInputs = (
  value: unknown,
) => {
  const record = readRecord(value);
  const challengeBaselines = readRecord(record.challengeBaselines);
  const strengthBaselines = normalizeStrengthBaselines(
    record.strengthBaselines,
  );
  const hasChallengeBaselines = Object.keys(challengeBaselines).length > 0;

  if (!hasChallengeBaselines && strengthBaselines === undefined) {
    return undefined;
  }

  return {
    challengeBaselines,
    ...(strengthBaselines !== undefined ? { strengthBaselines } : {}),
  };
};

const selectedProgramRequiresStrengthBaselines = (
  selection: InitializeCycleRequest["selectedPrograms"][number],
  programRows: ProgramRow[],
  dayRows: ProgramDayRow[],
  slotRows: ProgramSlotRow[],
) => {
  const programId = Number(selection.programId);
  const program = programRows.find((row) => row.id === programId);
  const template = sourceTemplate(program?.metadata);
  const challengeSlug = requiredChallengeSlug(template);
  const text = [program?.slug, program?.name, challengeSlug]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (
    ["powerlifting", "bench", "squat", "deadlift", "overhead press"].some(
      (needle) => text.includes(needle),
    )
  ) {
    return true;
  }

  const selectedDayIds = new Set(
    dayRows
      .filter((day) => day.program_id === programId)
      .map((day) => day.id),
  );

  return slotRows.some((slot) => {
    if (!selectedDayIds.has(slot.program_day_id)) {
      return false;
    }
    return strengthBaselineKeys.includes(
      slot.movement_pattern as (typeof strengthBaselineKeys)[number],
    );
  });
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
    return {
      ok: false as const,
      error: "Selected class preset is not available",
    };
  }

  const parsedId = parseClassPresetId(row.id);
  const baseArchetype = parseCanonicalClassArchetype(row.base_archetype);
  if (!parsedId || !baseArchetype) {
    return {
      ok: false as const,
      error: "Selected class preset is not available",
    };
  }

  if (row.is_selectable === false || row.status !== "active") {
    return {
      ok: false as const,
      error: "Selected class preset is not available",
    };
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
  adaptationInputs: InitializeCycleRequest["programAdaptationInputs"],
  programRows: ProgramRow[],
  dayRows: ProgramDayRow[],
  slotRows: ProgramSlotRow[],
) => {
  const programIds = new Set(programRows.map((program) => program.id));

  return selectedPrograms.flatMap((selection) => {
    const programId = Number(selection.programId);

    if (!programIds.has(programId)) {
      return [`program ${selection.programId} template is missing`];
    }

    const program = programRows.find((row) => row.id === programId);
    const kind = adaptiveTemplateKind(program?.metadata);
    if (kind !== "slot_based") {
      const template = sourceTemplate(program?.metadata);
      if (!hasCompleteAdaptiveTemplate(kind, template)) {
        return [
          `program ${selection.programId} adaptive template metadata is incomplete`,
        ];
      }
      if (kind === "challenge_progression") {
        const slug = requiredChallengeSlug(template);
        if (
          !slug ||
          adaptationInputs?.challengeBaselines?.[slug]?.maxReps === undefined
        ) {
          return [
            `program ${selection.programId} requires challenge baseline for ${slug ?? "selected exercise"}`,
          ];
        }
      }
      return [];
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

      return [
        `program ${selection.programId} day ${day.id} has no program slots`,
      ];
    });
  });
};

const buildProjection = (
  currentStats: UserStats,
  input: InitializeCycleRequest,
  result: NonNullable<EngineInitializeResponse["result"]>,
  effectiveAt: string,
): UserStats => {
  const activeSession =
    result.macrocycle?.sessions?.find(
      (session) =>
        session.sessionIndex === (result.macrocycle?.currentSessionIndex ?? 0),
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

const readOptionalNumericId = (value: unknown): number | null => {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
};

const cleanupInitializedCycleState = async (
  client: SupabaseClient,
  profileId: number,
  planId: number | null,
  previousActivePlanId: number | null,
) => {
  if (planId !== null) {
    await client
      .from("engine_gamification_states")
      .delete()
      .eq("plan_id", planId);
    await client.from("engine_cycle_sessions").delete().eq("plan_id", planId);
    await client.from("engine_cycle_plans").delete().eq("id", planId);
  }

  await client
    .from("engine_cycle_program_mix")
    .delete()
    .eq("profile_id", profileId);
  await client.from("engine_cycle_profiles").delete().eq("id", profileId);

  if (previousActivePlanId !== null) {
    await client
      .from("engine_cycle_plans")
      .update({ is_active: true })
      .eq("id", previousActivePlanId);
  }
};

export async function handleInitializeCycle(
  userId: string,
  input: InitializeCycleRequest,
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
  ] = await Promise.all([
    supabase.from("users").select("stats_json").eq("id", userId).single(),
    supabase
      .from("classes")
      .select("id, is_selectable, status, base_archetype"),
    supabase
      .from("programs")
      .select("id, slug, name, is_active, metadata")
      .in(
        "id",
        input.selectedPrograms.map((program) => Number(program.programId)),
      ),
    supabase
      .from("program_days")
      .select("id, program_id, day_index, name")
      .in(
        "program_id",
        input.selectedPrograms.map((program) => Number(program.programId)),
      ),
    supabase
      .from("program_slots")
      .select(
        "id, program_day_id, slot_index, slot_type, locked_exercise_id, movement_pattern, sets_min, sets_max, reps_min, reps_max, muscle_targets, tags_required, prescription",
      ),
    supabase
      .from("exercises")
      .select(
        "id, slug, name, movement_pattern, equipment, tags, is_bodyweight",
      ),
    supabase.from("muscle_groups").select("id, slug, name"),
    supabase
      .from("engine_cycle_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
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

  if (
    programError ||
    dayError ||
    slotError ||
    !programRows ||
    !dayRows ||
    !slotRows
  ) {
    return {
      status: "error",
      errors: ["Failed to load program templates for cycle initialization"],
    };
  }

  if (exerciseError || !exerciseRows) {
    return {
      status: "error",
      errors: [
        "Failed to load exercise reference data for cycle initialization",
      ],
    };
  }

  const activeProgramIds = new Set(
    ((programRows ?? []) as ProgramRow[])
      .filter((program) => program.is_active === true)
      .map((program) => program.id),
  );
  const unavailableProgram = input.selectedPrograms.find(
    (selection) => !activeProgramIds.has(Number(selection.programId)),
  );
  if (unavailableProgram) {
    return {
      status: "error",
      errors: ["Selected program is unavailable"],
    };
  }

  const templateIntegrityErrors = findProgramTemplateIntegrityErrors(
    input.selectedPrograms,
    input.programAdaptationInputs,
    programRows as ProgramRow[],
    dayRows as ProgramDayRow[],
    slotRows as ProgramSlotRow[],
  );
  if (templateIntegrityErrors.length > 0) {
    return {
      status: "error",
      errors: [
        `Selected program templates are incomplete: ${templateIntegrityErrors.join("; ")}`,
      ],
    };
  }

  const requiresStrengthBaselines = input.selectedPrograms.some((selection) =>
    selectedProgramRequiresStrengthBaselines(
      selection,
      programRows as ProgramRow[],
      dayRows as ProgramDayRow[],
      slotRows as ProgramSlotRow[],
    ),
  );
  if (
    requiresStrengthBaselines &&
    !hasRequiredStrengthBaselines(input.programAdaptationInputs)
  ) {
    return {
      status: "error",
      errors: [
        "Strength baselines are required for selected strength programs",
      ],
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
      errors: [
        `Failed to load current active cycle plan: ${previousActivePlanError.message}`,
      ],
    };
  }

  const validInjuries = new Set(
    ((muscleRows ?? []) as Array<{ slug?: string | null }>)
      .map((row) => row.slug)
      .filter(
        (slug): slug is string => typeof slug === "string" && slug.length > 0,
      ),
  );
  const invalidInjury = input.injuryMuscleGroupSlugs.find(
    (slug) => !validInjuries.has(slug),
  );
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
    input.classPresetId,
  );
  if (!presetResolution.ok) {
    return {
      status: "error",
      errors: [presetResolution.error],
    };
  }
  const resolvedPreset = presetResolution.preset;
  const exerciseReferences = (exerciseRows as ExerciseRow[]).map(
    toExerciseReference,
  );
  const shapedProgramSelection = shapeSelectedProgramsForPreset({
    preset: resolvedPreset,
    selectedPrograms: toProgramSelectionPayload(
      input.selectedPrograms,
      programRows as ProgramRow[],
      dayRows as ProgramDayRow[],
      slotRows as ProgramSlotRow[],
    ),
    exercises: exerciseReferences,
  });
  if (!shapedProgramSelection.ok) {
    return {
      status: "error",
      errors: [shapedProgramSelection.error],
    };
  }

  const currentStats =
    (userRow?.stats_json as UserStats | null) ?? getDefaultUserStats();
  const previousActivePlanId = readInsertedId(previousActivePlanData);
  let currentGamificationState =
    defaultNormalizedGamificationState(effectiveAt);

  if (previousActivePlanId !== null) {
    const { data: currentGamificationRow, error: currentGamificationError } =
      await supabase
        .from("engine_gamification_states")
        .select(
          "xp, level, adherence_streak, completed_session_count, missed_session_count, last_adherence_outcome_classification, last_awarded_at",
        )
        .eq("plan_id", previousActivePlanId)
        .maybeSingle();

    if (currentGamificationError) {
      return {
        status: "error",
        errors: [
          `Failed to load current cycle gamification state: ${currentGamificationError.message}`,
        ],
      };
    }

    if (!currentGamificationRow) {
      return {
        status: "error",
        errors: [
          "Failed to load current cycle gamification state: missing active gamification row",
        ],
      };
    }

    currentGamificationState = toNormalizedGamificationState(
      currentGamificationRow as EngineGamificationStateRow,
      effectiveAt,
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
      errors: [
        error instanceof Error
          ? error.message
          : "Failed to compute reference hash",
      ],
    };
  }

  const activeLimitations = normalizeUniqueStringList(
    input.injuryMuscleGroupSlugs,
  );
  const programAdaptationInputs = normalizeProgramAdaptationInputs(
    input.programAdaptationInputs,
  );
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
        systemicFatigue: toInitializeSystemicFatigue(input.fatiguePreference),
        muscleFatigue: toInitializeMuscleFatigue(
          currentStats,
          activeLimitations,
        ),
      },
      injuryState: {
        activeLimitations,
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
      ...(programAdaptationInputs
        ? { programAdaptationInputs }
        : {}),
    },
    metadata: {
      correlationId: `cycle-init-${userId}`,
    },
  };

  let engineOutput: EngineInitializeResponse;
  try {
    engineOutput = (await runEngineInput(
      engineInput,
    )) as EngineInitializeResponse;
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
    result?.resolvedClassArchetype,
  );
  const sessions = macrocycle?.sessions;

  if (
    !result ||
    !macrocycle ||
    !sessions ||
    !result.primaryProgramId ||
    !resolvedClassArchetype
  ) {
    return {
      status: "error",
      errors: ["Engine did not return an initialize_cycle result"],
    };
  }

  if (
    sessions.some(
      (session) => session.classArchetype !== resolvedClassArchetype,
    )
  ) {
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
    const { error: programMixError } = await writeClient
      .from("engine_cycle_program_mix")
      .insert(
        result.programBlend.map((entry) => ({
          user_id: userId,
          profile_id: profileId,
          program_id: Number(entry.programId),
          selection_weight: entry.weight,
          role: entry.role,
        })),
      );
    if (programMixError) {
      await cleanupInitializedCycleState(writeClient, profileId, null, null);
      return {
        status: "error",
        errors: [
          `Failed to persist cycle program mix: ${programMixError.message}`,
        ],
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
        errors: [
          `Failed to deactivate existing cycle plan: ${deactivateActivePlanError.message}`,
        ],
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
    await cleanupInitializedCycleState(
      writeClient,
      profileId,
      null,
      previousActivePlanId,
    );
    return {
      status: "error",
      errors: [`Failed to persist cycle plan: ${planError.message}`],
    };
  }
  const planId = readInsertedId(planData);
  if (planId === null) {
    await cleanupInitializedCycleState(
      writeClient,
      profileId,
      null,
      previousActivePlanId,
    );
    return {
      status: "error",
      errors: ["Cycle plan insert did not return an id"],
    };
  }

  const { error: sessionInsertError } = await writeClient
    .from("engine_cycle_sessions")
    .insert(
      sessions.map((session) => ({
        user_id: userId,
        plan_id: planId,
        session_index: session.sessionIndex,
        program_id: Number(session.programId),
        program_day_id: readOptionalNumericId(session.programDayId),
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
      })),
    );
  if (sessionInsertError) {
    await cleanupInitializedCycleState(
      writeClient,
      profileId,
      planId,
      previousActivePlanId,
    );
    return {
      status: "error",
      errors: [
        `Failed to persist cycle sessions: ${sessionInsertError.message}`,
      ],
    };
  }

  const { error: gamificationInsertError } = await writeClient
    .from("engine_gamification_states")
    .insert({
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
        result.initialGamificationState?.lastAdherenceOutcomeClassification ??
        null,
      last_awarded_at: result.initialGamificationState?.lastAwardedAt ?? null,
      class_archetype: resolvedClassArchetype,
    });
  if (gamificationInsertError) {
    await cleanupInitializedCycleState(
      writeClient,
      profileId,
      planId,
      previousActivePlanId,
    );
    return {
      status: "error",
      errors: [
        `Failed to persist cycle gamification state: ${gamificationInsertError.message}`,
      ],
    };
  }

  const nextStats = buildProjection(currentStats, input, result, effectiveAt);
  const { error: statsUpdateError } = await writeClient
    .from("users")
    .update({ stats_json: nextStats })
    .eq("id", userId);
  if (statsUpdateError) {
    await cleanupInitializedCycleState(
      writeClient,
      profileId,
      planId,
      previousActivePlanId,
    );
    return {
      status: "error",
      errors: [
        `Failed to update user cycle projection: ${statsUpdateError.message}`,
      ],
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

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toSelectedPrograms = (
  rows: EngineCycleProgramMixRow[],
): InitializeCycleRequest["selectedPrograms"] => {
  const selected = rows
    .map((row) => ({
      programId: Number(row.program_id),
      weight: asNumber(row.selection_weight, 0),
    }))
    .filter(
      (row) =>
        Number.isInteger(row.programId) && row.programId > 0 && row.weight > 0,
    );
  const total = selected.reduce((sum, row) => sum + row.weight, 0);
  if (total <= 0) {
    return [];
  }
  return selected.map((row) => ({
    programId: row.programId,
    weight: row.weight / total,
  }));
};

const toInitializeCycleRequestFromRows = (
  profile: EngineCycleProfileRow,
  programMix: EngineCycleProgramMixRow[],
): InitializeCycleRequest | null => {
  const classPresetId = parseSelectableClassPresetId(
    profile.class_preset_id ?? profile.class_choice ?? "classless",
  );
  const selectedPrograms = toSelectedPrograms(programMix);
  if (!classPresetId || selectedPrograms.length === 0) {
    return null;
  }

  return {
    classPresetId,
    goalBias:
      (profile.goal_bias as InitializeCycleRequest["goalBias"]) ?? "balanced",
    availableDaysPerWeek: Number(profile.available_days_per_week ?? 3),
    fatiguePreference: profile.fatigue_preference ?? "moderate",
    injuryMuscleGroupSlugs: profile.injury_muscle_group_slugs ?? [],
    macrocycleWeeks: Number(profile.macrocycle_weeks ?? 8),
    selectedPrograms,
  };
};

const toEngineCurrentCycleRequest = (
  currentRequest: InitializeCycleRequest,
  selectedPrograms: CycleProgramSelectionPayload[],
  resolvedClassArchetype: CanonicalClassArchetype,
  adaptationInputs: ReturnType<typeof normalizeProgramAdaptationInputs>,
) => ({
  profile: {
    classChoice: resolvedClassArchetype,
    goalBias: currentRequest.goalBias,
    availableDaysPerWeek: currentRequest.availableDaysPerWeek,
    fatiguePreference: currentRequest.fatiguePreference,
    injuryMuscleGroupSlugs: currentRequest.injuryMuscleGroupSlugs,
  },
  macrocycleWeeks: currentRequest.macrocycleWeeks,
  selectedPrograms,
  ...(adaptationInputs ? { programAdaptationInputs: adaptationInputs } : {}),
});

const deriveProgressionTrend = (
  rows: Array<Record<string, unknown>>,
): string => {
  const trends = rows
    .map((row) => row.trend)
    .filter((value): value is string => typeof value === "string");
  if (trends.includes("blocked")) return "blocked";
  if (trends.includes("regressing")) return "regressing";
  if (trends.includes("improving")) return "improving";
  return "stalled";
};

const deriveRecoveryStatus = (
  gamification: EngineGamificationStateRow | null,
): string => {
  const missed = Number(gamification?.missed_session_count ?? 0);
  if (missed >= 4) return "overreached";
  if (missed >= 2) return "strained";
  return "recoverable";
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const scoreFromSignal = (value: unknown, fallback: number): number => {
  const parsed = asNumber(value, fallback / 100);
  return Math.round(parsed <= 1 ? parsed * 100 : parsed);
};

const normalizeAdvanceCycleResult = (
  rawResult: Record<string, unknown>,
  context: {
    planId: string;
    seasonIndex: number;
    completedSessions: number;
    missedSessions: number;
    totalSessions: number;
    completionRate: number;
    progressionTrend: "improving" | "stalled" | "regressing" | "blocked";
    recoveryStatus:
      | "recoverable"
      | "strained"
      | "overreached"
      | "injury_constrained";
    currentRequest: InitializeCycleRequest;
    replayReceipt: Record<string, unknown>;
  },
) => {
  const rawBreakdown = (rawResult.rankBreakdown ?? {}) as Record<
    string,
    unknown
  >;
  const seasonRank =
    asString(rawResult.seasonRank) ?? asString(rawResult.rankTier) ?? "B";
  const finalScore = scoreFromSignal(
    rawBreakdown.score ?? rawBreakdown.finalScore,
    65,
  );
  const rankBreakdown = {
    adherenceScore: scoreFromSignal(
      rawBreakdown.adherence ?? rawBreakdown.adherenceScore,
      65,
    ),
    qualityScore: scoreFromSignal(
      rawBreakdown.completionQuality ?? rawBreakdown.qualityScore,
      65,
    ),
    progressionScore: scoreFromSignal(
      rawBreakdown.progression ?? rawBreakdown.progressionScore,
      65,
    ),
    recoveryScore: scoreFromSignal(
      rawBreakdown.recovery ?? rawBreakdown.recoveryScore,
      65,
    ),
    consistencyScore: scoreFromSignal(
      rawBreakdown.consistency ?? rawBreakdown.consistencyScore,
      65,
    ),
    constraintModifier: asNumber(rawBreakdown.constraintModifier, 0),
    finalScore,
    rank: seasonRank,
  };

  const rawAwards = Array.isArray(rawResult.awards) ? rawResult.awards : [];
  const awards = rawAwards.flatMap((award) => {
    if (!award || typeof award !== "object") return [];
    const row = award as Record<string, unknown>;
    const id = asString(row.id) ?? asString(row.awardId);
    const label = asString(row.label);
    if (!id || !label) return [];
    return [
      {
        id,
        label,
        reason: asString(row.reason) ?? label,
        xp: Math.max(0, Math.round(asNumber(row.xp, 0))),
      },
    ];
  });

  const rawSummary =
    rawResult.seasonSummary && typeof rawResult.seasonSummary === "object"
      ? (rawResult.seasonSummary as Record<string, unknown>)
      : {};
  const seasonSummary = {
    planId: asString(rawSummary.planId) ?? context.planId,
    seasonIndex: Math.max(
      1,
      Math.round(asNumber(rawSummary.seasonIndex, context.seasonIndex)),
    ),
    completedSessions: Math.max(
      0,
      Math.round(
        asNumber(rawSummary.completedSessions, context.completedSessions),
      ),
    ),
    missedSessions: Math.max(
      0,
      Math.round(asNumber(rawSummary.missedSessions, context.missedSessions)),
    ),
    totalSessions: Math.max(
      0,
      Math.round(asNumber(rawSummary.totalSessions, context.totalSessions)),
    ),
    completionRate: Math.min(
      1,
      Math.max(0, asNumber(rawSummary.completionRate, context.completionRate)),
    ),
    progressionTrend: context.progressionTrend,
    recoveryStatus: context.recoveryStatus,
  };

  const parsedNextCycleRequest = InitializeCycleRequestSchema.safeParse(
    rawResult.nextCycleRequest,
  );
  const nextCycleRequest = parsedNextCycleRequest.success
    ? parsedNextCycleRequest.data
    : context.currentRequest;

  const rawPreview =
    rawResult.nextCyclePreview && typeof rawResult.nextCyclePreview === "object"
      ? (rawResult.nextCyclePreview as Record<string, unknown>)
      : {};
  const nextCyclePreview = {
    rankEffect:
      asString(rawPreview.rankEffect) ??
      (seasonRank === "S" || seasonRank === "A"
        ? "increase_difficulty"
        : seasonRank === "D"
          ? "deload"
          : "maintain_direction"),
    programBlendDirection:
      asString(rawPreview.programBlendDirection) ??
      asString(rawPreview.recommendedClassChoice) ??
      nextCycleRequest.goalBias,
    difficultyAdjustment: Math.max(
      -3,
      Math.min(
        3,
        Math.round(
          asNumber(rawPreview.difficultyAdjustment, seasonRank === "S" ? 1 : 0),
        ),
      ),
    ),
    recoveryAdjustment: Math.max(
      -3,
      Math.min(
        3,
        Math.round(
          asNumber(rawPreview.recoveryAdjustment, seasonRank === "D" ? 1 : 0),
        ),
      ),
    ),
    unlockEligibility: Array.isArray(rawPreview.unlockEligibility)
      ? rawPreview.unlockEligibility.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    constraintNotes: Array.isArray(rawPreview.constraintNotes)
      ? rawPreview.constraintNotes.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };

  return {
    status: "success" as const,
    planId: context.planId,
    seasonIndex: Math.max(
      1,
      Math.round(asNumber(rawResult.seasonIndex, context.seasonIndex)),
    ),
    seasonRank,
    rankBreakdown,
    awardedXp: Math.max(
      0,
      Math.round(
        asNumber(
          rawResult.awardedXp,
          awards.reduce((sum, award) => sum + award.xp, 0),
        ),
      ),
    ),
    awards,
    seasonSummary,
    nextCycleRequest,
    nextCyclePreview,
    transitionId: "1",
    replayReceipt: context.replayReceipt,
  };
};

export async function handleAdvanceCycle(
  userId: string,
  input: AdvanceCycleRequest,
  options?: {
    requestId?: string;
    route?: string;
  },
): Promise<AdvanceCycleResponse> {
  const effectiveAt = new Date().toISOString();
  const supabase = await createSupabaseServerActionClient();
  const writeClient = createSupabaseAdminClient();

  if (!writeClient) {
    return {
      status: "error",
      errors: ["Season persistence requires a server write client"],
    };
  }

  try {
    let existingTransition: Record<string, unknown> | null = null;
    if (input.idempotencyKey) {
      const { data: existingTransitionRow, error: existingTransitionError } =
        await supabase
          .from("engine_cycle_transitions")
          .select(
            "id, plan_id, season_index, season_rank, awarded_xp, next_cycle_request, next_cycle_preview, replay_receipt",
          )
          .eq("user_id", userId)
          .eq("idempotency_key", input.idempotencyKey)
          .maybeSingle();
      if (existingTransitionError) {
        return {
          status: "error",
          errors: ["Failed to load existing season transition"],
        };
      }
      existingTransition =
        (existingTransitionRow as Record<string, unknown> | null) ?? null;
    }

    if (existingTransition) {
      return {
        status: "error",
        errors: ["Season transition already exists for this idempotency key"],
      };
    }

    let planQuery = supabase
      .from("engine_cycle_plans")
      .select(
        "id, user_id, profile_id, primary_program_id, resolved_class_archetype, total_weeks, total_sessions, current_session_index, current_microcycle_index, current_mesocycle_index, is_active",
      )
      .eq("user_id", userId);
    planQuery = input.planId
      ? planQuery.eq("id", Number(input.planId))
      : planQuery.eq("is_active", true);

    const { data: planRow, error: planError } = await planQuery.maybeSingle();
    if (planError) {
      return {
        status: "error",
        errors: ["Failed to load active cycle plan"],
      };
    }
    const plan = planRow as EngineCyclePlanRow | null;
    if (!plan) {
      return {
        status: "error",
        errors: ["Active cycle plan not found"],
      };
    }

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("engine_cycle_sessions")
      .select(
        "id, user_id, plan_id, session_index, completed_at, program_id, program_day_id, program_day_name",
      )
      .eq("plan_id", plan.id)
      .order("session_index", { ascending: true });
    if (sessionsError) {
      return {
        status: "error",
        errors: ["Failed to load active cycle sessions"],
      };
    }

    const sessions = ((sessionRows ?? []) as EngineCycleSessionRow[]).filter(
      (session) => session.user_id === userId,
    );
    const totalSessions = Number(plan.total_sessions ?? sessions.length);
    const completedSessions = sessions.filter(
      (session) => session.completed_at,
    ).length;
    const missedSessions = Math.max(0, totalSessions - completedSessions);
    if (totalSessions <= 0 || completedSessions < totalSessions) {
      return {
        status: "error",
        errors: ["Active cycle is not complete"],
      };
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("engine_cycle_profiles")
      .select(
        "id, user_id, class_preset_id, class_choice, goal_bias, available_days_per_week, fatigue_preference, injury_muscle_group_slugs, macrocycle_weeks",
      )
      .eq("id", plan.profile_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError || !profileRow) {
      return {
        status: "error",
        errors: ["Failed to load cycle profile"],
      };
    }

    const { data: programMixRows, error: programMixError } = await supabase
      .from("engine_cycle_program_mix")
      .select("program_id, selection_weight, role")
      .eq("profile_id", plan.profile_id);
    if (programMixError) {
      return {
        status: "error",
        errors: ["Failed to load cycle program mix"],
      };
    }

    const currentRequest = toInitializeCycleRequestFromRows(
      profileRow as EngineCycleProfileRow,
      (programMixRows ?? []) as EngineCycleProgramMixRow[],
    );
    if (!currentRequest) {
      return {
        status: "error",
        errors: ["Failed to build next-cycle baseline request"],
      };
    }
    const resolvedClassArchetype =
      parseCanonicalClassArchetype(plan.resolved_class_archetype) ?? "hybrid";
    const selectedProgramIds = currentRequest.selectedPrograms.map((program) =>
      Number(program.programId),
    );

    const [
      { data: programRows, error: programRowsError },
      { data: dayRows, error: dayRowsError },
      { data: slotRows, error: slotRowsError },
    ] = await Promise.all([
      supabase
        .from("programs")
        .select("id, slug, name, is_active, metadata")
        .in("id", selectedProgramIds),
      supabase
        .from("program_days")
        .select("id, program_id, day_index, name")
        .in("program_id", selectedProgramIds),
      supabase
        .from("program_slots")
        .select(
          "id, program_day_id, slot_index, slot_type, locked_exercise_id, movement_pattern, sets_min, sets_max, reps_min, reps_max, muscle_targets, tags_required, prescription",
        ),
    ]);
    if (programRowsError || dayRowsError || slotRowsError) {
      return {
        status: "error",
        errors: ["Failed to load current cycle program templates"],
      };
    }
    const currentProgramSelectionPayload = toProgramSelectionPayload(
      currentRequest.selectedPrograms,
      (programRows ?? []) as ProgramRow[],
      (dayRows ?? []) as ProgramDayRow[],
      (slotRows ?? []) as ProgramSlotRow[],
    );
    const currentProgramAdaptationInputs = normalizeProgramAdaptationInputs(
      input.programAdaptationInputs ?? currentRequest.programAdaptationInputs,
    );
    const currentCycleRequest = toEngineCurrentCycleRequest(
      currentRequest,
      currentProgramSelectionPayload,
      resolvedClassArchetype,
      currentProgramAdaptationInputs,
    );

    const { data: gamificationRow } = await supabase
      .from("engine_gamification_states")
      .select(
        "id, user_id, plan_id, xp, level, adherence_streak, completed_session_count, missed_session_count, last_adherence_outcome_classification, last_awarded_at, class_archetype",
      )
      .eq("plan_id", plan.id)
      .maybeSingle();

    const { data: progressionRows } = await supabase
      .from("engine_progression_states")
      .select("exercise_id, current_action, trend")
      .eq("plan_id", plan.id);

    const seasonIndex = Math.max(1, Number(plan.id));
    const completionRate =
      totalSessions > 0 ? completedSessions / totalSessions : 0;
    const progressionTrend = deriveProgressionTrend(
      (progressionRows ?? []) as Array<Record<string, unknown>>,
    );
    const recoveryStatus = deriveRecoveryStatus(
      gamificationRow as EngineGamificationStateRow | null,
    );

    const referenceSnapshot = {
      referenceVersion: "2026-03",
      operation: "advance_cycle",
      programs: ((programRows ?? []) as ProgramRow[])
        .slice()
        .sort((left, right) => left.id - right.id)
        .map((program) => ({
          id: String(program.id),
          slug: program.slug ?? String(program.id),
          name: program.name,
          daysPerWeek: currentRequest.availableDaysPerWeek,
        })),
    };
    const referenceHash =
      computeCanonicalReplayReferenceHash(referenceSnapshot);

    const engineOutput = (await runEngineInput({
      schemaVersion: "engine.v1",
      operation: "advance_cycle",
      determinism: {
        seed: `advance-${userId}-${plan.id}`,
        effectiveAt,
        ruleVersion: "rules-2026-03",
        referenceHash,
        canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      },
      referenceSnapshot,
      stateSnapshot: {
        plan,
        gamification: gamificationRow ?? null,
        progression: progressionRows ?? [],
      },
      policySnapshot: {
        rankThresholds: { S: 92, A: 80, B: 65, C: 50 },
      },
      request: {
        seasonIndex,
        completionRate,
        adherence: completionRate,
        completedSessionCount: completedSessions,
        missedSessionCount: missedSessions,
        currentCycleRequest,
        ...(currentProgramAdaptationInputs
          ? { programAdaptationInputs: currentProgramAdaptationInputs }
          : {}),
        completionQuality:
          completionRate >= 0.95 ? "complete_clean" : "complete_compromised",
        progression:
          progressionTrend === "improving"
            ? 0.85
            : progressionTrend === "stalled"
              ? 0.65
              : progressionTrend === "regressing"
                ? 0.35
                : 0.15,
        recovery:
          recoveryStatus === "recoverable"
            ? 0.85
            : recoveryStatus === "strained"
              ? 0.65
              : 0.35,
        consistency: completionRate,
        focus: currentRequest.goalBias,
      },
      metadata: {
        correlationId: `cycle-advance-${userId}`,
      },
    })) as EngineAdvanceCycleOutput;

    const result = engineOutput?.result;
    if (!result) {
      return {
        status: "error",
        errors: ["Engine did not return an advance_cycle result"],
      };
    }

    const responseCandidate = normalizeAdvanceCycleResult(result, {
      planId: String(plan.id),
      seasonIndex,
      completedSessions,
      missedSessions,
      totalSessions,
      completionRate,
      progressionTrend: progressionTrend as
        | "improving"
        | "stalled"
        | "regressing"
        | "blocked",
      recoveryStatus: recoveryStatus as
        | "recoverable"
        | "strained"
        | "overreached"
        | "injury_constrained",
      currentRequest,
      replayReceipt: engineOutput.replayReceipt ?? {},
    });

    const prePersistParsed =
      AdvanceCycleResponseSchema.safeParse(responseCandidate);
    if (
      !prePersistParsed.success ||
      prePersistParsed.data.status !== "success"
    ) {
      return {
        status: "error",
        errors: ["Engine did not return an advance_cycle result"],
      };
    }
    const parsedAdvance = prePersistParsed.data;

    const { data: summaryRow, error: summaryError } = await writeClient
      .from("engine_cycle_season_summaries")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        season_index: parsedAdvance.seasonIndex,
        season_rank: parsedAdvance.seasonRank,
        rank_breakdown: parsedAdvance.rankBreakdown,
        summary_payload: parsedAdvance.seasonSummary,
        completed_sessions: parsedAdvance.seasonSummary.completedSessions,
        missed_sessions: parsedAdvance.seasonSummary.missedSessions,
        total_sessions: parsedAdvance.seasonSummary.totalSessions,
        completion_rate: parsedAdvance.seasonSummary.completionRate,
      })
      .select("id")
      .single();
    if (summaryError || !summaryRow) {
      return {
        status: "error",
        errors: ["Failed to persist season summary"],
      };
    }

    if (parsedAdvance.awards.length > 0) {
      const { error: awardsError } = await writeClient
        .from("engine_cycle_season_awards")
        .insert(
          parsedAdvance.awards.map((award) => ({
            user_id: userId,
            plan_id: plan.id,
            season_summary_id: (summaryRow as { id: number }).id,
            award_id: award.id,
            label: award.label,
            reason: award.reason,
            xp: award.xp,
          })),
        );
      if (awardsError) {
        await writeClient
          .from("engine_cycle_season_summaries")
          .delete()
          .eq("id", (summaryRow as { id: number }).id)
          .eq("user_id", userId)
          .eq("plan_id", plan.id);
        return {
          status: "error",
          errors: ["Failed to persist season awards"],
        };
      }
    }

    const { data: transitionRow, error: transitionError } = await writeClient
      .from("engine_cycle_transitions")
      .insert({
        user_id: userId,
        plan_id: plan.id,
        season_summary_id: (summaryRow as { id: number }).id,
        season_index: parsedAdvance.seasonIndex,
        season_rank: parsedAdvance.seasonRank,
        awarded_xp: parsedAdvance.awardedXp,
        next_cycle_request: parsedAdvance.nextCycleRequest,
        next_cycle_preview: parsedAdvance.nextCyclePreview,
        replay_receipt: parsedAdvance.replayReceipt,
        decision_log: engineOutput.decisionLog ?? [],
        engine_result: result,
        state_patch: engineOutput.statePatch ?? {},
        status: "recommended",
        idempotency_key: input.idempotencyKey ?? null,
      })
      .select("id")
      .single();
    if (transitionError || !transitionRow) {
      await writeClient
        .from("engine_cycle_season_awards")
        .delete()
        .eq("season_summary_id", (summaryRow as { id: number }).id)
        .eq("user_id", userId)
        .eq("plan_id", plan.id);
      await writeClient
        .from("engine_cycle_season_summaries")
        .delete()
        .eq("id", (summaryRow as { id: number }).id)
        .eq("user_id", userId)
        .eq("plan_id", plan.id);
      return {
        status: "error",
        errors: ["Failed to persist season transition"],
      };
    }

    await writeClient.from("engine_session_traces").insert({
      user_id: userId,
      operation: "advance_cycle",
      cycle_plan_id: plan.id,
      cycle_session_id: null,
      workout_log_id: null,
      input_material: {
        schemaVersion: "engine.v1",
        operation: "advance_cycle",
        request: {
          planId: String(plan.id),
          seasonIndex,
          completedSessions,
          missedSessions,
          totalSessions,
          completionRate,
        },
      },
      decision_log: engineOutput.decisionLog ?? [],
      replay_receipt: parsedAdvance.replayReceipt,
      engine_result: result,
    });

    return AdvanceCycleResponseSchema.parse({
      ...parsedAdvance,
      transitionId: String((transitionRow as { id: number }).id),
    });
  } catch (error) {
    logServerEvent({
      route: options?.route ?? "/api/v0/cycles/advance",
      action: "handleAdvanceCycle",
      severity: "error",
      reason: "dependency_error",
      requestId: options?.requestId,
      userId,
      details: {
        planId: input.planId ?? null,
      },
      error,
    });

    return {
      status: "error",
      errors: ["Engine cycle advancement failed. Please try again."],
    };
  }
}
