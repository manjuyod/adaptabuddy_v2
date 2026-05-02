import { describe, expect, it } from "vitest";
import {
  calculateWeightFromRM,
  estimate1RM,
  recommendLoad,
  recommendProgression,
  updateCapacity,
} from "../src/engine/progression";
import { ids } from "./fixtures";

describe("progression engine", () => {
  it("estimates 1RM using Brzycki", () => {
    expect(estimate1RM(100, 5)).toBe(112.5);
    expect(estimate1RM(100, 12)).toBe(0);
  });

  it("calculates target weight from estimated 1RM", () => {
    const weight = calculateWeightFromRM(100, 5, 2);
    expect(weight).toBe(82.5);
  });

  it("recommends a conservative load with low confidence", () => {
    const rec = recommendLoad(
      ids.exerciseA,
      { estimated1RM: 110, lastWeight: 80, lastReps: 5, confidence: 0.2, lastPerformed: null },
      6,
      8
    );

    expect(rec.recommendedWeight).toBe(80);
    expect(rec.recommendedReps).toBe(6);
    expect(rec.isProgression).toBe(false);
  });

  it("recommends progression when reps max is hit", () => {
    const rec = recommendLoad(
      ids.exerciseA,
      { estimated1RM: 110, lastWeight: 80, lastReps: 8, confidence: 0.5, lastPerformed: null },
      6,
      8
    );

    expect(rec.recommendedWeight).toBe(82.5);
    expect(rec.recommendedReps).toBe(6);
    expect(rec.isProgression).toBe(true);
  });

  it("updates capacity with smoothing and confidence", () => {
    const updated = updateCapacity(
      { estimated1RM: 100, lastWeight: 80, lastReps: 5, confidence: 0.5, lastPerformed: null },
      [{ weight: 100, reps: 5 }],
      "2026-01-02T10:00:00.000Z"
    );

    expect(updated.estimated1RM).toBeCloseTo(108.8, 1);
    expect(updated.lastWeight).toBe(100);
    expect(updated.lastReps).toBe(5);
    expect(updated.confidence).toBeCloseTo(0.6, 5);
    expect(updated.lastPerformed).toBe("2026-01-02T10:00:00.000Z");
  });

  it("recommends linear progression", () => {
    const rec = recommendProgression({
      exerciseId: ids.exerciseA,
      capacity: { estimated1RM: 120, lastWeight: 100, lastReps: 5, confidence: 0.7, lastPerformed: null },
      targetRepsMin: 5,
      targetRepsMax: 8,
      strategy: { type: "linear", incrementKg: 2.5 },
    });

    expect(rec.recommendedWeight).toBe(102.5);
    expect(rec.isProgression).toBe(true);
  });

  it("recommends DUP intensity by day", () => {
    const rec = recommendProgression({
      exerciseId: ids.exerciseA,
      capacity: { estimated1RM: 100, lastWeight: 80, lastReps: 5, confidence: 0.7, lastPerformed: null },
      targetRepsMin: 4,
      targetRepsMax: 10,
      strategy: {
        type: "dup",
        pattern: [
          { dayIndex: 0, intensityPct: 0.75, targetReps: 8, targetRir: 2 },
          { dayIndex: 1, intensityPct: 0.85, targetReps: 5, targetRir: 1 },
        ],
      },
      context: { dayIndex: 1 },
    });

    expect(rec.recommendedWeight).toBe(85);
    expect(rec.recommendedReps).toBe(5);
  });

  it("autoregulates load based on RPE", () => {
    const rec = recommendProgression({
      exerciseId: ids.exerciseA,
      capacity: { estimated1RM: 120, lastWeight: 100, lastReps: 5, confidence: 0.7, lastPerformed: null },
      targetRepsMin: 5,
      targetRepsMax: 8,
      strategy: { type: "rpe", targetRpe: 7, adjustmentKg: 2.5 },
      context: { lastRpe: 9 },
    });

    expect(rec.recommendedWeight).toBe(97.5);
    expect(rec.isProgression).toBe(false);
  });
});
