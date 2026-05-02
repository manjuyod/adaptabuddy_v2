import type { TrainingAge, VolumeAllocation, VolumeRebalanceResult } from "@adaptabuddy/contracts";

export interface VolumeBudgetConfig {
  baseMEV: Record<string, number>;
  baseMRV: Record<string, number>;
  defaultMEV: number;
  defaultMRV: number;
  trainingAgeMultiplier: Record<TrainingAge, number>;
  fatiguePenaltyPer10: number;
  minFatigueMultiplier: number;
}

const DEFAULT_CONFIG: VolumeBudgetConfig = {
  baseMEV: {
    chest: 8,
    back: 10,
    shoulders: 6,
    biceps: 6,
    triceps: 6,
    quads: 8,
    hamstrings: 6,
    glutes: 6,
    calves: 6,
    abs: 6,
    forearms: 4,
  },
  baseMRV: {
    chest: 18,
    back: 22,
    shoulders: 16,
    biceps: 14,
    triceps: 14,
    quads: 20,
    hamstrings: 16,
    glutes: 16,
    calves: 16,
    abs: 16,
    forearms: 10,
  },
  defaultMEV: 6,
  defaultMRV: 16,
  trainingAgeMultiplier: {
    novice: 0.8,
    intermediate: 1,
    advanced: 1.2,
  },
  fatiguePenaltyPer10: 0.05,
  minFatigueMultiplier: 0.5,
};

const roundSets = (value: number) => Math.round(value * 10) / 10;

export function calculateMEV(
  muscleGroup: string,
  trainingAge: TrainingAge,
  config: VolumeBudgetConfig = DEFAULT_CONFIG
): number {
  const base = config.baseMEV[muscleGroup] ?? config.defaultMEV;
  const multiplier = config.trainingAgeMultiplier[trainingAge] ?? 1;
  return roundSets(base * multiplier);
}

export function calculateMRV(
  muscleGroup: string,
  fatigueState: Record<string, number>,
  trainingAge: TrainingAge,
  config: VolumeBudgetConfig = DEFAULT_CONFIG
): number {
  const base = config.baseMRV[muscleGroup] ?? config.defaultMRV;
  const ageMultiplier = config.trainingAgeMultiplier[trainingAge] ?? 1;
  const fatigue = fatigueState[muscleGroup] ?? 0;
  const penalty = (fatigue / 10) * config.fatiguePenaltyPer10;
  const fatigueMultiplier = Math.max(config.minFatigueMultiplier, 1 - penalty);
  return roundSets(base * ageMultiplier * fatigueMultiplier);
}

export interface VolumeBudgetInput {
  totalSets: number;
  musclePriorities: Record<string, number>;
  trainingAge: TrainingAge;
  fatigueState: Record<string, number>;
  volumeMultiplier?: number;
}

