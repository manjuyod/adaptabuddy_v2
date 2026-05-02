import { describe, expect, it } from "vitest";
import { allocateVolume, calculateMEV, calculateMRV, rebalanceVolume } from "../src/engine/volume";

describe("volume budget engine", () => {
  it("scales MEV by training age", () => {
    expect(calculateMEV("chest", "novice")).toBe(6.4);
    expect(calculateMEV("chest", "advanced")).toBe(9.6);
  });

  it("reduces MRV under high fatigue", () => {
    const mrv = calculateMRV("chest", { chest: 80 }, "intermediate");
    expect(mrv).toBe(10.8);
  });

  it("allocates volume within MEV/MRV bounds", () => {
    const allocation = allocateVolume({
      totalSets: 30,
      musclePriorities: { chest: 1, back: 1 },
      trainingAge: "intermediate",
      fatigueState: { chest: 10, back: 5 },
    });

    expect(allocation.allocations.chest).toBe(15);
    expect(allocation.allocations.back).toBe(15);
    expect(allocation.remainingSets).toBe(0);
  });

  it("rebalances remaining volume across sessions", () => {
    const result = rebalanceVolume({
      originalWeeklyTargets: { chest: 12 },
      completedWeeklyVolume: { chest: 4 },
      remainingSessions: 2,
      trainingAge: "intermediate",
      fatigueState: { chest: 10 },
    });

    expect(result.remainingTargets.chest).toBe(8);
    expect(result.perSessionTargets.chest).toBe(4);
  });
});
