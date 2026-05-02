import type { FilledSlot, SlotContext, ScoredExercise } from "@adaptabuddy/contracts";
import type { ExerciseData, MuscleMapping, ProgramSlot } from "../domain/exerciseTypes";
import type { Rng } from "./rng";
import { scoreExercisesForSlot } from "./exerciseScorer";

export interface SlotFillerInput {
  slot: ProgramSlot;
  exercises: ExerciseData[];
  muscleMappings: MuscleMapping[];
  context: SlotContext;
  rng: Rng;
}

/**
 * Select a candidate from the top candidates using weighted random selection.
 * Weights are proportional to score, with a minimum to avoid division by zero.
 */
const selectWithJitter = (candidates: ScoredExercise[], rng: Rng): ScoredExercise => {
  if (candidates.length === 1) {
    return candidates[0];
  }

  // Weight by score
  const totalScore = candidates.reduce((sum, c) => sum + Math.max(c.score, 0.01), 0);
  let random = rng() * totalScore;

  for (const candidate of candidates) {
    random -= Math.max(candidate.score, 0.01);
    if (random <= 0) {
      return candidate;
    }
  }

  return candidates[0]; // Fallback
};

/**
 * Build a human-readable rationale for why an exercise was selected.
 */
const buildRationale = (selected: ScoredExercise): string => {
  const parts: string[] = [];

  if (selected.breakdown.muscleNeed > 0.5) {
    parts.push("excellent muscle targeting");
  } else if (selected.breakdown.muscleNeed > 0.25) {
    parts.push("good muscle targeting");
  }

  if (selected.breakdown.fatigueCapacity > 0.8) {
    parts.push("low fatigue");
  }

  if (selected.breakdown.tagBonus > 0) {
    parts.push("matches slot tags");
  }

  return parts.length > 0 ? `Selected for ${parts.join(", ")}` : "Best available option";
};

/**
 * Fill a single slot with the best-matching exercise.
 *
 * - Handles locked slots (returns locked exercise directly)
 * - Filters excluded exercises
 * - Scores remaining, picks top scorer with jitter for variety
 */
export const fillSlot = (input: SlotFillerInput): FilledSlot | null => {
  const { slot, exercises, muscleMappings, context, rng } = input;

  // Handle locked slots
  if (slot.lockType === "hard" && slot.lockedExerciseId) {
    const lockedExercise = exercises.find((e) => e.id === slot.lockedExerciseId);
    if (lockedExercise) {
      return {
        slotId: slot.id,
        slotIndex: slot.slotIndex,
        slotType: slot.slotType,
        exerciseId: lockedExercise.id,
        exerciseSlug: lockedExercise.slug,
        exerciseName: lockedExercise.name,
        setsMin: slot.setsMin,
        setsMax: slot.setsMax,
        repsMin: slot.repsMin,
        repsMax: slot.repsMax,
        restSeconds: slot.restSeconds,
        score: 1.0,
        rationale: "Locked exercise (hard lock)",
      };
    }
  }

  // Filter excluded exercises
  const availableExercises = exercises.filter((e) => !context.excludeExerciseIds.includes(e.id));

  if (availableExercises.length === 0) {
    return null;
  }

  // Score exercises
  const scored = scoreExercisesForSlot(availableExercises, muscleMappings, slot, context);

  if (scored.length === 0) {
    return null;
  }

  // Add jitter for variety - pick from top 3 with weighted random
  const topCandidates = scored.slice(0, Math.min(3, scored.length));
  const selected = selectWithJitter(topCandidates, rng);

  const rationale = buildRationale(selected);

  return {
    slotId: slot.id,
    slotIndex: slot.slotIndex,
    slotType: slot.slotType,
    exerciseId: selected.exerciseId,
    exerciseSlug: selected.exerciseSlug,
    exerciseName: selected.exerciseName,
    setsMin: slot.setsMin,
    setsMax: slot.setsMax,
    repsMin: slot.repsMin,
    repsMax: slot.repsMax,
    restSeconds: slot.restSeconds,
    score: selected.score,
    rationale,
  };
};