export function allocateVolume(
  input: VolumeBudgetInput,
  config: VolumeBudgetConfig = DEFAULT_CONFIG
): VolumeAllocation {
  const targetSets = Math.max(0, input.totalSets * (input.volumeMultiplier ?? 1));
  const muscles = Object.keys(input.musclePriorities);

  if (muscles.length === 0 || targetSets === 0) {
    return {
      allocations: {},
      totalAllocated: 0,
      remainingSets: targetSets,
      cappedByMRV: [],
      mevByMuscle: {},
      mrvByMuscle: {},
    };
  }

  const totalPriority = muscles.reduce(
    (sum, muscle) => sum + Math.max(0, input.musclePriorities[muscle] ?? 0),
    0
  );

  const mevByMuscle: Record<string, number> = {};
  const mrvByMuscle: Record<string, number> = {};

  for (const muscle of muscles) {
    mevByMuscle[muscle] = calculateMEV(muscle, input.trainingAge, config);
    mrvByMuscle[muscle] = calculateMRV(
      muscle,
      input.fatigueState,
      input.trainingAge,
      config
    );
    if (mrvByMuscle[muscle] < mevByMuscle[muscle]) {
      mrvByMuscle[muscle] = mevByMuscle[muscle];
    }
  }

  const allocations: Record<string, number> = {};
  const cappedByMRV: string[] = [];

  for (const muscle of muscles) {
    const weight = totalPriority > 0 ? input.musclePriorities[muscle] / totalPriority : 0;
    const initial = targetSets * weight;
    const clamped = Math.min(
      Math.max(initial, mevByMuscle[muscle]),
      mrvByMuscle[muscle]
    );
    if (clamped >= mrvByMuscle[muscle] - 0.0001) {
      cappedByMRV.push(muscle);
    }
    allocations[muscle] = roundSets(clamped);
  }

  let allocated = muscles.reduce((sum, muscle) => sum + allocations[muscle], 0);
  let remaining = roundSets(targetSets - allocated);

  if (remaining > 0.0001) {
    const headroom = muscles.map((muscle) => ({
      muscle,
      room: Math.max(0, mrvByMuscle[muscle] - allocations[muscle]),
      weight: input.musclePriorities[muscle],
    }));
    const totalRoom = headroom.reduce((sum, entry) => sum + entry.room, 0);

    for (const entry of headroom) {
      if (remaining <= 0 || entry.room <= 0 || totalRoom <= 0) {
        continue;
      }
      const share = totalRoom > 0 ? (entry.room / totalRoom) * remaining : 0;
      allocations[entry.muscle] = roundSets(allocations[entry.muscle] + share);
    }
  } else if (remaining < -0.0001) {
    const reducible = muscles.map((muscle) => ({
      muscle,
      reducible: Math.max(0, allocations[muscle] - mevByMuscle[muscle]),
    }));
    const totalReducible = reducible.reduce((sum, entry) => sum + entry.reducible, 0);

    for (const entry of reducible) {
      if (remaining >= 0 || entry.reducible <= 0 || totalReducible <= 0) {
        continue;
      }
      const share = totalReducible > 0 ? (entry.reducible / totalReducible) * Math.abs(remaining) : 0;
      allocations[entry.muscle] = roundSets(allocations[entry.muscle] - share);
    }
  }

  allocated = muscles.reduce((sum, muscle) => sum + allocations[muscle], 0);
  remaining = roundSets(targetSets - allocated);

  return {
    allocations,
    totalAllocated: roundSets(allocated),
    remainingSets: remaining,
    cappedByMRV,
    mevByMuscle,
    mrvByMuscle,
  };
}

export interface VolumeRebalanceInput {
  originalWeeklyTargets: Record<string, number>;
  completedWeeklyVolume: Record<string, number>;
  remainingSessions: number;
  trainingAge: TrainingAge;
  fatigueState: Record<string, number>;
}

export function rebalanceVolume(
  input: VolumeRebalanceInput,
  config: VolumeBudgetConfig = DEFAULT_CONFIG
): VolumeRebalanceResult {
  const remainingTargets: Record<string, number> = {};
  const perSessionTargets: Record<string, number> = {};
  const cappedByMRV: string[] = [];
  const notes: string[] = [];

  const muscles = Object.keys(input.originalWeeklyTargets);
  const sessions = Math.max(1, input.remainingSessions);

  for (const muscle of muscles) {
    const planned = input.originalWeeklyTargets[muscle] ?? 0;
    const completed = input.completedWeeklyVolume[muscle] ?? 0;
    const remaining = Math.max(0, planned - completed);
    const mrv = calculateMRV(muscle, input.fatigueState, input.trainingAge, config);

    if (remaining > mrv) {
      remainingTargets[muscle] = roundSets(mrv);
      cappedByMRV.push(muscle);
      notes.push(`Capped ${muscle} remaining volume at MRV (${mrv}).`);
    } else {
      remainingTargets[muscle] = roundSets(remaining);
    }

    perSessionTargets[muscle] = roundSets(remainingTargets[muscle] / sessions);
  }

  return {
    remainingTargets,
    perSessionTargets,
    cappedByMRV,
    notes,
  };
}
