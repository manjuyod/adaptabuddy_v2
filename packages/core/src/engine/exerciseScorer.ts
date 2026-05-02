import type { ScoredExercise, SlotContext, ScoreBreakdown } from "@adaptabuddy/contracts";
import type { ExerciseData, MuscleMapping, ProgramSlot } from "../domain/exerciseTypes";

/**
 * Score a single exercise for a slot.
 *
 * Formula:
 * muscleNeed = sum(muscleTargets[m] * contribution * (100 - fatigue[m]) / 100)
 * fatigueCapacity = 1 - (avgFatigue / 100) * 0.5
 * equipmentMatch = userHasAllEquipment ? 1.0 : 0
 * score = muscleNeed * fatigueCapacity * equipmentMatch + tagBonus - tagPenalty
 */
export const scoreExerciseForSlot = (
  exercise: ExerciseData,
  muscleMappings: MuscleMapping[],
  slot: ProgramSlot,
  context: SlotContext
): ScoredExercise => {
  // Get mappings for this exercise
  const exerciseMappings = muscleMappings.filter((m) => m.exerciseId === exercise.id);

  // Calculate muscle need score
  let muscleNeed = 0;
  for (const mapping of exerciseMappings) {
    const target = slot.muscleTargets[mapping.muscleGroupSlug] ?? 0;
    const fatigue = context.fatigue[mapping.muscleGroupSlug] ?? 0;
    const fatigueMultiplier = (100 - fatigue) / 100;
    muscleNeed += target * mapping.contribution * fatigueMultiplier;
  }

  // Calculate fatigue capacity
  const relevantFatigues = exerciseMappings.map((m) => context.fatigue[m.muscleGroupSlug] ?? 0);
  const avgFatigue =
    relevantFatigues.length > 0
      ? relevantFatigues.reduce((a, b) => a + b, 0) / relevantFatigues.length
      : 0;
  const fatigueCapacity = 1 - (avgFatigue / 100) * 0.5;

  // Check equipment match
  const equipmentMatch = exercise.equipment.every(
    (eq) => exercise.isBodyweight || context.equipment.includes(eq)
  )
    ? 1.0
    : 0;

  // Check for contraindications (injuries)
  const hasContraindication = exercise.contraindications.some((c) => context.injuries.includes(c));
  if (hasContraindication) {
    return {
      exerciseId: exercise.id,
      exerciseSlug: exercise.slug,
      exerciseName: exercise.name,
      score: -1, // Exclude from selection
      breakdown: { muscleNeed, fatigueCapacity, equipmentMatch, tagBonus: 0, tagPenalty: 1000 },
    };
  }

  // Calculate tag bonuses/penalties
  let tagBonus = 0;
  const tagPenalty = 0;
  for (const tag of exercise.tags) {
    if (slot.tags.includes(tag)) {
      tagBonus += 0.1; // Bonus for matching slot tags
    }
  }

  const score = muscleNeed * fatigueCapacity * equipmentMatch + tagBonus - tagPenalty;

  const breakdown: ScoreBreakdown = {
    muscleNeed,
    fatigueCapacity,
    equipmentMatch,
    tagBonus,
    tagPenalty,
  };

  return {
    exerciseId: exercise.id,
    exerciseSlug: exercise.slug,
    exerciseName: exercise.name,
    score,
    breakdown,
  };
};

/**
 * Score all exercises for a slot.
 * Returns scored exercises sorted by score descending, excluding contraindicated ones.
 */
export const scoreExercisesForSlot = (
  exercises: ExerciseData[],
  muscleMappings: MuscleMapping[],
  slot: ProgramSlot,
  context: SlotContext
): ScoredExercise[] => {
  return exercises
    .map((ex) => scoreExerciseForSlot(ex, muscleMappings, slot, context))
    .filter((scored) => scored.score >= 0) // Remove contraindicated exercises
    .sort((a, b) => {
      if (b.score === a.score) {
        return a.exerciseId.localeCompare(b.exerciseId);
      }
      return b.score - a.score;
    });
};
