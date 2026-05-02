import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPT_INS,
  type DeterministicAnalyticsReadModel,
  type Progression,
  type UserStats,
} from "@adaptabuddy/contracts";
import { detectStatsJsonCompatibilityDrift } from "../src/modules/reporting/stats-json-drift";

type CompatibilityProgression = Progression & {
  recentWorkouts?: Array<{
    completedAt: string;
    dayName: string;
    volume: number;
  }>;
  weeklyVolumeByMuscle?: Record<string, number>;
};

const createNormalizedActiveProgram = () => ({
  programId: "2001",
  currentDayIndex: 4,
  currentMicrocycle: 2,
});

const createAnalytics = (): DeterministicAnalyticsReadModel => ({
  cyclePlanId: "55",
  cycleCompletion: {
    currentSessionIndex: 4,
    currentMicrocycleIndex: 1,
    totalSessions: 10,
    completedSessions: 4,
    remainingSessions: 6,
    nextSessionIndex: 5,
    completionPercentage: 40,
  },
  adherence: {
    streak: 4,
    completedCount: 4,
    missedCount: 0,
    lastOutcome: "complete_clean",
    xp: 180,
    level: 2,
  },
  progression: {
    totalExercises: 1,
    trendCounts: {
      improving: 1,
      stalled: 0,
      regressing: 0,
      blocked: 0,
    },
    actionCounts: {
      overload: 0,
      maintain: 1,
      regress: 0,
      swap: 0,
    },
    swapPressure: {
      affectedExerciseCount: 0,
      recommendationCount: 0,
      exerciseIds: [],
    },
    exercises: [],
  },
  fatigueSummary: {
    items: [
      { muscle: "chest", current: 42, severity: "low" },
      { muscle: "back", current: 24, severity: "low" },
    ],
  },
  capacityTimeline: {
    series: [
      {
        exerciseId: "bench_press",
        exerciseLabel: "Bench Press",
        confidence: 0.7,
        points: [{ date: "2026-02-04T00:00:00.000Z", estimated1RM: 110 }],
      },
    ],
  },
  weeklyVolume: {
    windowStartedAt: "2026-02-08T00:00:00.000Z",
    windowEndedAt: "2026-02-14T00:00:00.000Z",
    items: [
      { muscle: "chest", sets: 12 },
      { muscle: "back", sets: 5 },
    ],
  },
  recentSessions: [
    {
      workoutLogId: 300,
      completedAt: "2026-02-14T08:00:00.000Z",
      dayName: "Upper",
      durationSeconds: 1800,
      totalVolume: 2200,
      setCount: 12,
      seed: "seed-upper-1",
    },
    {
      workoutLogId: 292,
      completedAt: "2026-02-12T08:00:00.000Z",
      dayName: "Lower",
      durationSeconds: 1600,
      totalVolume: 1800,
      setCount: 10,
      seed: "seed-lower-1",
    },
  ],
});

const createCompatibleStats = (
  normalizedActiveProgram: ReturnType<typeof createNormalizedActiveProgram>
): UserStats => ({
  activeProgram: {
    programId: normalizedActiveProgram.programId,
    startedAt: "2026-02-01T00:00:00.000Z",
    currentDayIndex: normalizedActiveProgram.currentDayIndex,
    currentMicrocycle: normalizedActiveProgram.currentMicrocycle,
    daysPerWeek: 4,
  },
  fatigue: {
    chest: { current: 42, lastUpdated: "2026-02-14T08:00:00.000Z" },
    back: { current: 24, lastUpdated: "2026-02-14T08:00:00.000Z" },
  },
  mastery: {},
  capacities: {},
  progression: {
    totalWorkouts: 4,
    weeklyVolume: 4000,
    lastWorkoutAt: "2026-02-14T08:00:00.000Z",
    recentWorkouts: [
      {
        completedAt: "2026-02-14T08:00:00.000Z",
        dayName: "Upper",
        volume: 2200,
      },
      {
        completedAt: "2026-02-12T08:00:00.000Z",
        dayName: "Lower",
        volume: 1800,
      },
    ],
    weeklyVolumeByMuscle: {
      chest: 12,
      back: 5,
    },
  } satisfies CompatibilityProgression as Progression,
  preferences: {
    fatigueLevel: "moderate",
    equipment: [],
    injuries: [],
    acknowledgedRisks: [],
    optIns: { ...DEFAULT_OPT_INS },
  },
});

const createDriftingStats = (
  normalizedActiveProgram: ReturnType<typeof createNormalizedActiveProgram>
): UserStats => ({
  ...createCompatibleStats(normalizedActiveProgram),
  activeProgram: {
    ...createCompatibleStats(normalizedActiveProgram).activeProgram!,
    programId: "legacy-program-id",
    currentDayIndex: 1,
    currentMicrocycle: 99,
  },
  fatigue: {
    chest: { current: 12, lastUpdated: "2026-02-14T08:00:00.000Z" },
    back: { current: 24, lastUpdated: "2026-02-14T08:00:00.000Z" },
  },
  progression: {
    ...createCompatibleStats(normalizedActiveProgram).progression,
    recentWorkouts: [
      {
        completedAt: "2026-02-10T07:00:00.000Z",
        dayName: "Legacy Day",
        volume: 900,
      },
    ],
    weeklyVolumeByMuscle: {
      chest: 4,
      shoulders: 8,
    },
  } satisfies CompatibilityProgression as Progression,
});

