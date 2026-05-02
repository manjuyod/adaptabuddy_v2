import { describe, expect, it } from "vitest";
import { handleGenerateWorkout } from "../src/modules/workouts/service";
import type { GenerateWorkoutRequest } from "../src/modules/workouts/contracts";

describe("workout engine", () => {
  const baseRequest: GenerateWorkoutRequest = {
    seed: 4242,
    goals: ["strength"],
    constraints: { equipment: ["barbell", "bench", "rack", "platform"] }
  };

  it("produces deterministic output for the same seed", () => {
    const first = handleGenerateWorkout(baseRequest);
    const second = handleGenerateWorkout(baseRequest);
    expect(first).toEqual(second);
    expect(first.status).toBe("ok");
    expect(first.workout?.workout_id).toBe("workout_4242");
    expect(first.workout?.blocks.length).toBeGreaterThan(0);
    expect(first.debug.selected_ids.length).toBeGreaterThan(0);
  });
});
