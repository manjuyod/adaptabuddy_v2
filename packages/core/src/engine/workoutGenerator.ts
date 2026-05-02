import type { GenerateWorkoutRequest, GenerateWorkoutResponse } from "@adaptabuddy/contracts";
import { exerciseFixture, type Exercise } from "../domain/types";
import { applyConstraints } from "./constraints";
import { createRng, deriveSeed } from "./rng";
import { scoreExercises } from "./scoring";

const deriveRequestSeed = (request: GenerateWorkoutRequest) => {
  if (typeof request.seed === "number") {
    return request.seed;
  }
  return deriveSeed(JSON.stringify({ goals: request.goals ?? [], constraints: request.constraints ?? {} }));
};

const toWorkoutItem = (exercise: Exercise) => ({
  exercise_id: exercise.id,
  name: exercise.name,
  sets: exercise.sets,
  reps: exercise.reps,
  rir: exercise.rir,
  rest_sec: exercise.rest_sec
});

export const generateWorkout = (request: GenerateWorkoutRequest): GenerateWorkoutResponse => {
  const seed = deriveRequestSeed(request);
  const rng = createRng(seed);
  const { allowed, rejected } = applyConstraints(exerciseFixture, request.constraints);

  if (!allowed.length) {
    return {
      status: "no_solution",
      debug: { seed, selected_ids: [], rejected },
      errors: ["No exercises are available after applying constraints."]
    };
  }

  const scored = scoreExercises(allowed, request.goals, rng);
  const selectedIds = new Set<string>();

  const pick = (block: Exercise["block"], count: number) => {
    const blockItems = scored.filter(({ exercise }) => exercise.block === block);
    const chosen: Exercise[] = [];
    for (const entry of blockItems) {
      if (chosen.length >= count) break;
      if (selectedIds.has(entry.exercise.id)) continue;
      chosen.push(entry.exercise);
      selectedIds.add(entry.exercise.id);
    }
    return chosen;
  };

  const main = pick("main", 2);
  const accessory = pick("accessory", 2);
  const conditioning = pick("conditioning", 1);

  const blocks = [];
  if (main.length) {
    blocks.push({ name: "Main Work", items: main.map(toWorkoutItem) });
  }
  if (accessory.length) {
    blocks.push({ name: "Accessories", items: accessory.map(toWorkoutItem) });
  }
  if (conditioning.length) {
    blocks.push({ name: "Conditioning", items: conditioning.map(toWorkoutItem) });
  }

  if (!blocks.length) {
    return {
      status: "no_solution",
      debug: { seed, selected_ids: [], rejected },
      errors: ["Unable to build a workout with the current dataset."]
    };
  }

  return {
    status: "ok",
    workout: {
      workout_id: `workout_${seed}`,
      title: "Seeded Session",
      blocks
    },
    debug: {
      seed,
      selected_ids: Array.from(selectedIds),
      rejected
    }
  };
};
