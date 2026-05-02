import type { Exercise } from "../domain/types";
import type { Rng } from "./rng";

export type ScoredExercise = {
  exercise: Exercise;
  score: number;
};

export const scoreExercises = (exercises: Exercise[], goals: string[] | undefined, rng: Rng) => {
  return exercises
    .map((exercise) => {
      const goalHits = goals?.filter((goal) => exercise.goals.includes(goal)).length ?? 0;
      const blockWeight = exercise.block === "main" ? 0.25 : exercise.block === "conditioning" ? 0.1 : 0;
      const jitter = rng() * 0.05;
      const score = 1 + goalHits * 0.6 + blockWeight + jitter;
      return { exercise, score };
    })
    .sort((a, b) => {
      if (b.score === a.score) {
        return a.exercise.id.localeCompare(b.exercise.id);
      }
      return b.score - a.score;
    });
};
