import { describe, expect, it, vi } from "vitest";
import { generateSession } from "../src/engine/sessionGenerator";
import { baseContext, exercises, muscleMappings, programDay, ids } from "./fixtures";

describe("sessionGenerator", () => {
  it("generates deterministic sessions for the same seed and time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T10:00:00.000Z"));

    try {
      const input = {
        programDay,
        exercises,
        muscleMappings,
        fatigue: baseContext.fatigue,
        equipment: baseContext.equipment,
        injuries: baseContext.injuries,
        fatigueLevel: baseContext.fatigueLevel,
        seed: "seed-1",
      };

      const first = generateSession(input);
      const second = generateSession(input);

      expect(first).toEqual(second);
      expect(first.seed).toBe("seed-1");
      expect(first.slots).toHaveLength(2);
      expect(first.slots[0].slotId).toBe(ids.slotB);
      expect(first.slots[1].slotId).toBe(ids.slotA);
      expect(first.slots[0].exerciseId).toBe(ids.exerciseC);
      expect(first.slots[1].exerciseId).toBe(ids.exerciseA);
      expect(new Set(first.slots.map((slot) => slot.exerciseId)).size).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("projects fatigue cost for filled slots", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T10:00:00.000Z"));

    try {
      const result = generateSession({
        programDay,
        exercises,
        muscleMappings,
        fatigue: baseContext.fatigue,
        equipment: baseContext.equipment,
        injuries: baseContext.injuries,
        fatigueLevel: "moderate",
        seed: "seed-1",
      });

      expect(result.projectedFatigueCost.back).toBeCloseTo(17.5, 5);
      expect(result.projectedFatigueCost.chest).toBeCloseTo(17.5, 5);
      expect(result.projectedFatigueCost.triceps).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects initial excluded exercise ids", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T10:00:00.000Z"));

    try {
      const result = generateSession({
        programDay,
        exercises,
        muscleMappings,
        fatigue: baseContext.fatigue,
        equipment: baseContext.equipment,
        injuries: baseContext.injuries,
        fatigueLevel: "moderate",
        seed: "seed-1",
        excludeExerciseIds: [ids.exerciseC],
      });

      expect(result.slots.some((slot) => slot.exerciseId === ids.exerciseC)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
