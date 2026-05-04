import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ClassPresetIdSchema,
  CanonicalClassArchetypeSchema,
  ProgramDayRowSchema,
  ProgramSlotRowSchema,
} from "@adaptabuddy/contracts";
import {
  ProgramCatalogItemSchema,
  ProgramListItemSchema,
  type ProgramCatalogItem,
  type ProgramListItem,
  type ActiveProgram,
  type ActiveCycleView,
} from "./contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProgramCatalogSource = ProgramListItem & {
  metadata?: unknown;
};

const readCanonicalClassArchetype = (value: unknown) => {
  const parsed = CanonicalClassArchetypeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const readClassPresetId = (value: unknown) => {
  const parsed = ClassPresetIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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

const isCompleteAdaptiveTemplate = (
  kind: "slot_based" | "challenge_progression" | "hypertrophy_engine_v1",
  template: Record<string, unknown>,
) => {
  if (kind === "challenge_progression") {
    const exercise = readRecord(template.exercise);
    return (
      typeof exercise.slug === "string" &&
      exercise.slug.length > 0 &&
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

const adaptiveSummary = (
  kind: "challenge_progression" | "hypertrophy_engine_v1",
  template: Record<string, unknown>,
) => {
  if (kind === "hypertrophy_engine_v1") {
    return "Adaptive hypertrophy engine template";
  }

  const exercise = readRecord(template.exercise);
  const name =
    typeof exercise.canonical_name === "string" &&
    exercise.canonical_name.length > 0
      ? exercise.canonical_name
      : typeof exercise.slug === "string"
        ? exercise.slug
        : "challenge exercise";
  return `Adaptive challenge progression for ${name}`;
};

const challengeExerciseDetails = (template: Record<string, unknown>) => {
  const exercise = readRecord(template.exercise);
  const slug =
    typeof exercise.slug === "string" && exercise.slug.length > 0
      ? exercise.slug
      : undefined;
  if (!slug) {
    return {};
  }

  const label =
    typeof exercise.canonical_name === "string" &&
    exercise.canonical_name.length > 0
      ? exercise.canonical_name
      : slug;

  return {
    challengeExerciseSlug: slug,
    challengeExerciseLabel: label,
  };
};

const programRequiresStrengthBaselines = (
  program: ProgramListItem,
  adaptiveSummaryText?: string,
  challengeExerciseSlug?: string,
) => {
  const text = [
    program.slug,
    program.name,
    adaptiveSummaryText,
    challengeExerciseSlug,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return ["powerlifting", "bench", "squat", "deadlift", "overhead press"].some(
    (needle) => text.includes(needle),
  );
};

const adaptiveMuscleCoverage = (
  kind: "challenge_progression" | "hypertrophy_engine_v1",
  template: Record<string, unknown>,
) => {
  if (kind === "challenge_progression") {
    const exercise = readRecord(template.exercise);
    const slug =
      typeof exercise.slug === "string" ? exercise.slug : "challenge";
    return [{ muscle: slug, score: 1 }];
  }

  const totals: Record<string, number> = {};
  for (const session of Array.isArray(template.sessions)
    ? template.sessions
    : []) {
    const slots = readRecord(session).slots;
    for (const slot of Array.isArray(slots) ? slots : []) {
      const targets = readRecord(slot).target_muscles;
      for (const muscle of Array.isArray(targets) ? targets : []) {
        if (typeof muscle === "string" && muscle.length > 0) {
          totals[muscle] = (totals[muscle] ?? 0) + 1;
        }
      }
    }
  }

  return Object.entries(totals)
    .map(([muscle, score]) => ({ muscle, score }))
    .sort((left, right) => right.score - left.score);
};

/**
 * Fetches all active programs from the database
 */
export async function getAvailablePrograms(
  supabase: SupabaseClient,
): Promise<{ programs: ProgramListItem[]; error?: string }> {
  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, slug, name, description, default_days_per_week, min_days_per_week, max_days_per_week, is_active",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { programs: [], error: error.message };
  }

  // Validate each program against the schema
  const validatedPrograms: ProgramListItem[] = [];
  for (const program of data ?? []) {
    const result = ProgramListItemSchema.safeParse(program);
    if (result.success) {
      validatedPrograms.push(result.data);
    }
  }

  return { programs: validatedPrograms };
}

const normalizeSlotRow = (row: Record<string, unknown>) => ({
  ...row,
  equipment_allowed: (row.equipment_allowed as string[] | null) ?? [],
  tags_required: (row.tags_required as string[] | null) ?? [],
  tags_blocked: (row.tags_blocked as string[] | null) ?? [],
  muscle_targets: (row.muscle_targets as Record<string, number> | null) ?? {},
  prescription: (row.prescription as Record<string, unknown> | null) ?? {},
});

const normalizeDayRow = (row: Record<string, unknown>) => ({
  ...row,
  theme_tags: (row.theme_tags as string[] | null) ?? [],
});

/**
 * Fetches active programs with day/slot details and muscle coverage summaries.
 */
export async function getProgramCatalog(
  supabase: SupabaseClient,
): Promise<{ programs: ProgramCatalogItem[]; error?: string }> {
  const { data: programsData, error: programError } = await supabase
    .from("programs")
    .select(
      "id, slug, name, description, default_days_per_week, min_days_per_week, max_days_per_week, is_active, metadata",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (programError) {
    return { programs: [], error: programError.message };
  }

  const programs: ProgramCatalogSource[] = [];
  for (const program of programsData ?? []) {
    const record = program as Record<string, unknown>;
    const { metadata: _metadata, ...safeProgram } = record;
    const result = ProgramListItemSchema.safeParse(safeProgram);
    if (result.success) {
      programs.push({ ...result.data, metadata: record.metadata });
    }
  }

  if (programs.length === 0) {
    return { programs: [] };
  }

  const programIds = programs.map((program) => program.id);

  const { data: daysData, error: daysError } = await supabase
    .from("program_days")
    .select("id, program_id, day_index, name, theme_tags")
    .in("program_id", programIds)
    .order("day_index", { ascending: true });

  if (daysError) {
    return { programs: [], error: daysError.message };
  }

  const validatedDays = (daysData ?? []).flatMap((day) => {
    const result = ProgramDayRowSchema.safeParse(
      normalizeDayRow(day as Record<string, unknown>),
    );
    return result.success ? [result.data] : [];
  });

  const dayIds = validatedDays.map((day) => day.id);

  let validatedSlots: Array<{
    id: number;
    program_day_id: number;
    slot_index: number;
    slot_type: "main" | "accessory" | "conditioning" | "warmup" | "cooldown";
    movement_pattern?: string | null;
    sets_min: number;
    sets_max: number;
    reps_min: number;
    reps_max: number;
    muscle_targets: Record<string, number>;
  }> = [];

  if (dayIds.length > 0) {
    const { data: slotsData, error: slotsError } = await supabase
      .from("program_slots")
      .select(
        "id, program_day_id, slot_index, slot_type, lock_type, locked_exercise_id, movement_pattern, equipment_allowed, tags_required, tags_blocked, sets_min, sets_max, reps_min, reps_max, rir_min, rir_max, muscle_targets, prescription, is_optional",
      )
      .in("program_day_id", dayIds)
      .order("slot_index", { ascending: true });

    if (slotsError) {
      return { programs: [], error: slotsError.message };
    }

    validatedSlots = (slotsData ?? []).flatMap((slot) => {
      const result = ProgramSlotRowSchema.safeParse(
        normalizeSlotRow(slot as Record<string, unknown>),
      );
      if (!result.success) {
        return [];
      }
      return [
        {
          id: result.data.id,
          program_day_id: result.data.program_day_id,
          slot_index: result.data.slot_index,
          slot_type: result.data.slot_type,
          movement_pattern: result.data.movement_pattern,
          sets_min: result.data.sets_min,
          sets_max: result.data.sets_max,
          reps_min: result.data.reps_min,
          reps_max: result.data.reps_max,
          muscle_targets: result.data.muscle_targets,
        },
      ];
    });
  }

  const daysByProgram = new Map<number, ProgramCatalogItem["days"]>();
  const slotsByDay = new Map<
    number,
    Array<{
      id: number;
      slotIndex: number;
      slotType: "main" | "accessory" | "conditioning" | "warmup" | "cooldown";
      movementPattern?: string | null;
      setsMin: number;
      setsMax: number;
      repsMin: number;
      repsMax: number;
      muscleTargets: Record<string, number>;
    }>
  >();

  for (const slot of validatedSlots) {
    const existing = slotsByDay.get(slot.program_day_id) ?? [];
    existing.push({
      id: slot.id,
      slotIndex: slot.slot_index,
      slotType: slot.slot_type,
      movementPattern: slot.movement_pattern ?? null,
      setsMin: slot.sets_min,
      setsMax: slot.sets_max,
      repsMin: slot.reps_min,
      repsMax: slot.reps_max,
      muscleTargets: slot.muscle_targets,
    });
    slotsByDay.set(slot.program_day_id, existing);
  }

  for (const day of validatedDays) {
    const programDays = daysByProgram.get(day.program_id) ?? [];
    programDays.push({
      id: day.id,
      dayIndex: day.day_index,
      name: day.name,
      slots: (slotsByDay.get(day.id) ?? []).sort(
        (a, b) => a.slotIndex - b.slotIndex,
      ),
    });
    daysByProgram.set(day.program_id, programDays);
  }

  const catalog = programs.flatMap((program) => {
    const days = (daysByProgram.get(program.id) ?? []).sort(
      (a, b) => a.dayIndex - b.dayIndex,
    );
    const templateKind = adaptiveTemplateKind(program.metadata);
    const template = sourceTemplate(program.metadata);
    if (templateKind !== "slot_based") {
      if (!isCompleteAdaptiveTemplate(templateKind, template)) {
        return [];
      }

      const summary = adaptiveSummary(templateKind, template);
      const challengeDetails: {
        challengeExerciseSlug?: string;
        challengeExerciseLabel?: string;
      } =
        templateKind === "challenge_progression"
          ? challengeExerciseDetails(template)
          : {};
      const result = ProgramCatalogItemSchema.safeParse({
        ...program,
        metadata: undefined,
        days: [],
        muscleCoverage: adaptiveMuscleCoverage(templateKind, template),
        templateKind,
        adaptiveSummary: summary,
        ...challengeDetails,
        requiresStrengthBaselines: programRequiresStrengthBaselines(
          program,
          summary,
          challengeDetails.challengeExerciseSlug,
        ),
      });

      return result.success ? [result.data] : [];
    }

    if (days.length === 0 || days.some((day) => day.slots.length === 0)) {
      return [];
    }

    const muscleTotals: Record<string, number> = {};
    for (const day of days) {
      for (const slot of day.slots) {
        for (const [muscle, value] of Object.entries(slot.muscleTargets)) {
          muscleTotals[muscle] = (muscleTotals[muscle] ?? 0) + value;
        }
      }
    }

    const muscleCoverage = Object.entries(muscleTotals)
      .map(([muscle, score]) => ({
        muscle,
        score: Number(score.toFixed(2)),
      }))
      .sort((a, b) => b.score - a.score);

    const result = ProgramCatalogItemSchema.safeParse({
      ...program,
      metadata: undefined,
      days,
      muscleCoverage,
      templateKind,
      requiresStrengthBaselines:
        programRequiresStrengthBaselines(program) ||
        days
          .flatMap((day) => day.slots)
          .some((slot) =>
            ["squat", "deadlift", "bench_press", "overhead_press"].includes(
              slot.movementPattern ?? "",
            ),
          ),
    });

    return result.success ? [result.data] : [];
  });

  return { programs: catalog };
}

/**
 * Gets the user's current active program from stats_json
 */
export async function getUserActiveCycleView(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ activeCycleView: ActiveCycleView | null; error?: string }> {
  const { data: planRow, error: planError } = await supabase
    .from("engine_cycle_plans")
    .select(
      "id, profile_id, primary_program_id, class_preset_id, resolved_class_archetype, current_session_index, created_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    return { activeCycleView: null, error: planError.message };
  }

  if (planRow) {
    const { data: profileRow, error: profileError } = await supabase
      .from("engine_cycle_profiles")
      .select("id, available_days_per_week")
      .eq("id", planRow.profile_id)
      .maybeSingle();

    if (profileError) {
      return { activeCycleView: null, error: profileError.message };
    }

    const { data: sessionRow, error: sessionError } = await supabase
      .from("engine_cycle_sessions")
      .select(
        "program_day_id, program_day_name, planned_day_of_week, microcycle_index",
      )
      .eq("plan_id", planRow.id)
      .eq("session_index", planRow.current_session_index)
      .maybeSingle();

    if (sessionError) {
      return { activeCycleView: null, error: sessionError.message };
    }

    return {
      activeCycleView: {
        source: "normalized",
        status: sessionRow ? "active" : "completed",
        programId: String(planRow.primary_program_id),
        startedAt: String(planRow.created_at),
        daysPerWeek: Number(profileRow?.available_days_per_week ?? 0),
        currentDayIndex:
          typeof sessionRow?.planned_day_of_week === "number"
            ? sessionRow.planned_day_of_week
            : null,
        currentMicrocycle:
          typeof sessionRow?.microcycle_index === "number"
            ? sessionRow.microcycle_index + 1
            : null,
        programDayId:
          sessionRow?.program_day_id === undefined ||
          sessionRow?.program_day_id === null
            ? null
            : String(sessionRow.program_day_id),
        programDayName:
          typeof sessionRow?.program_day_name === "string"
            ? sessionRow.program_day_name
            : null,
        classPresetId: readClassPresetId(planRow.class_preset_id),
        resolvedClassArchetype: readCanonicalClassArchetype(
          planRow.resolved_class_archetype,
        ),
      },
    };
  }

  const { data, error } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", userId)
    .single();

  if (error) {
    return { activeCycleView: null, error: error.message };
  }

  const statsJson = data?.stats_json as Record<string, unknown> | null;
  const activeProgram = statsJson?.activeProgram as ActiveProgram | null;

  if (!activeProgram) {
    return { activeCycleView: null };
  }

  const legacyProgramId = Number(activeProgram.programId);
  let legacyProgramDayId: string | null = null;
  let legacyProgramDayName: string | null = null;

  if (Number.isFinite(legacyProgramId)) {
    const { data: programDayRow, error: programDayError } = await supabase
      .from("program_days")
      .select("id, name")
      .eq("program_id", legacyProgramId)
      .eq("day_index", activeProgram.currentDayIndex)
      .maybeSingle();

    if (programDayError) {
      return { activeCycleView: null, error: programDayError.message };
    }

    if (programDayRow) {
      legacyProgramDayId = String(programDayRow.id);
      legacyProgramDayName =
        typeof programDayRow.name === "string" ? programDayRow.name : null;
    }
  }

  return {
    activeCycleView: {
      source: "legacy",
      status: "active",
      programId: String(activeProgram.programId),
      startedAt: activeProgram.startedAt,
      daysPerWeek: activeProgram.daysPerWeek,
      currentDayIndex: activeProgram.currentDayIndex,
      currentMicrocycle: activeProgram.currentMicrocycle,
      programDayId: legacyProgramDayId,
      programDayName: legacyProgramDayName,
      classPresetId: null,
      resolvedClassArchetype: null,
    },
  };
}

export async function getUserActiveProgram(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ activeProgram: ActiveProgram | null; error?: string }> {
  const { data, error } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", userId)
    .single();

  if (error) {
    return { activeProgram: null, error: error.message };
  }

  const statsJson = data?.stats_json as Record<string, unknown> | null;
  const activeProgram = statsJson?.activeProgram as ActiveProgram | null;

  return { activeProgram: activeProgram ?? null };
}

/**
 * Gets a program by ID
 */
export async function getProgramById(
  supabase: SupabaseClient,
  programId: number,
): Promise<{ program: ProgramListItem | null; error?: string }> {
  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, slug, name, description, default_days_per_week, min_days_per_week, max_days_per_week, is_active",
    )
    .eq("id", programId)
    .single();

  if (error) {
    return { program: null, error: error.message };
  }

  const result = ProgramListItemSchema.safeParse(data);
  if (!result.success) {
    return { program: null, error: "Invalid program data" };
  }

  return { program: result.data };
}

/**
 * Updates the user's active program in stats_json
 */
export async function updateUserActiveProgram(
  supabase: SupabaseClient,
  userId: string,
  activeProgram: ActiveProgram,
): Promise<{ success: boolean; error?: string }> {
  // First get current stats_json to merge
  const { data: userData, error: fetchError } = await supabase
    .from("users")
    .select("stats_json")
    .eq("id", userId)
    .single();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const currentStats = (userData?.stats_json as Record<string, unknown>) ?? {};
  const updatedStats = {
    ...currentStats,
    activeProgram,
  };

  const writeClient = createSupabaseAdminClient() ?? supabase;
  const { error: updateError } = await writeClient
    .from("users")
    .update({ stats_json: updatedStats })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