describe("stats-json drift detector", () => {
  it("reports active-cycle and dashboard drift when stats_json is stale", () => {
    const normalizedActiveProgram = createNormalizedActiveProgram();
    const analytics = createAnalytics();
    const driftingStats = createDriftingStats(normalizedActiveProgram);

    const result = detectStatsJsonCompatibilityDrift({
      normalizedActiveProgram,
      deterministicAnalytics: analytics,
      statsJson: driftingStats,
      options: {
        recentSessionLimit: 2,
      },
    });

    expect(result.compatible).toBe(false);
    expect(result.drifts.length).toBeGreaterThanOrEqual(4);
    expect(result.drifts.map((drift) => drift.field)).toEqual(
      expect.arrayContaining([
        "activeProgram",
        "recentSessions",
        "fatigueSummary",
        "weeklyVolume",
      ])
    );
    expect(result.drifts[0].path).toBe("activeProgram.programId");
    expect(result.drifts.some((drift) => drift.field === "recentSessions")).toBe(true);
    expect(result.drifts.some((drift) => drift.path === "fatigueSummary.items")).toBe(true);
  });

  it("returns compatible when stats_json mirrors normalized cycle and dashboard summaries", () => {
    const normalizedActiveProgram = createNormalizedActiveProgram();
    const analytics = createAnalytics();
    const compatibleStats = createCompatibleStats(normalizedActiveProgram);

    const result = detectStatsJsonCompatibilityDrift({
      normalizedActiveProgram,
      deterministicAnalytics: analytics,
      statsJson: compatibleStats,
      options: {
        recentSessionLimit: 2,
      },
    });

    expect(result).toEqual({ compatible: true, drifts: [] });
  });

  it("reports dashboard drift when canonical analytics are empty but stats_json still has fallback summaries", () => {
    const normalizedActiveProgram = createNormalizedActiveProgram();
    const analytics = {
      ...createAnalytics(),
      recentSessions: [],
      fatigueSummary: { items: [] },
      weeklyVolume: {
        windowStartedAt: null,
        windowEndedAt: null,
        items: [],
      },
    };
    const compatibleStats = createCompatibleStats(normalizedActiveProgram);

    const result = detectStatsJsonCompatibilityDrift({
      normalizedActiveProgram,
      deterministicAnalytics: analytics,
      statsJson: compatibleStats,
      options: {
        recentSessionLimit: 2,
      },
    });

    expect(result.compatible).toBe(false);
    expect(result.drifts.map((drift) => drift.field)).toEqual(
      expect.arrayContaining([
        "recentSessions",
        "fatigueSummary",
        "weeklyVolume",
      ])
    );
  });

  it("reports recent-session drift when stats_json only has the legacy last-workout fallback", () => {
    const normalizedActiveProgram = createNormalizedActiveProgram();
    const analytics = {
      ...createAnalytics(),
      recentSessions: [],
    };
    const compatibleStats = createCompatibleStats(normalizedActiveProgram);
    const statsWithLastWorkoutFallback = {
      ...compatibleStats,
      progression: {
        ...compatibleStats.progression,
        recentWorkouts: [],
        lastWorkoutAt: "2026-02-14T08:00:00.000Z",
        weeklyVolume: 4000,
      } satisfies CompatibilityProgression as Progression,
    };

    const result = detectStatsJsonCompatibilityDrift({
      normalizedActiveProgram,
      deterministicAnalytics: analytics,
      statsJson: statsWithLastWorkoutFallback,
      options: {
        recentSessionLimit: 2,
      },
    });

    expect(result.compatible).toBe(false);
    expect(result.drifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "recentSessions",
          path: "recentSessions.length",
        }),
      ])
    );
  });

  it("does not evaluate dashboard drift when deterministic analytics is unavailable", () => {
    const normalizedActiveProgram = createNormalizedActiveProgram();
    const driftingStats = createDriftingStats(normalizedActiveProgram);

    const result = detectStatsJsonCompatibilityDrift({
      normalizedActiveProgram,
      deterministicAnalytics: null,
      statsJson: driftingStats,
    });

    expect(result.compatible).toBe(false);
    expect(result.drifts).toHaveLength(3);
    expect(result.drifts[0].field).toBe("activeProgram");
    expect(result.drifts[0].scope).toBe("active-cycle");
  });

  it("still evaluates dashboard drift when the normalized active-program projection is missing", () => {
    const normalizedActiveProgram = createNormalizedActiveProgram();
    const analytics = createAnalytics();
    const driftingStats = createDriftingStats(normalizedActiveProgram);

    const result = detectStatsJsonCompatibilityDrift({
      normalizedActiveProgram: null,
      deterministicAnalytics: analytics,
      statsJson: driftingStats,
      options: {
        recentSessionLimit: 2,
      },
    });

    expect(result.compatible).toBe(false);
    expect(result.drifts.map((drift) => drift.field)).toEqual(
      expect.arrayContaining([
        "activeProgram",
        "recentSessions",
        "fatigueSummary",
        "weeklyVolume",
      ])
    );
    expect(result.drifts[0]).toMatchObject({
      scope: "active-cycle",
      field: "activeProgram",
      path: "activeProgram",
    });
  });
});
