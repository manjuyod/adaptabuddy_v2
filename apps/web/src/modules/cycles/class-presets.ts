import type {
  CanonicalClassArchetype,
  ClassPresetId,
} from "@adaptabuddy/contracts";

export type CycleClassPresetRecord = {
  id: ClassPresetId;
  isSelectable: boolean;
  status: string;
  baseArchetype: CanonicalClassArchetype;
};

export type CycleExerciseReference = {
  id: string;
  slug: string;
  name: string;
  movementPattern: string;
  equipment: string[];
  tags: string[];
  isBodyweight: boolean;
};

export type CycleProgramSlotPayload = {
  slotId: string;
  slotIndex: number;
  slotType: string;
  movementPattern: string | null;
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
  muscleTargets: Record<string, number>;
  tagsRequired: string[];
  lockedExerciseId?: string | null;
  prescription?: Record<string, unknown>;
};

export type CycleProgramDayPayload = {
  programDayId: string;
  dayIndex: number;
  name: string;
  slots: CycleProgramSlotPayload[];
};

export type CycleProgramSelectionPayload = {
  programId: string;
  weight: number;
  templateKind?:
    | "slot_based"
    | "challenge_progression"
    | "hypertrophy_engine_v1";
  adaptiveTemplate?: Record<string, unknown>;
  days: CycleProgramDayPayload[];
};

const dedupeTags = (tags: string[]) => Array.from(new Set(tags));

const cloneSlot = (slot: CycleProgramSlotPayload): CycleProgramSlotPayload => ({
  ...slot,
  muscleTargets: { ...slot.muscleTargets },
  tagsRequired: [...slot.tagsRequired],
  prescription: slot.prescription ? { ...slot.prescription } : undefined,
});

const cloneSelection = (
  selection: CycleProgramSelectionPayload,
): CycleProgramSelectionPayload => ({
  ...selection,
  adaptiveTemplate: selection.adaptiveTemplate
    ? { ...selection.adaptiveTemplate }
    : undefined,
  days: selection.days.map((day) => ({
    ...day,
    slots: day.slots.map(cloneSlot),
  })),
});

const matchesSlotTags = (
  slot: CycleProgramSlotPayload,
  exercise: CycleExerciseReference,
) => slot.tagsRequired.every((tag) => exercise.tags.includes(tag));

const matchesMovementPattern = (
  slot: CycleProgramSlotPayload,
  exercise: CycleExerciseReference,
) =>
  !slot.movementPattern ||
  !exercise.movementPattern ||
  slot.movementPattern === exercise.movementPattern;

const matchesNinjaSlot = (
  slot: CycleProgramSlotPayload,
  exercise: CycleExerciseReference,
) =>
  exercise.isBodyweight &&
  matchesMovementPattern(slot, exercise) &&
  matchesSlotTags(slot, exercise);

const shapeBbPayload = (
  payload: CycleProgramSelectionPayload[],
): CycleProgramSelectionPayload[] =>
  payload.map((selection) => ({
    ...cloneSelection(selection),
    days: selection.days.map((day) => {
      let mainSeen = false;
      return {
        ...day,
        slots: day.slots.filter((slot) => {
          if (slot.slotType !== "main") {
            return true;
          }
          if (mainSeen) {
            return false;
          }
          mainSeen = true;
          return true;
        }),
      };
    }),
  }));

const shapePowaPayload = (
  payload: CycleProgramSelectionPayload[],
): CycleProgramSelectionPayload[] =>
  payload.map((selection) => ({
    ...cloneSelection(selection),
    days: selection.days.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => {
        if (
          slot.slotType !== "main" ||
          !slot.tagsRequired.includes("compound")
        ) {
          return cloneSlot(slot);
        }

        const nextMin = Math.max(1, slot.repsMin - 2);
        const nextMax = Math.max(nextMin, slot.repsMax - 2);
        return {
          ...cloneSlot(slot),
          repsMin: nextMin,
          repsMax: nextMax,
        };
      }),
    })),
  }));

const shapeNinjaPayload = (
  payload: CycleProgramSelectionPayload[],
  exercises: CycleExerciseReference[],
):
  | { ok: true; payload: CycleProgramSelectionPayload[] }
  | { ok: false; error: string } => {
  const shapedSelections = payload.map((selection) => ({
    ...cloneSelection(selection),
    days: selection.days.map((day) => {
      const ninjaSlots = day.slots
        .map((slot) => ({
          ...cloneSlot(slot),
          tagsRequired: dedupeTags([...slot.tagsRequired, "bodyweight"]),
        }))
        .filter((slot) =>
          exercises.some((exercise) => matchesNinjaSlot(slot, exercise)),
        );

      return {
        ...day,
        slots: ninjaSlots,
      };
    }),
  }));

  const hasInvalidDay = shapedSelections.some((selection) =>
    selection.days.some((day) => day.slots.length === 0),
  );

  if (hasInvalidDay) {
    return {
      ok: false,
      error:
        "Selected program templates are incompatible with the ninja class preset",
    };
  }

  return {
    ok: true,
    payload: shapedSelections,
  };
};

export const shapeSelectedProgramsForPreset = ({
  preset,
  selectedPrograms,
  exercises,
}: {
  preset: CycleClassPresetRecord;
  selectedPrograms: CycleProgramSelectionPayload[];
  exercises: CycleExerciseReference[];
}):
  | { ok: true; payload: CycleProgramSelectionPayload[] }
  | { ok: false; error: string } => {
  switch (preset.id) {
    case "classless":
      return {
        ok: true,
        payload: selectedPrograms.map(cloneSelection),
      };
    case "bb":
      return {
        ok: true,
        payload: shapeBbPayload(selectedPrograms),
      };
    case "powa":
      return {
        ok: true,
        payload: shapePowaPayload(selectedPrograms),
      };
    case "ninja":
      return shapeNinjaPayload(selectedPrograms, exercises);
    case "monk":
      return {
        ok: false,
        error: "Selected class preset is not available",
      };
  }
};
