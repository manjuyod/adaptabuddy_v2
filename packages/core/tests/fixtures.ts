import type {
  ExerciseData,
  MuscleMapping,
  ProgramDay,
  ProgramSlot,
} from "../src/domain/exerciseTypes";
import type { SlotContext } from "@adaptabuddy/contracts";

export const ids = {
  exerciseA: "11111111-1111-1111-1111-111111111111",
  exerciseB: "22222222-2222-2222-2222-222222222222",
  exerciseC: "33333333-3333-3333-3333-333333333333",
  exerciseContra: "44444444-4444-4444-4444-444444444444",
  slotA: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  slotB: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  programDay: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  program: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
};

export const exercises: ExerciseData[] = [
  {
    id: ids.exerciseA,
    slug: "bench-press",
    name: "Bench Press",
    movementPattern: "push",
    equipment: ["barbell", "bench"],
    tags: ["compound"],
    contraindications: [],
    isBodyweight: false,
  },
  {
    id: ids.exerciseB,
    slug: "push-up",
    name: "Push Up",
    movementPattern: "push",
    equipment: [],
    tags: ["bodyweight"],
    contraindications: [],
    isBodyweight: true,
  },
  {
    id: ids.exerciseC,
    slug: "barbell-row",
    name: "Barbell Row",
    movementPattern: "pull",
    equipment: ["barbell"],
    tags: ["compound"],
    contraindications: [],
    isBodyweight: false,
  },
  {
    id: ids.exerciseContra,
    slug: "overhead-press",
    name: "Overhead Press",
    movementPattern: "push",
    equipment: ["barbell"],
    tags: ["compound"],
    contraindications: ["shoulder"],
    isBodyweight: false,
  },
];

export const muscleMappings: MuscleMapping[] = [
  {
    exerciseId: ids.exerciseA,
    muscleGroupSlug: "chest",
    role: "primary",
    contribution: 1,
  },
  {
    exerciseId: ids.exerciseB,
    muscleGroupSlug: "chest",
    role: "primary",
    contribution: 0.7,
  },
  {
    exerciseId: ids.exerciseB,
    muscleGroupSlug: "triceps",
    role: "secondary",
    contribution: 0.3,
  },
  {
    exerciseId: ids.exerciseC,
    muscleGroupSlug: "back",
    role: "primary",
    contribution: 1,
  },
  {
    exerciseId: ids.exerciseContra,
    muscleGroupSlug: "shoulders",
    role: "primary",
    contribution: 1,
  },
];

export const chestSlot: ProgramSlot = {
  id: ids.slotA,
  programDayId: ids.programDay,
  slotIndex: 1,
  slotType: "main",
  lockType: "none",
  lockedExerciseId: null,
  muscleTargets: { chest: 1 },
  setsMin: 3,
  setsMax: 4,
  repsMin: 6,
  repsMax: 8,
  restSeconds: 120,
  tags: ["compound"],
};

export const backSlot: ProgramSlot = {
  id: ids.slotB,
  programDayId: ids.programDay,
  slotIndex: 0,
  slotType: "main",
  lockType: "none",
  lockedExerciseId: null,
  muscleTargets: { back: 1 },
  setsMin: 3,
  setsMax: 4,
  repsMin: 6,
  repsMax: 8,
  restSeconds: 120,
  tags: [],
};

export const programDay: ProgramDay = {
  id: ids.programDay,
  programId: ids.program,
  name: "Day 1",
  dayIndex: 0,
  slots: [chestSlot, backSlot],
};

export const baseContext: SlotContext = {
  equipment: ["barbell", "bench"],
  injuries: [],
  fatigue: {
    chest: 20,
    triceps: 0,
    back: 10,
    shoulders: 0,
  },
  excludeExerciseIds: [],
  fatigueLevel: "moderate",
};
