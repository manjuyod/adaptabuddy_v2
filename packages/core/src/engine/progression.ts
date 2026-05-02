import type {
  LoadRecommendation,
  ExerciseCapacity,
  ProgressionStrategy,
  DUPDay,
} from "@adaptabuddy/contracts";

export interface ProgressionConfig {
  weightIncrementKg: number;
  minConfidence: number;
}

const DEFAULT_CONFIG: ProgressionConfig = {
  weightIncrementKg: 2.5,
  minConfidence: 0.3,
};

export interface ProgressionContext {
  dayIndex?: number;
  weekIndex?: number;
  lastRpe?: number | null;
}

/**
 * Estimate 1RM using Brzycki formula
 * 1RM = weight * 36 / (37 - reps)
 *
 * Valid for reps 1-10
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps < 1 || reps > 10 || weight <= 0) {
    return 0;
  }
  return Math.round((weight * 36) / (37 - reps) * 10) / 10;
}

/**
 * Calculate weight for target reps and RIR from 1RM
 * Uses inverse Brzycki with RIR adjustment
 */
export function calculateWeightFromRM(
  estimated1RM: number,
  targetReps: number,
  targetRir: number
): number {
  // Adjust reps for RIR (each RIR adds ~1 effective rep)
  const effectiveReps = targetReps + targetRir;

  // Inverse Brzycki: weight = 1RM * (37 - reps) / 36
  const weight = (estimated1RM * (37 - effectiveReps)) / 36;

  // Round to nearest 2.5
  return Math.round(weight / 2.5) * 2.5;
}

/**
 * Recommend load using double progression
 *
 * Double progression rules:
 * - If lastReps >= repsMax: increase weight ~2.5kg, reset to repsMin
 * - Otherwise: add 1 rep at same weight
 */
export function recommendLoad(
  exerciseId: string,
  capacity: ExerciseCapacity | null,
  targetRepsMin: number,
  targetRepsMax: number,
  targetRir: number = 2,
  config: ProgressionConfig = DEFAULT_CONFIG
): LoadRecommendation {
  // No history - can't recommend specific weight
  if (!capacity || !capacity.lastWeight || !capacity.lastReps) {
    return {
      exerciseId,
      recommendedWeight: null,
      recommendedReps: targetRepsMin,
      targetRir,
      reasoning:
        "No previous data. Start with a weight you can do for the target reps.",
      isProgression: false,
    };
  }

  const { lastWeight, lastReps, confidence } = capacity;

  // Low confidence - be conservative
  if (confidence < config.minConfidence) {
    return {
      exerciseId,
      recommendedWeight: lastWeight,
      recommendedReps: Math.min(lastReps + 1, targetRepsMax),
      targetRir,
      reasoning: `Low confidence (${Math.round(confidence * 100)}%). Continue building data.`,
      isProgression: false,
    };
  }

  // Double progression logic
  if (lastReps >= targetRepsMax) {
    // Time to increase weight
    const newWeight = lastWeight + config.weightIncrementKg;
    return {
      exerciseId,
      recommendedWeight: newWeight,
      recommendedReps: targetRepsMin,
      targetRir,
      reasoning: `Hit ${lastReps} reps at ${lastWeight}kg. Increase weight.`,
      isProgression: true,
    };
  }

  // Keep weight, add reps
  return {
    exerciseId,
    recommendedWeight: lastWeight,
    recommendedReps: Math.min(lastReps + 1, targetRepsMax),
    targetRir,
    reasoning: `${lastReps} reps last time. Target ${lastReps + 1} reps this time.`,
    isProgression: false,
  };
}

const getDupDay = (pattern: DUPDay[], dayIndex: number): DUPDay => {
  const normalized = Math.max(0, dayIndex % pattern.length);
  return pattern[normalized];
};

const roundWeight = (weight: number) => Math.round(weight / 2.5) * 2.5;

