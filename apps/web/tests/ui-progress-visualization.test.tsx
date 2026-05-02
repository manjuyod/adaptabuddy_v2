// @vitest-environment jsdom

import React from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import type { DeterministicAnalyticsReadModel } from "@adaptabuddy/contracts";
import * as dashboardSummary from "../src/modules/dashboard/summary";
import {
  getDashboardCycleSummary,
  getDashboardRecentWorkouts,
  getProgressionTimelineSeries,
  getRecentWorkoutSummary,
  getWeeklyVolumeSummary,
} from "../src/modules/dashboard/summary";
import { ProgressionTimelineChart } from "../src/modules/dashboard/components/ProgressionTimelineChart";

const baseStats: UserStats = {
  activeProgram: null,
  fatigue: {},
  mastery: {},
  capacities: {},
  progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
  preferences: {
    fatigueLevel: "moderate",
    equipment: [],
    injuries: [],
    acknowledgedRisks: [],
    optIns: { ...DEFAULT_OPT_INS },
  },
};

const analyticsReadModel = {
  cyclePlanId: "7",
  cycleCompletion: {
    currentSessionIndex: 2,
    currentMicrocycleIndex: 1,
    totalSessions: 8,
    completedSessions: 3,
    remainingSessions: 5,
    nextSessionIndex: 3,
    completionPercentage: 37.5,
  },
  adherence: {
    streak: 6,
    completedCount: 12,
    missedCount: 1,
    lastOutcome: "complete_clean",
    xp: 260,
    level: 4,
  },
  progression: {
    totalExercises: 0,
    trendCounts: {
      improving: 0,
      stalled: 0,
      regressing: 0,
      blocked: 0,
    },
    actionCounts: {
      overload: 0,
      maintain: 0,
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
      {
        muscle: "chest",
        current: 24,
        severity: "low",
      },
      {
        muscle: "back",
        current: 12,
        severity: "low",
      },
    ],
  },
  capacityTimeline: {
    series: [
      {
        exerciseId: "bench_press",
        exerciseLabel: "Analytics Bench",
        confidence: 0.9,
        points: [
          { date: "2026-02-01T00:00:00.000Z", estimated1RM: 110 },
          { date: "2026-02-14T00:00:00.000Z", estimated1RM: 120 },
        ],
      },
    ],
  },
  weeklyVolume: {
    windowStartedAt: "2026-02-08T00:00:00.000Z",
    windowEndedAt: "2026-02-14T00:00:00.000Z",
    items: [
      { muscle: "chest", sets: 16 },
      { muscle: "back", sets: 10 },
    ],
  },
  recentSessions: [
    {
      workoutLogId: 42,
      completedAt: "2026-04-20T10:00:00.000Z",
      dayName: "Normalized Upper",
      durationSeconds: 1800,
      totalVolume: 4200,
      setCount: 3,
      seed: "seed-1",
    },
  ],
} as unknown as DeterministicAnalyticsReadModel;

