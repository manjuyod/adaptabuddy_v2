import { describe, expect, it } from "vitest";
import {
  GenerateWorkoutResponseSchema,
} from "../src/modules/workouts/contracts";
import {
  DeviationAnalyzeResponseSchema,
  DeterministicAnalyticsResponseSchema,
  GuardrailResponseSchema,
  OptInUpdateResponseSchema,
  DEFAULT_OPT_INS,
} from "@adaptabuddy/contracts";
import { handleGenerateWorkout } from "../src/modules/workouts/service";

describe("api schema", () => {
  it("validates generate workout response shape", () => {
    const response = handleGenerateWorkout({
      goals: ["strength", "hinge"],
      constraints: { equipment: ["barbell", "bench", "rack", "platform"], injuries: [] }
    });

    expect(() => GenerateWorkoutResponseSchema.parse(response)).not.toThrow();
  });

  it("validates guardrail and opt-in response shapes", () => {
    const guardrailResponse = {
      status: "success",
      evaluation: {
        passed: true,
        warnings: [],
        blockers: [],
        recommendations: [],
      },
    };

    const optInResponse = {
      status: "success",
      optIns: { ...DEFAULT_OPT_INS },
      acknowledgedRisks: [],
    };

    expect(() => GuardrailResponseSchema.parse(guardrailResponse)).not.toThrow();
    expect(() => OptInUpdateResponseSchema.parse(optInResponse)).not.toThrow();
  });

  it("validates deviation analyze response shape", () => {
    const response = {
      status: "success",
      analysis: {
        deviations: [],
        totalMagnitude: 0,
        primaryType: null,
        summary: "No meaningful deviation detected between planned and actual session.",
      },
      rebalancedPlan: {
        sessions: [],
        notes: [],
      },
      projection: {
        projectedFatigueDelta: {},
        projectedPerformanceImpact: "neutral",
        recoveryHoursEstimate: 24,
        notes: [],
      },
    };

    expect(() => DeviationAnalyzeResponseSchema.parse(response)).not.toThrow();
  });

  it("validates deterministic analytics response shapes", () => {
    const analytics = {
      cyclePlanId: "7",
      cycleCompletion: {
        currentSessionIndex: 3,
        currentMicrocycleIndex: 1,
        totalSessions: 12,
        completedSessions: 4,
        remainingSessions: 8,
        nextSessionIndex: 4,
        completionPercentage: 33.33,
      },
      adherence: {
        streak: 7,
        completedCount: 13,
        missedCount: 0,
        lastOutcome: "complete_compromised",
        xp: 155,
        level: 3,
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
        exercises: [
          {
            exerciseId: "bench-press",
            action: "maintain",
            trend: "improving",
            swapRecommendationCount: 0,
            lastOutcome: "complete_compromised",
            lastCompletedAt: "2026-02-13T11:10:00.000Z",
          },
        ],
      },
      fatigueSummary: {
        items: [{ muscle: "chest", current: 20, severity: "low" }],
      },
      capacityTimeline: {
        series: [
          {
            exerciseId: "bench-press",
            exerciseLabel: "Bench Press",
            confidence: null,
            points: [{ date: "2026-02-13T11:10:00.000Z", estimated1RM: 120 }],
          },
        ],
      },
      weeklyVolume: {
        windowStartedAt: "2026-02-07T11:10:00.000Z",
        windowEndedAt: "2026-02-13T11:10:00.000Z",
        items: [{ muscle: "chest", sets: 4 }],
      },
      recentSessions: [
        {
          workoutLogId: 42,
          completedAt: "2026-02-13T11:10:00.000Z",
          dayName: "Upper A",
          durationSeconds: 1800,
          totalVolume: 4200,
          setCount: 12,
          seed: "seed-42",
        },
      ],
    };

    expect(() =>
      DeterministicAnalyticsResponseSchema.parse({
        status: "success",
        availability: "available",
        analytics,
      })
    ).not.toThrow();
    expect(() =>
      DeterministicAnalyticsResponseSchema.parse({
        status: "success",
        availability: "unavailable",
        analytics: null,
      })
    ).not.toThrow();
    expect(() =>
      DeterministicAnalyticsResponseSchema.parse({
        status: "error",
        errors: ["Unauthorized"],
      })
    ).not.toThrow();
  });
});
