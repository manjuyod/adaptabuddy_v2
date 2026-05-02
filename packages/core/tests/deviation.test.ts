import { describe, expect, it } from "vitest";
import {
  analyzeDeviation,
  projectImpact,
  rebalancePlan,
} from "../src/engine/deviation";

const plannedSession = {
  sessionId: "session-1",
  scheduledAt: "2026-02-14T10:00:00.000Z",
  exercises: [
    {
      exerciseId: 101,
      muscleTargets: { chest: 1, triceps: 0.5 },
      plannedSets: 4,
      plannedReps: 6,
      plannedLoad: 100,
    },
    {
      exerciseId: 202,
      muscleTargets: { back: 1, biceps: 0.5 },
      plannedSets: 3,
      plannedReps: 8,
      plannedLoad: 80,
    },
  ],
} as const;

const actualSession = {
  completedAt: "2026-02-13T18:00:00.000Z",
  exercises: [
    {
      exerciseId: 101,
      completedSets: 8,
      avgReps: 6,
      avgLoad: 112,
    },
    {
      exerciseId: 303,
      substituteForExerciseId: 202,
      completedSets: 2,
      avgReps: 8,
      avgLoad: 78,
    },
  ],
} as const;

describe("deviation handler engine", () => {
  it("analyzes all supported deviation types deterministically", () => {
    const first = analyzeDeviation(plannedSession, actualSession);
    const second = analyzeDeviation(plannedSession, actualSession);

    expect(first).toEqual(second);
    expect(first.deviations.length).toBeGreaterThanOrEqual(4);

    const types = first.deviations.map((item) => item.type);
    expect(types).toContain("volume");
    expect(types).toContain("intensity");
    expect(types).toContain("exercise_substitution");
    expect(types).toContain("timing");
    expect(first.primaryType).toBe("volume");
  });

  it("rebalances remaining plan volume and intensity from deviations + fatigue", () => {
    const analysis = analyzeDeviation(plannedSession, actualSession);

    const result = rebalancePlan(
      [
        {
          sessionId: "remaining-1",
          targetVolumeSets: { chest: 10, back: 8, triceps: 6 },
          intensityMultiplier: 1,
        },
        {
          sessionId: "remaining-2",
          targetVolumeSets: { chest: 8, back: 8, biceps: 5 },
          intensityMultiplier: 1,
        },
      ],
      analysis,
      { chest: 78, triceps: 64, back: 45, biceps: 35 }
    );

    expect(result.sessions[0].adjustedVolumeSets.chest).toBeLessThan(10);
    expect(result.sessions[0].adjustedVolumeSets.triceps).toBeLessThan(6);
    expect(result.sessions[0].adjustedIntensityMultiplier).toBeLessThan(1);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("projects impact and recovery cost for upcoming sessions", () => {
    const analysis = analyzeDeviation(plannedSession, actualSession);

    const projection = projectImpact(analysis, [
      {
        sessionId: "remaining-1",
        targetVolumeSets: { chest: 10, back: 8 },
        intensityMultiplier: 1,
      },
      {
        sessionId: "remaining-2",
        targetVolumeSets: { chest: 8, biceps: 5 },
        intensityMultiplier: 0.95,
      },
    ]);

    expect(projection.projectedPerformanceImpact).toBe("negative");
    expect(projection.recoveryHoursEstimate).toBeGreaterThan(24);
    expect(Object.keys(projection.projectedFatigueDelta).length).toBeGreaterThan(0);
  });
});