export interface RecommendProgressionInput {
  exerciseId: string;
  capacity: ExerciseCapacity | null;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRir?: number;
  strategy: ProgressionStrategy;
  context?: ProgressionContext;
}

/**
 * Recommend load using explicit progression strategies.
 *
 * Supports:
 * - linear progression
 * - double progression
 * - DUP (intensity/rep targets by day)
 * - RPE-based autoregulation
 */
export function recommendProgression(
  input: RecommendProgressionInput,
  config: ProgressionConfig = DEFAULT_CONFIG
): LoadRecommendation {
  const { exerciseId, capacity, targetRepsMin, targetRepsMax, targetRir } = input;
  const rir = targetRir ?? 2;
  const lastWeight = capacity?.lastWeight ?? null;
  const lastReps = capacity?.lastReps ?? null;
  const estimated1RM = capacity?.estimated1RM ?? null;
  const lastRpe = input.context?.lastRpe ?? null;

  if (input.strategy.type === "double_progression") {
    return recommendLoad(
      exerciseId,
      capacity,
      targetRepsMin,
      targetRepsMax,
      rir,
      {
        ...config,
        weightIncrementKg:
          input.strategy.weightIncrementKg ?? config.weightIncrementKg,
      }
    );
  }

  if (input.strategy.type === "linear") {
    if (!lastWeight && !estimated1RM) {
      return {
        exerciseId,
        recommendedWeight: null,
        recommendedReps: targetRepsMin,
        targetRir: rir,
        reasoning: "No history available. Start with a conservative load.",
        isProgression: false,
      };
    }

    const baseWeight =
      lastWeight ?? calculateWeightFromRM(estimated1RM ?? 0, targetRepsMin, rir);
    const nextWeight = roundWeight(baseWeight + input.strategy.incrementKg);

    return {
      exerciseId,
      recommendedWeight: nextWeight,
      recommendedReps: targetRepsMin,
      targetRir: rir,
      reasoning: `Linear progression: add ${input.strategy.incrementKg}kg.`,
      isProgression: true,
    };
  }

  if (input.strategy.type === "dup") {
    const dayIndex = input.context?.dayIndex ?? 0;
    const patternDay = getDupDay(input.strategy.pattern, dayIndex);
    const reps = Math.min(Math.max(patternDay.targetReps, targetRepsMin), targetRepsMax);
    const dayRir = patternDay.targetRir ?? rir;

    if (!estimated1RM && !lastWeight) {
      return {
        exerciseId,
        recommendedWeight: null,
        recommendedReps: reps,
        targetRir: dayRir,
        reasoning: "No history available. Start with a conservative load.",
        isProgression: false,
      };
    }

    const weightFromRM = estimated1RM
      ? roundWeight(estimated1RM * patternDay.intensityPct)
      : null;
    const recommendedWeight = weightFromRM ?? lastWeight;

    return {
      exerciseId,
      recommendedWeight,
      recommendedReps: reps,
      targetRir: dayRir,
      reasoning: `DUP day ${dayIndex + 1}: ${Math.round(
        patternDay.intensityPct * 100
      )}% intensity.`,
      isProgression: false,
    };
  }

  if (input.strategy.type === "rpe") {
    const adjustment = input.strategy.adjustmentKg ?? config.weightIncrementKg;
    const maxAdjustment = input.strategy.maxAdjustmentKg ?? adjustment;

    if (!lastWeight && !estimated1RM) {
      return {
        exerciseId,
        recommendedWeight: null,
        recommendedReps: targetRepsMin,
        targetRir: rir,
        reasoning: "No history available. Start with a conservative load.",
        isProgression: false,
      };
    }

    const baseWeight =
      lastWeight ?? calculateWeightFromRM(estimated1RM ?? 0, targetRepsMin, rir);

    let delta = 0;
    if (lastRpe !== null && lastRpe !== undefined) {
      if (lastRpe >= input.strategy.targetRpe + 1) {
        delta = -adjustment;
      } else if (lastRpe <= input.strategy.targetRpe - 1) {
        delta = adjustment;
      }
    }

    if (Math.abs(delta) > maxAdjustment) {
      delta = Math.sign(delta) * maxAdjustment;
    }

    const nextWeight = roundWeight(baseWeight + delta);
    const reason =
      lastRpe === null || lastRpe === undefined
        ? "Autoregulation: no recent RPE; keep load steady."
        : `Autoregulation: last RPE ${lastRpe}, target ${input.strategy.targetRpe}.`;

    return {
      exerciseId,
      recommendedWeight: nextWeight,
      recommendedReps: targetRepsMin,
      targetRir: rir,
      reasoning: reason,
      isProgression: delta > 0,
    };
  }

  return recommendLoad(
    exerciseId,
    capacity,
    targetRepsMin,
    targetRepsMax,
    rir,
    config
  );
}

