import { describe, expect, it } from "vitest";
import { fillSlot } from "../src/engine/slotFiller";
import { createRng } from "../src/engine/rng";
import { baseContext, chestSlot, exercises, ids, muscleMappings } from "./fixtures";

describe("slotFiller", () => {
  it("returns locked exercise for hard locks", () => {
    const lockedSlot = {
      ...chestSlot,
      lockType: "hard" as const,
      lockedExerciseId: ids.exerciseB,
    };

    const result = fillSlot({
      slot: lockedSlot,
      exercises,
      muscleMappings,
      context: baseContext,
      rng: createRng(42),
    });

    expect(result?.exerciseId).toBe(ids.exerciseB);
    expect(result?.rationale).toBe("Locked exercise (hard lock)");
  });

  it("selects deterministically with a fixed seed", () => {
    const seed = 1234;
    const first = fillSlot({
      slot: chestSlot,
      exercises,
      muscleMappings,
      context: baseContext,
      rng: createRng(seed),
    });

    const second = fillSlot({
      slot: chestSlot,
      exercises,
      muscleMappings,
      context: baseContext,
      rng: createRng(seed),
    });

    expect(first).toEqual(second);
    expect(first?.exerciseId).toBe(ids.exerciseB);
  });
});
