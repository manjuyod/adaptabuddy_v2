import { describe, expect, it } from "vitest";
import { scoreExerciseForSlot, scoreExercisesForSlot } from "../src/engine/exerciseScorer";
import { baseContext, chestSlot, exercises, ids, muscleMappings } from "./fixtures";
import type { ExerciseData } from "../src/domain/exerciseTypes";

describe("exerciseScorer", () => {
  it("scores exercises using fatigue and tag bonuses", () => {
    const scored = scoreExerciseForSlot(
      exercises[0],
      muscleMappings,
      chestSlot,
      baseContext
    );

    expect(scored.breakdown.muscleNeed).toBeCloseTo(0.8, 5);
    expect(scored.breakdown.fatigueCapacity).toBeCloseTo(0.9, 5);
    expect(scored.breakdown.equipmentMatch).toBe(1);
    expect(scored.breakdown.tagBonus).toBeCloseTo(0.1, 5);
    expect(scored.score).toBeCloseTo(0.82, 5);
  });

  it("excludes contraindicated exercises", () => {
    const context = {
      ...baseContext,
      injuries: ["shoulder"],
    };

    const scored = scoreExerciseForSlot(
      exercises[3],
      muscleMappings,
      chestSlot,
      context
    );

    expect(scored.score).toBe(-1);

    const filtered = scoreExercisesForSlot(
      [exercises[3]],
      muscleMappings,
      chestSlot,
      context
    );
    expect(filtered).toHaveLength(0);
  });

  it("sorts ties by exercise id", () => {
    const tieSlot = {
      ...chestSlot,
      tags: [],
    };

    const tieExercises: ExerciseData[] = [
      {
        ...exercises[0],
        id: ids.exerciseA,
        tags: [],
      },
      {
        ...exercises[0],
        id: ids.exerciseB,
        tags: [],
      },
    ];

    const tieMappings = [
      {
        exerciseId: ids.exerciseA,
        muscleGroupSlug: "chest",
        role: "primary" as const,
        contribution: 1,
      },
      {
        exerciseId: ids.exerciseB,
        muscleGroupSlug: "chest",
        role: "primary" as const,
        contribution: 1,
      },
    ];

    const scored = scoreExercisesForSlot(
      tieExercises,
      tieMappings,
      tieSlot,
      baseContext
    );

    expect(scored[0].exerciseId).toBe(ids.exerciseA);
    expect(scored[1].exerciseId).toBe(ids.exerciseB);
  });
});