describe("Spec 06 progress visualization", () => {
  it("builds timeline series and volume/history summaries from stats_json", () => {
    const statsWithProgressData = {
      ...baseStats,
      capacities: {
        bench_press: {
          estimated1RM: 120,
          lastWeight: 95,
          lastReps: 6,
          confidence: 0.8,
          lastPerformed: "2026-02-14T12:00:00.000Z",
        },
      },
      progression: {
        totalWorkouts: 14,
        weeklyVolume: 4200,
        lastWorkoutAt: "2026-02-14T12:00:00.000Z",
        exercise1RMHistory: {
          bench_press: [
            { date: "2026-02-01T12:00:00.000Z", estimated1RM: 108 },
            { date: "2026-02-08T12:00:00.000Z", estimated1RM: 114 },
          ],
        },
        weeklySetsByMuscle: {
          chest: 14,
          triceps: 10,
        },
        recentWorkouts: [
          {
            completedAt: "2026-02-12T18:30:00.000Z",
            dayName: "Upper B",
            volume: 1900,
          },
          {
            completedAt: "2026-02-14T18:30:00.000Z",
            dayName: "Upper A",
            volume: 2100,
          },
        ],
      },
    } as UserStats;

    const timeline = getProgressionTimelineSeries(statsWithProgressData);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].exerciseId).toBe("bench_press");
    expect(timeline[0].points.map((point) => point.estimated1RM)).toEqual([
      108, 114, 120,
    ]);

    const volumeSummary = getWeeklyVolumeSummary(statsWithProgressData);
    expect(volumeSummary[0]).toMatchObject({ muscle: "chest", sets: 14 });
    expect(volumeSummary[1]).toMatchObject({ muscle: "triceps", sets: 10 });

    const history = getRecentWorkoutSummary(statsWithProgressData);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      dayName: "Upper A",
      volume: 2100,
    });
  });

  it("prefers deterministic analytics over stats_json for dashboard recent workouts and cycle summary", () => {
    const conflictingStats = {
      ...baseStats,
      fatigue: {
        chest: {
          current: 99,
          lastUpdated: "2026-01-01T00:00:00.000Z",
        },
      },
      capacities: {
        bench_press: {
          estimated1RM: 250,
          lastWeight: 200,
          lastReps: 5,
          confidence: 1,
          lastPerformed: "2026-01-01T00:00:00.000Z",
        },
      },
      progression: {
        totalWorkouts: 99,
        weeklyVolume: 9999,
        lastWorkoutAt: "2026-01-01T00:00:00.000Z",
        recentWorkouts: [
          {
            completedAt: "2026-01-01T00:00:00.000Z",
            dayName: "Stale Stats Day",
            volume: 1,
          },
        ],
      },
    } as UserStats;

    const recent = getDashboardRecentWorkouts(analyticsReadModel, conflictingStats, 10);
    expect(recent).toEqual([
      {
        workoutId: 42,
        completedAt: "2026-04-20T10:00:00.000Z",
        dayName: "Normalized Upper",
        volume: 4200,
      },
    ]);

    expect(dashboardSummary.getFatigueSummary(analyticsReadModel, conflictingStats, 10)).toEqual([
      {
        muscle: "chest",
        current: 24,
        severity: "low",
      },
      {
        muscle: "back",
        current: 12,
        severity: "low",
      },
    ]);

    expect(getProgressionTimelineSeries(analyticsReadModel, conflictingStats)).toEqual([
      {
        exerciseId: "bench_press",
        exerciseLabel: "Analytics Bench",
        confidence: 0.9,
        points: [
          { date: "2026-02-01T00:00:00.000Z", estimated1RM: 110 },
          { date: "2026-02-14T00:00:00.000Z", estimated1RM: 120 },
        ],
      },
    ]);

    expect(getWeeklyVolumeSummary(analyticsReadModel, conflictingStats)).toEqual([
      { muscle: "chest", sets: 16 },
      { muscle: "back", sets: 10 },
    ]);

    const cycleSummary = getDashboardCycleSummary(analyticsReadModel);
    expect(cycleSummary).toMatchObject({
      completionPercentage: 37.5,
      completedSessions: 3,
      remainingSessions: 5,
      xp: 260,
      level: 4,
      streak: 6,
      missedCount: 1,
    });
  });

  it("treats empty analytics arrays as canonical dashboard summaries", () => {
    const statsWithRecentWorkouts = {
      ...baseStats,
      fatigue: {
        chest: {
          current: 31,
          lastUpdated: "2026-02-14T12:00:00.000Z",
        },
      },
      capacities: {
        deadlift: {
          estimated1RM: 180,
          lastWeight: 150,
          lastReps: 5,
          confidence: 0.7,
          lastPerformed: "2026-02-14T07:00:00.000Z",
        },
      },
      progression: {
        totalWorkouts: 2,
        weeklyVolume: 2400,
        lastWorkoutAt: "2026-02-14T12:00:00.000Z",
        weeklySetsByMuscle: {
          chest: 40,
        },
        recentWorkouts: [
          {
            completedAt: "2026-02-14T12:00:00.000Z",
            dayName: "Fallback Day",
            volume: 1300,
          },
        ],
      },
    } as UserStats;

    const emptyAnalytics = {
      ...analyticsReadModel,
      fatigueSummary: { items: [] },
      capacityTimeline: { series: [] },
      weeklyVolume: {
        windowStartedAt: null,
        windowEndedAt: null,
        items: [],
      },
      recentSessions: [],
    };

    const recent = getDashboardRecentWorkouts(emptyAnalytics, statsWithRecentWorkouts, 10);
    expect(recent).toEqual([]);
    expect(dashboardSummary.getFatigueSummary(emptyAnalytics, statsWithRecentWorkouts, 10)).toEqual([]);
    expect(getProgressionTimelineSeries(emptyAnalytics, statsWithRecentWorkouts)).toEqual([]);
    expect(getWeeklyVolumeSummary(emptyAnalytics, statsWithRecentWorkouts)).toEqual([]);
  });

  it("falls back to latest capacity value when no history exists", () => {
    const statsWithSinglePoint = {
      ...baseStats,
      capacities: {
        deadlift: {
          estimated1RM: 180,
          lastWeight: 150,
          lastReps: 5,
          confidence: 0.7,
          lastPerformed: "2026-02-14T07:00:00.000Z",
        },
      },
      progression: {
        ...baseStats.progression,
        totalWorkouts: 1,
      },
    };

    const timeline = getProgressionTimelineSeries(statsWithSinglePoint);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].points).toHaveLength(1);
    expect(timeline[0].points[0]).toMatchObject({
      estimated1RM: 180,
      date: "2026-02-14T07:00:00.000Z",
    });
  });

  it("renders a selectable progression chart without external chart libraries", async () => {
    const user = userEvent.setup();
    const series = [
      {
        exerciseId: "bench_press",
        exerciseLabel: "Bench Press",
        confidence: 0.8,
        points: [
          { date: "2026-02-01T00:00:00.000Z", estimated1RM: 110 },
          { date: "2026-02-14T00:00:00.000Z", estimated1RM: 120 },
        ],
      },
      {
        exerciseId: "back_squat",
        exerciseLabel: "Back Squat",
        confidence: 0.8,
        points: [
          { date: "2026-02-01T00:00:00.000Z", estimated1RM: 150 },
          { date: "2026-02-14T00:00:00.000Z", estimated1RM: 162 },
        ],
      },
    ];

    render(<ProgressionTimelineChart series={series} />);

    expect(
      screen.getByRole("img", {
        name: /Bench Press estimated 1RM over time/i,
      })
    ).toBeTruthy();

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Tracked exercise"), "back_squat");
    });

    expect(
      screen.getByRole("img", {
        name: /Back Squat estimated 1RM over time/i,
      })
    ).toBeTruthy();
  });
});
