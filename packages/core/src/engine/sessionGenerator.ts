import type { GeneratedSession, SlotContext, FilledSlot } from "@adaptabuddy/contracts";
import type { ExerciseData, MuscleMapping, ProgramDay } from "../domain/exerciseTypes";
import { createRng, deriveSeed } from "./rng";
import { fillSlot } from "./slotFiller";

export interface SessionGeneratorInput {
  programDay: ProgramDay;
  exercises: ExerciseData[];
  muscleMappings: MuscleMapping[];
  fatigue: Record<string, number>;
  equipment: string[];
  injuries: string[];
  fatigueLevel: "light" | "moderate" | "hard" | "brutal";
  seed?: string;
  excludeExerciseIds?: string[];
}

export interface SessionGeneratorConfig {
  fatigueCostPerSet: Record<string, number>; // role -> cost multiplier
}

const DEFAULT_CONFIG: SessionGeneratorConfig = {
  fatigueCostPerSet: {
    primary: 5,
    secondary: 2.5,
    stabilizer: 1,
  },
};

/**
 * Calculate projected fatigue cost from filled slots.
 * Takes into account the muscle mappings and fatigue level.
 */
const calculateFatigueCost = (
  slots: FilledSlot[],
  muscleMappings: MuscleMapping[],
  fatigueLevel: "light" | "moderate" | "hard" | "brutal",
  config: SessionGeneratorConfig
): Record<string, number> => {
  const levelMultipliers = {
    light: 0.7,
    moderate: 1.0,
    hard: 1.3,
    brutal: 1.6,
  };

  const multiplier = levelMultipliers[fatigueLevel];
  const cost: Record<string, number> = {};

  for (const slot of slots) {
    const avgSets = (slot.setsMin + slot.setsMax) / 2;
    const exerciseMappings = muscleMappings.filter((m) => m.exerciseId === slot.exerciseId);

    for (const mapping of exerciseMappings) {
      const baseCost = config.fatigueCostPerSet[mapping.role] ?? 2;
      const slotCost = baseCost * avgSets * mapping.contribution * multiplier;
      cost[mapping.muscleGroupSlug] = (cost[mapping.muscleGroupSlug] ?? 0) + slotCost;
    }
  }

  // Cap at 100
  for (const muscle of Object.keys(cost)) {
    cost[muscle] = Math.min(cost[muscle], 100);
  }

  return cost;
};

/**
 * Generate a complete workout session.
 *
 * - Derives seed, creates RNG
 * - Sorts slots by slot_index
 * - Fills each slot sequentially, adding to exclude list
 * - Calculates projected fatigue cost
 * - Returns complete session with seed
 */
export const generateSession = (
  input: SessionGeneratorInput,
  config: SessionGeneratorConfig = DEFAULT_CONFIG
): GeneratedSession => {
  // Create or derive seed
  const seed = input.seed ?? `${input.programDay.id}-${Date.now()}`;
  const numericSeed = deriveSeed(seed);
  const rng = createRng(numericSeed);

  // Sort slots by index
  const sortedSlots = [...input.programDay.slots].sort((a, b) => a.slotIndex - b.slotIndex);

  // Track excluded exercises (no repeats in session)
  const excludeExerciseIds = Array.from(new Set(input.excludeExerciseIds ?? []));

  // Build base context
  const baseContext: SlotContext = {
    equipment: input.equipment,
    injuries: input.injuries,
    fatigue: { ...input.fatigue },
    excludeExerciseIds,
    fatigueLevel: input.fatigueLevel,
  };

  // Fill slots sequentially
  const filledSlots: FilledSlot[] = [];
  for (const slot of sortedSlots) {
    const context: SlotContext = {
      ...baseContext,
      excludeExerciseIds: [...excludeExerciseIds],
    };

    const filled = fillSlot({
      slot,
      exercises: input.exercises,
      muscleMappings: input.muscleMappings,
      context,
      rng,
    });

    if (filled) {
      filledSlots.push(filled);
      excludeExerciseIds.push(filled.exerciseId);
    }
  }

  // Calculate projected fatigue cost
  const projectedFatigueCost = calculateFatigueCost(
    filledSlots,
    input.muscleMappings,
    input.fatigueLevel,
    config
  );

  return {
    programDayId: input.programDay.id,
    programDayName: input.programDay.name,
    seed,
    generatedAt: new Date().toISOString(),
    slots: filledSlots,
    projectedFatigueCost,
  };
};