export function generateLoadRecommendationsWithStrategy(
  exercises: Array<{
    exerciseId: string;
    repsMin: number;
    repsMax: number;
    targetRir?: number;
    strategy: ProgressionStrategy;
    context?: ProgressionContext;
  }>,
  capacities: Record<string, ExerciseCapacity>,
  config: ProgressionConfig = DEFAULT_CONFIG
): LoadRecommendation[] {
  return exercises.map((exercise) => {
    const capacity = capacities[exercise.exerciseId] ?? null;
    return recommendProgression(
      {
        exerciseId: exercise.exerciseId,
        capacity,
        targetRepsMin: exercise.repsMin,
        targetRepsMax: exercise.repsMax,
        targetRir: exercise.targetRir,
        strategy: exercise.strategy,
        context: exercise.context,
      },
      config
    );
  });
}

/**
 * Update capacity after completing sets
 */
export function updateCapacity(
  current: ExerciseCapacity | null,
  sets: Array<{ weight: number; reps: number }>,
  timestamp: string
): ExerciseCapacity {
  // Find best set (highest estimated 1RM)
  let best1RM = 0;
  let bestWeight = 0;
  let bestReps = 0;

  for (const set of sets) {
    if (set.weight > 0 && set.reps > 0) {
      const set1RM = estimate1RM(set.weight, set.reps);
      if (set1RM > best1RM) {
        best1RM = set1RM;
        bestWeight = set.weight;
        bestReps = set.reps;
      }
    }
  }

  // Calculate new confidence (increases with more data)
  const previousConfidence = current?.confidence ?? 0;
  const newConfidence = Math.min(previousConfidence + 0.1, 1);

  // Update estimated 1RM with smoothing if we have prior data
  let finalEstimate = best1RM;
  if (current?.estimated1RM && best1RM > 0) {
    // Weighted average: 70% new, 30% old
    finalEstimate = best1RM * 0.7 + current.estimated1RM * 0.3;
    finalEstimate = Math.round(finalEstimate * 10) / 10;
  }

  return {
    estimated1RM: finalEstimate > 0 ? finalEstimate : null,
    lastWeight: bestWeight > 0 ? bestWeight : null,
    lastReps: bestReps > 0 ? bestReps : null,
    confidence: newConfidence,
    lastPerformed: timestamp,
  };
}

/**
 * Generate load recommendations for all exercises in a session
 */
export function generateLoadRecommendations(
  exercises: Array<{
    exerciseId: string;
    repsMin: number;
    repsMax: number;
    targetRir?: number;
  }>,
  capacities: Record<string, ExerciseCapacity>,
  config: ProgressionConfig = DEFAULT_CONFIG
): LoadRecommendation[] {
  return exercises.map((exercise) => {
    const capacity = capacities[exercise.exerciseId] ?? null;
    return recommendLoad(
      exercise.exerciseId,
      capacity,
      exercise.repsMin,
      exercise.repsMax,
      exercise.targetRir ?? 2,
      config
    );
  });
}
