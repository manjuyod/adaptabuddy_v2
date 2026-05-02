import type {
  ExerciseData,
  MuscleMapping,
  ProgramDay,
  ProgramSlot,
} from "@adaptabuddy/core";
import type {
  ProgramTemplate,
  TemplateDay,
  TemplateSlot,
  UserStats,
} from "@adaptabuddy/contracts";
import { DEFAULT_OPT_INS } from "@adaptabuddy/contracts";

// -----------------------------------------------------------------------------
// Default User Stats
// -----------------------------------------------------------------------------

export function getDefaultUserStats(): UserStats {
  return {
    activeProgram: null,
    fatigue: {},
    mastery: {},
    capacities: {},
    progression: {
      totalWorkouts: 0,
      weeklyVolume: 0,
      lastWorkoutAt: null,
    },
    preferences: {
      fatigueLevel: "moderate",
      equipment: [],
      injuries: [],
      acknowledgedRisks: [],
      optIns: { ...DEFAULT_OPT_INS },
      unitSystem: "kg",
      theme: "dark",
    },
  };
}

export function buildFatigueState(
  userStats: UserStats
): Record<string, number> {
  const fatigueState: Record<string, number> = {};
  for (const [muscle, data] of Object.entries(userStats.fatigue)) {
    fatigueState[muscle] = data.current;
  }
  return fatigueState;
}

// -----------------------------------------------------------------------------
// Session Generation Transformers
// -----------------------------------------------------------------------------

export interface ExerciseRow {
  id: string | number;
  slug: string;
  name: string;
  movement_pattern: string | null;
  equipment: string[] | null;
  tags: string[] | null;
  contraindications: string[] | null;
  is_bodyweight: boolean | null;
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flat(Infinity)
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function toExerciseData(row: ExerciseRow): ExerciseData {
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    movementPattern: row.movement_pattern ?? "",
    equipment: normalizeStringList(row.equipment),
    tags: normalizeStringList(row.tags),
    contraindications: normalizeStringList(row.contraindications),
    isBodyweight: row.is_bodyweight ?? false,
  };
}

export interface MuscleMappingRow {
  exercise_id: string | number;
  muscle_group_slug: string;
  role: "primary" | "secondary" | "stabilizer";
  contribution: number;
}

export function toMuscleMapping(row: MuscleMappingRow): MuscleMapping {
  return {
    exerciseId: String(row.exercise_id),
    muscleGroupSlug: row.muscle_group_slug,
    role: row.role,
    contribution: row.contribution,
  };
}

export interface SessionProgramSlotRow {
  id: string | number;
  program_day_id: string | number;
  slot_index: number;
  slot_type: string | null;
  lock_type: string | null;
  locked_exercise_id: string | number | null;
  muscle_targets: Record<string, number> | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rest_seconds?: number | null;
  tags?: string[] | null;
  tags_required?: string[] | null;
}

const normalizeLockType = (value: string | null): ProgramSlot["lockType"] => {
  if (value === "hard" || value === "locked") {
    return "hard";
  }
  if (value === "soft" || value === "user_choice") {
    return "soft";
  }
  if (value === "none" || value === "flex") {
    return "none";
  }
  return "none";
};

export function toProgramSlot(row: SessionProgramSlotRow): ProgramSlot {
  return {
    id: String(row.id),
    programDayId: String(row.program_day_id),
    slotIndex: row.slot_index,
    slotType: row.slot_type ?? "accessory",
    lockType: normalizeLockType(row.lock_type),
    lockedExerciseId:
      row.locked_exercise_id === null ? null : String(row.locked_exercise_id),
    muscleTargets: row.muscle_targets ?? {},
    setsMin: row.sets_min,
    setsMax: row.sets_max,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    restSeconds: row.rest_seconds ?? 90,
    tags: row.tags ?? row.tags_required ?? [],
  };
}

export interface SessionProgramDayRow {
  id: string | number;
  program_id: string | number;
  name: string;
  day_index: number;
}

export function toProgramDay(
  dayRow: SessionProgramDayRow,
  slotRows: SessionProgramSlotRow[]
): ProgramDay {
  const dayId = String(dayRow.id);
  const slots = slotRows
    .filter((slot) => String(slot.program_day_id) === dayId)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(toProgramSlot);

  return {
    id: dayId,
    programId: String(dayRow.program_id),
    name: dayRow.name,
    dayIndex: dayRow.day_index,
    slots,
  };
}

// -----------------------------------------------------------------------------
// Template Resolution Transformers
// -----------------------------------------------------------------------------

export interface TemplateProgramRow {
  id: string | number;
  name: string;
  days_per_week: number;
  volume_distribution: Record<string, number> | null;
}

export interface TemplateProgramDayRow {
  id: string | number;
  program_id: string | number;
  day_index: number;
  name: string;
  intensity_target: "low" | "moderate" | "high" | null;
  volume_multiplier: number | null;
}

export interface TemplateProgramSlotRow {
  id: string | number;
  program_day_id: string | number;
  slot_index: number;
  slot_type:
    | "main"
    | "accessory"
    | "conditioning"
    | "warmup"
    | "cooldown"
    | null;
  muscle_targets: Record<string, number> | null;
  sets_min: number;
  sets_max: number;
  reps_min: number;
  reps_max: number;
  rir_min: number | null;
  rir_max: number | null;
  tags: string[] | null;
  movement_pattern: string | null;
}

export function toTemplateSlot(row: TemplateProgramSlotRow): TemplateSlot {
  return {
    slotType: row.slot_type ?? "accessory",
    movementPattern: row.movement_pattern ?? undefined,
    muscleTargets: row.muscle_targets ?? {},
    setsMin: row.sets_min,
    setsMax: row.sets_max,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    rirMin: row.rir_min,
    rirMax: row.rir_max,
    tags: row.tags ?? [],
  };
}

export function toTemplateDay(
  dayRow: TemplateProgramDayRow,
  slotRows: TemplateProgramSlotRow[]
): TemplateDay {
  const dayId = String(dayRow.id);
  const daySlots = slotRows
    .filter((slot) => String(slot.program_day_id) === dayId)
    .sort((a, b) => a.slot_index - b.slot_index)
    .map(toTemplateSlot);

  return {
    dayIndex: dayRow.day_index,
    name: dayRow.name,
    intensityTarget: dayRow.intensity_target ?? "moderate",
    volumeMultiplier: dayRow.volume_multiplier ?? 1,
    slots: daySlots,
  };
}

export function toProgramTemplate(
  programRow: TemplateProgramRow,
  dayRows: TemplateProgramDayRow[],
  slotRows: TemplateProgramSlotRow[]
): ProgramTemplate {
  const sortedDays = [...dayRows].sort((a, b) => a.day_index - b.day_index);

  const weekPattern = sortedDays.map((day) => toTemplateDay(day, slotRows));

  return {
    templateId: String(programRow.id),
    name: programRow.name,
    daysPerWeek: programRow.days_per_week,
    weekPattern,
    volumeDistribution: programRow.volume_distribution ?? {},
  };
}
