// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { DEFAULT_OPT_INS, type DeterministicAnalyticsReadModel, type UserStats } from "@adaptabuddy/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const userId = "11111111-1111-1111-1111-111111111111";

const stats = {
  activeProgram: null,
  fatigue: {
    chest: {
      current: 92,
      lastUpdated: "2026-04-01T00:00:00.000Z",
    },
    back: {
      current: 88,
      lastUpdated: "2026-04-01T00:00:00.000Z",
    },
  },
  mastery: {},
  capacities: {
    bench_press: {
      estimated1RM: 220,
      lastWeight: 200,
      lastReps: 5,
      confidence: 0.9,
      lastPerformed: "2026-04-01T00:00:00.000Z",
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
  preferences: {
    fatigueLevel: "moderate",
    equipment: [],
    injuries: [],
    acknowledgedRisks: [],
    optIns: { ...DEFAULT_OPT_INS },
  },
} as UserStats;

const analytics = {
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
        current: 18,
        severity: "low",
      },
      {
        muscle: "back",
        current: 9,
        severity: "low",
      },
    ],
  },
  capacityTimeline: {
    series: [
      {
        exerciseId: "101",
        exerciseLabel: "Analytics Bench",
        confidence: null,
        points: [
          {
            date: "2026-04-14T10:00:00.000Z",
            estimated1RM: 120,
          },
        ],
      },
    ],
  },
  weeklyVolume: {
    windowStartedAt: "2026-04-17T10:00:00.000Z",
    windowEndedAt: "2026-04-23T10:00:00.000Z",
    items: [
      {
        muscle: "chest",
        sets: 4,
      },
      {
        muscle: "back",
        sets: 2,
      },
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

const mockGetRecentWorkoutHistory = vi.fn();
const mockGetDeterministicAnalyticsReadModel = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
}));

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerComponentClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: userId,
            email: "user@example.com",
          },
        },
      }),
    },
    from: (table: string) => {
      if (table !== "users") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                stats_json: stats,
              },
            }),
          }),
        }),
      };
    },
  }),
}));

vi.mock("../src/modules/programs/service", () => ({
  getUserActiveCycleView: async () => ({
    activeCycleView: {
      source: "normalized",
      status: "active",
      programId: "2001",
      startedAt: "2026-04-01T00:00:00.000Z",
      daysPerWeek: 4,
      currentDayIndex: 1,
      currentMicrocycle: 1,
      programDayId: "301",
      programDayName: "Upper A",
      classPresetId: "classless",
      resolvedClassArchetype: "hybrid",
    },
  }),
  getProgramById: async () => ({
    program: {
      name: "Upper Lower",
    },
  }),
}));

vi.mock("../src/modules/sessions/service", () => ({
  getRecentWorkoutHistory: (...args: unknown[]) => mockGetRecentWorkoutHistory(...args),
}));

vi.mock("../src/modules/reporting/service", () => ({
  getDeterministicAnalyticsReadModel: (...args: unknown[]) =>
    mockGetDeterministicAnalyticsReadModel(...args),
}));

import DashboardPage from "../app/(game)/dashboard/page";

describe("dashboard analytics migration", () => {
  beforeEach(() => {
    mockGetRecentWorkoutHistory.mockReset();
    mockGetDeterministicAnalyticsReadModel.mockReset();
    mockGetRecentWorkoutHistory.mockRejectedValue(new Error("dashboard must use analytics"));
    mockGetDeterministicAnalyticsReadModel.mockResolvedValue(analytics);
  });

  it("renders dashboard progress from deterministic analytics without direct recent-history queries", async () => {
    const page = await DashboardPage();
    render(page);

    expect(mockGetDeterministicAnalyticsReadModel).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      { recentSessionLimit: 10 }
    );
    expect(mockGetRecentWorkoutHistory).not.toHaveBeenCalled();
    expect(screen.getByText("Cycle 3 / 8")).toBeTruthy();
    expect(screen.getByText("37.5% complete")).toBeTruthy();
    expect(screen.getByText("Level 4 · 260 XP")).toBeTruthy();
    expect(screen.getByText("Streak 6 · Missed 1")).toBeTruthy();
    expect(screen.getByText("Normalized Upper")).toBeTruthy();
    expect(screen.getByText(/18%/)).toBeTruthy();
    expect(screen.getByText(/9%/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Analytics Bench estimated 1RM over time/i })).toBeTruthy();
    expect(screen.getByText("4.0 sets")).toBeTruthy();
    expect(screen.queryByText("Stale Stats Day")).toBeNull();
  });

  it("does not render stats_json weekly volume when analytics weekly volume is canonical empty", async () => {
    mockGetDeterministicAnalyticsReadModel.mockResolvedValue({
      ...analytics,
      weeklyVolume: {
        windowStartedAt: null,
        windowEndedAt: null,
        items: [],
      },
    });

    const page = await DashboardPage();
    render(page);

    expect(screen.getByText("Detailed per-muscle volume is not available yet.")).toBeTruthy();
    expect(screen.queryByText(/9,999/)).toBeNull();
    expect(screen.queryByText(/Total weekly volume/)).toBeNull();
  });
});
