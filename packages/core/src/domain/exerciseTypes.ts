/**
 * Internal domain types for engine use.
 * These represent DB data transformed for engine consumption.
 */

export interface ExerciseData {
  id: string;
  slug: string;
  name: string;
  movementPattern: string;
  equipment: string[];
  tags: string[];
  contraindications: string[];
  isBodyweight: boolean;
}

export interface MuscleMapping {
  exerciseId: string;
  muscleGroupSlug: string;
  role: "primary" | "secondary" | "stabilizer";
  contribution: number; // 0-1
}

export interface ProgramSlot {
  id: string;
  programDayId: string;
  slotIndex: number;
  slotType: string;
  lockType: "none" | "soft" | "hard";
  lockedExerciseId: string | null;
  muscleTargets: Record<string, number>; // muscleSlug -> target weight (0-1)
  setsMin: number;
  setsMax: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  tags: string[];
}

export interface ProgramDay {
  id: string;
  programId: string;
  name: string;
  dayIndex: number;
  slots: ProgramSlot[];
}
