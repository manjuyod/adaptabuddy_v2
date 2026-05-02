import type {
  CompletedSession,
  StatsUpdate,
  UserStats,
} from "@adaptabuddy/contracts";
import {
  dissipateFatigue,
  accumulateFatigue,
  calculateFatigueCost,
  type FatigueState,
  type MuscleMapping,
} from "./fatigue";
import { updateCapacity } from "./progression";

export interface CompletionInput {
  session: CompletedSession;
  muscleMappings: MuscleMapping[];
}

export interface CompletionConfig {
  fatigueHalfLifeHours: number;
  masteryPointsPerSet: number;
}

const DEFAULT_CONFIG: CompletionConfig = {
  fatigueHalfLifeHours: 48,
  masteryPointsPerSet: 1,
};

/**
 * Process a completed session and return stat updates
 *
 * 1. Dissipate existing fatigue based on time elapsed
 * 2. Calculate fatigue cost from completed exercises
 * 3. Accumulate new fatigue
 * 4. Update mastery scores (sets performed)
 * 5. Update capacities (1RM estimates from best sets)
 * 6. Advance day index
 */
export function processCompletion(
  input: CompletionInput,
  currentStats: UserStats,
  config: CompletionConfig = DEFAULT_CONFIG
): StatsUpdate {
  const { session, muscleMappings } = input;
  const timestamp = session.completedAt;

  // Convert current fatigue to FatigueState format
  const currentFatigue: FatigueState = {};
  for (const [muscle, fatigue] of Object.entries(currentStats.fatigue)) {
    currentFatigue[muscle] = {
      current: fatigue.current,
      lastUpdated: fatigue.lastUpdated,
    };
  }

  // 1. Dissipate existing fatigue
  const dissipatedFatigue = dissipateFatigue(currentFatigue, timestamp, {
    halfLifeHours: config.fatigueHalfLifeHours,
    maxFatigue: 100,
  });

  // 2. Calculate fatigue costs from completed exercises
  const exercisesForFatigue = session.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    sets: ex.sets,
  }));
  const fatigueCosts = calculateFatigueCost(exercisesForFatigue, muscleMappings);

  // 3. Accumulate new fatigue
  const newFatigue = accumulateFatigue(
    dissipatedFatigue,
    fatigueCosts,
    currentStats.preferences.fatigueLevel,
    timestamp
  );

  // Convert to StatsUpdate format
  const fatigueUpdates: StatsUpdate["fatigueUpdates"] = {};
  for (const [muscle, fatigue] of Object.entries(newFatigue)) {
    fatigueUpdates[muscle] = {
      current: fatigue.current,
      lastUpdated: fatigue.lastUpdated,
    };
  }

  // 4. Calculate mastery updates
  const masteryUpdates: StatsUpdate["masteryUpdates"] = {};
  for (const exercise of session.exercises) {
    const numSets = exercise.sets.length;
    masteryUpdates[exercise.exerciseId] = {
      scoreDelta: numSets * config.masteryPointsPerSet,
      setsDelta: numSets,
      lastUpdated: timestamp,
    };
  }

  // 5. Calculate capacity updates
  const capacityUpdates: StatsUpdate["capacityUpdates"] = {};
  for (const exercise of session.exercises) {
    const currentCapacity = currentStats.capacities[exercise.exerciseId] ?? null;
    const newCapacity = updateCapacity(currentCapacity, exercise.sets, timestamp);
    capacityUpdates[exercise.exerciseId] = {
      estimated1RM: newCapacity.estimated1RM,
      lastWeight: newCapacity.lastWeight,
      lastReps: newCapacity.lastReps,
      confidence: newCapacity.confidence,
      lastPerformed: newCapacity.lastPerformed ?? timestamp,
    };
  }

  // 6. Calculate volume for this session
  let sessionVolume = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      sessionVolume += set.weight * set.reps;
    }
  }

  // 7. Advance day index
  let dayIndexAdvance: number | null = null;
  if (currentStats.activeProgram) {
    const totalDays = currentStats.activeProgram.daysPerWeek;
    const currentIndex = currentStats.activeProgram.currentDayIndex;
    dayIndexAdvance = (currentIndex + 1) % totalDays;
  }

  return {
    fatigueUpdates,
    masteryUpdates,
    capacityUpdates,
    progressionUpdate: {
      workoutsDelta: 1,
      volumeDelta: sessionVolume,
      lastWorkoutAt: timestamp,
    },
    dayIndexAdvance,
  };
}

/**
 * Apply stats update to current stats (pure function)
 */
export function applyStatsUpdate(
  currentStats: UserStats,
  update: StatsUpdate
): UserStats {
  const newFatigue = { ...currentStats.fatigue };
  for (const [muscle, fatigue] of Object.entries(update.fatigueUpdates)) {
    newFatigue[muscle] = fatigue;
  }

  const newMastery = { ...currentStats.mastery };
  for (const [exerciseId, delta] of Object.entries(update.masteryUpdates)) {
    const current = newMastery[exerciseId] ?? {
      score: 0,
      totalSets: 0,
      lastUpdated: "",
    };
    newMastery[exerciseId] = {
      score: current.score + delta.scoreDelta,
      totalSets: current.totalSets + delta.setsDelta,
      lastUpdated: delta.lastUpdated,
    };
  }

  const newCapacities = { ...currentStats.capacities };
  for (const [exerciseId, capacity] of Object.entries(update.capacityUpdates)) {
    newCapacities[exerciseId] = {
      estimated1RM: capacity.estimated1RM,
      lastWeight: capacity.lastWeight,
      lastReps: capacity.lastReps,
      confidence: capacity.confidence,
      lastPerformed: capacity.lastPerformed,
    };
  }

  const newProgression = {
    totalWorkouts:
      currentStats.progression.totalWorkouts +
      update.progressionUpdate.workoutsDelta,
    weeklyVolume:
      currentStats.progression.weeklyVolume +
      update.progressionUpdate.volumeDelta,
    lastWorkoutAt: update.progressionUpdate.lastWorkoutAt,
  };

  let newActiveProgram = currentStats.activeProgram;
  if (newActiveProgram && update.dayIndexAdvance !== null) {
    newActiveProgram = {
      ...newActiveProgram,
      currentDayIndex: update.dayIndexAdvance,
    };
  }

  return {
    ...currentStats,
    activeProgram: newActiveProgram,
    fatigue: newFatigue,
    mastery: newMastery,
    capacities: newCapacities,
    progression: newProgression,
  };
}
