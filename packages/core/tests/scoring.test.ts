import { describe, expect, it } from "vitest";
import type { Exercise } from "../src/domain/types";
import { createRng } from "../src/engine/rng";
import { scoreExercises } from "../src/engine/scoring";

const buildExercise = (
  id: string,
  block: Exercise["block"],
  goals: string[]
): Exercise => ({
  id,
  name: id,
  goals,
  equipment: [],
  contraindications: [],
  block,
  sets: 3,
  reps: "8",
});

describe("scoring engine", () => {
  it("applies goal, block, and jitter weights in ranking", () => {
    const exercises: Exercise[] = [
      buildExercise("a_main_strength", "main", ["strength"]),
      buildExercise("b_accessory_strength", "accessory", ["strength"]),
      buildExercise("c_conditioning_other", "conditioning", ["conditioning"]),
    ];

    const scored = scoreExercises(exercises, ["strength"], () => 0);
    const summary = scored.map(({ exercise, score }) => ({
      id: exercise.id,
      score,
    }));

    expect(summary).toEqual([
      { id: "a_main_strength", score: 1.85 },
      { id: "b_accessory_strength", score: 1.6 },
      { id: "c_conditioning_other", score: 1.1 },
    ]);
  });

  it("uses exercise id to break score ties", () => {
    const exercises: Exercise[] = [
      buildExercise("z", "accessory", []),
      buildExercise("a", "accessory", []),
    ];

    const scored = scoreExercises(exercises, undefined, () => 0);

    expect(scored.map(({ exercise }) => exercise.id)).toEqual(["a", "z"]);
  });

  it("is deterministic with the same RNG seed and inputs", () => {
    const exercises: Exercise[] = [
      buildExercise("main_1", "main", ["strength"]),
      buildExercise("main_2", "main", ["strength"]),
      buildExercise("accessory_1", "accessory", ["hypertrophy"]),
    ];
    const goals = ["strength", "hypertrophy"];

    const first = scoreExercises(exercises, goals, createRng(20260213));
    const second = scoreExercises(exercises, goals, createRng(20260213));

    expect(first).toEqual(second);
  });
});
