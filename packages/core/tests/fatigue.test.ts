import { describe, expect, it } from "vitest";
import {
  accumulateFatigue,
  calculateFatigueCost,
  dissipateFatigue,
} from "../src/engine/fatigue";
import { muscleMappings, ids } from "./fixtures";

describe("fatigue engine", () => {
  it("dissipates fatigue with exponential decay", () => {
    const state = {
      chest: {
        current: 50,
        lastUpdated: "2026-01-01T10:00:00.000Z",
      },
    };

    const result = dissipateFatigue(state, "2026-01-03T10:00:00.000Z", {
      halfLifeHours: 48,
      maxFatigue: 100,
    });

    expect(result.chest.current).toBe(25);
    expect(result.chest.lastUpdated).toBe("2026-01-03T10:00:00.000Z");
  });

  it("accumulates fatigue with level multipliers and caps", () => {
    const state = {
      chest: { current: 30, lastUpdated: "2026-01-01T10:00:00.000Z" },
    };

    const result = accumulateFatigue(
      state,
      { chest: 50 },
      "hard",
      "2026-01-02T10:00:00.000Z",
      { halfLifeHours: 48, maxFatigue: 100 }
    );

    expect(result.chest.current).toBe(95);
    expect(result.chest.lastUpdated).toBe("2026-01-02T10:00:00.000Z");
  });

  it("calculates fatigue cost from completed sets", () => {
    const costs = calculateFatigueCost(
      [
        {
          exerciseId: ids.exerciseA,
          sets: [
            { weight: 100, reps: 5 },
            { weight: 100, reps: 5 },
          ],
        },
        {
          exerciseId: ids.exerciseB,
          sets: [{ weight: 50, reps: 8 }],
        },
      ],
      muscleMappings
    );

    expect(costs.chest).toBeCloseTo(13.5, 5);
    expect(costs.triceps).toBeCloseTo(0.75, 5);
  });
});
