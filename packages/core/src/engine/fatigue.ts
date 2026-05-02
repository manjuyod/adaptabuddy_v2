import type { MuscleFatigue } from "@adaptabuddy/contracts";
import type { MuscleMapping } from "../domain/exerciseTypes";

export type { MuscleMapping };

export interface FatigueState {
  [muscleSlug: string]: {
    current: number;
    lastUpdated: string;
  };
}

export interface FatigueConfig {
  halfLifeHours: number;
  maxFatigue: number;
}

const DEFAULT_CONFIG: FatigueConfig = {
  halfLifeHours: 48,
  maxFatigue: 100,
};

/**
 * Dissipate fatigue based on time elapsed using exponential decay
 *
 * Formula: f(t) = f0 * (0.5)^(t/halfLife)
 */
export function dissipateFatigue(
  state: FatigueState,
  timestamp: string,
  config: FatigueConfig = DEFAULT_CONFIG
): FatigueState {
  const now = new Date(timestamp).getTime();
  const result: FatigueState = {};

  for (const [muscle, fatigue] of Object.entries(state)) {
    const lastUpdated = new Date(fatigue.lastUpdated).getTime();
    const hoursElapsed = (now - lastUpdated) / (1000 * 60 * 60);

    // Exponential decay
    const decayFactor = Math.pow(0.5, hoursElapsed / config.halfLifeHours);
    const newFatigue = fatigue.current * decayFactor;

    result[muscle] = {
      current: Math.max(0, Math.round(newFatigue * 10) / 10),
      lastUpdated: timestamp,
    };
  }

  return result;
}

/**
 * Accumulate fatigue from workout costs
 *
 * Level multipliers: light=0.7, moderate=1.0, hard=1.3, brutal=1.6
 */
export function accumulateFatigue(
  state: FatigueState,
  costs: Record<string, number>,
  fatigueLevel: "light" | "moderate" | "hard" | "brutal",
  timestamp: string,
  config: FatigueConfig = DEFAULT_CONFIG
): FatigueState {
  const levelMultipliers = {
    light: 0.7,
    moderate: 1.0,
    hard: 1.3,
    brutal: 1.6,
  };

  const multiplier = levelMultipliers[fatigueLevel];
  const result: FatigueState = { ...state };

  for (const [muscle, cost] of Object.entries(costs)) {
    const current = result[muscle]?.current ?? 0;
    const newFatigue = Math.min(current + cost * multiplier, config.maxFatigue);

    result[muscle] = {
      current: Math.round(newFatigue * 10) / 10,
      lastUpdated: timestamp,
    };
  }

  return result;
}

export interface FatigueCostConfig {
  costPerSet: Record<string, number>;
}

const DEFAULT_COST_CONFIG: FatigueCostConfig = {
  costPerSet: {
    primary: 5,
    secondary: 2.5,
    stabilizer: 1,
  },
};

/**
 * Calculate fatigue cost from completed exercises
 */
export function calculateFatigueCost(
  exercises: Array<{
    exerciseId: string;
    sets: Array<{ weight: number; reps: number }>;
  }>,
  muscleMappings: MuscleMapping[],
  config: FatigueCostConfig = DEFAULT_COST_CONFIG
): Record<string, number> {
  const costs: Record<string, number> = {};

  for (const exercise of exercises) {
    const numSets = exercise.sets.length;
    const mappings = muscleMappings.filter(
      (m) => m.exerciseId === exercise.exerciseId
    );

    for (const mapping of mappings) {
      const baseCost = config.costPerSet[mapping.role] ?? 2;
      const cost = baseCost * numSets * mapping.contribution;
      costs[mapping.muscleGroupSlug] =
        (costs[mapping.muscleGroupSlug] ?? 0) + cost;
    }
  }

  return costs;
}

/**
 * Convert FatigueState to contract-compatible MuscleFatigue record
 */
export function toMuscleFatigueRecord(
  state: FatigueState
): Record<string, MuscleFatigue> {
  const result: Record<string, MuscleFatigue> = {};
  for (const [muscle, fatigue] of Object.entries(state)) {
    result[muscle] = {
      current: fatigue.current,
      lastUpdated: fatigue.lastUpdated,
    };
  }
  return result;
}
