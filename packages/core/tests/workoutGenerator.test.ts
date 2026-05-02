import { describe, expect, it } from "vitest";
import { generateWorkout } from "../src/engine/workoutGenerator";

describe("workout generator engine", () => {
  it("produces deterministic output for identical seeded requests", () => {
    const request = {
      seed: 4242,
      goals: ["strength", "hinge"],
      constraints: {
        equipment: ["barbell", "bench", "rack", "platform"],
        injuries: [],
      },
    };

    const first = generateWorkout(request);
    const second = generateWorkout(request);

    expect(first).toEqual(second);
    expect(first.status).toBe("ok");
    expect(first.workout?.workout_id).toBe("workout_4242");
  });

  it("falls back to surviving bodyweight-compatible options under strict constraints", () => {
    const response = generateWorkout({
      seed: 101,
      goals: ["strength"],
      constraints: {
        equipment: ["nonexistent-equipment"],
        injuries: ["wrist_pain"],
      },
    });

    expect(response.status).toBe("ok");
    expect(response.debug.selected_ids).toEqual(["hinge_bw"]);
    expect(response.debug.rejected.length).toBeGreaterThan(0);
  });
});
