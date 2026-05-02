import { beforeEach, describe, expect, it, vi } from "vitest";

const routeContext = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  authError: null as { message: string } | null,
  ip: "127.0.0.1",
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get() {
      return undefined;
    },
    set() {},
    delete() {},
  }),
  headers: async () => ({
    get(name: string) {
      if (name.toLowerCase() === "x-forwarded-for") {
        return routeContext.ip;
      }
      return null;
    },
  }),
}));

vi.mock("../src/lib/security/rateLimit", () => ({
  rateLimit: () => ({ success: true }),
}));

vi.mock("../src/lib/supabase/server", () => ({
  getClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: routeContext.userId ? { id: routeContext.userId } : null },
        error: routeContext.authError,
      }),
    },
  }),
}));

vi.mock("../src/modules/reporting/service", () => ({
  getActiveCycleReporting: vi.fn(),
  getDeterministicAnalyticsReadModel: vi.fn(),
}));

import {
  getActiveCycleReporting,
  getDeterministicAnalyticsReadModel,
} from "../src/modules/reporting/service";
import { GET as GET_ACTIVE_CYCLE_REPORTING } from "../app/api/v0/reporting/active-cycle/route";
import { GET as GET_ANALYTICS_REPORTING } from "../app/api/v0/reporting/analytics/route";

const mockedGetActiveCycleReporting = vi.mocked(getActiveCycleReporting);
const mockedGetDeterministicAnalyticsReadModel = vi.mocked(
  getDeterministicAnalyticsReadModel
);

const analyticsReadModel = {
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
    lastOutcome: "complete_compromised" as const,
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
        action: "maintain" as const,
        trend: "improving" as const,
        swapRecommendationCount: 0,
        lastOutcome: "complete_compromised" as const,
        lastCompletedAt: "2026-02-13T11:10:00.000Z",
      },
    ],
  },
  fatigueSummary: {
    items: [{ muscle: "chest", current: 20, severity: "low" as const }],
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

describe("reporting routes", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedGetActiveCycleReporting.mockReset();
    mockedGetDeterministicAnalyticsReadModel.mockReset();
  });

  it("returns 200 with the active-cycle reporting read model", async () => {
    mockedGetActiveCycleReporting.mockResolvedValue({
      cyclePlanId: "7",
      classContext: {
        resolvedClassArchetype: "hybrid",
        classPresetId: "classless",
      },
      adherence: {
        xp: 155,
        level: 3,
        adherenceStreak: 7,
        completedSessionCount: 13,
        missedSessionCount: 0,
        lastAdherenceOutcomeClassification: "complete_compromised",
        lastAwardedAt: "2026-02-13T11:10:00.000Z",
      },
      cycleProgress: {
        currentSessionIndex: 3,
        currentMicrocycleIndex: 1,
        totalSessions: 12,
        completedSessions: 4,
        remainingSessions: 8,
        nextSessionIndex: 4,
      },
      progression: {
        totalExercises: 1,
        improvingCount: 1,
        stalledCount: 0,
        regressingCount: 0,
        blockedCount: 0,
        swapRecommendationCount: 0,
        exercises: [
          {
            exerciseId: "bench-press",
            currentAction: "maintain",
            trend: "improving",
            lastSuccessfulLoadWeight: 100,
            lastSuccessfulLoadReps: 5,
            consecutiveSuccessfulCompletions: 2,
            consecutiveStallOrRegressionCount: 0,
            swapRecommendationCount: 0,
            lastSessionOutcomeClassification: "complete_compromised",
            lastCompletedAt: "2026-02-13T11:10:00.000Z",
          },
        ],
      },
    });

    const response = await GET_ACTIVE_CYCLE_REPORTING(
      new Request("http://localhost/api/v0/reporting/active-cycle", { method: "GET" })
    );

    expect(response.status).toBe(200);
    expect(mockedGetActiveCycleReporting).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("returns 401 for unauthenticated reporting requests", async () => {
    routeContext.userId = null;

    const response = await GET_ACTIVE_CYCLE_REPORTING(
      new Request("http://localhost/api/v0/reporting/active-cycle", { method: "GET" })
    );

    expect(response.status).toBe(401);
    expect(mockedGetActiveCycleReporting).not.toHaveBeenCalled();
  });

  it("returns 200 with deterministic analytics for authenticated users", async () => {
    mockedGetDeterministicAnalyticsReadModel.mockResolvedValue(analyticsReadModel);

    const response = await GET_ANALYTICS_REPORTING(
      new Request("http://localhost/api/v0/reporting/analytics", { method: "GET" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      status: "success",
      availability: "available",
      analytics: analyticsReadModel,
    });
    expect(mockedGetDeterministicAnalyticsReadModel).toHaveBeenCalledWith(
      expect.anything(),
      "user-1"
    );
  });

  it("returns 401 for unauthenticated analytics requests", async () => {
    routeContext.userId = null;

    const response = await GET_ANALYTICS_REPORTING(
      new Request("http://localhost/api/v0/reporting/analytics", { method: "GET" })
    );

    expect(response.status).toBe(401);
    expect(mockedGetDeterministicAnalyticsReadModel).not.toHaveBeenCalled();
  });

  it("returns an unavailable analytics state when normalized data is missing", async () => {
    mockedGetDeterministicAnalyticsReadModel.mockResolvedValue(null);

    const response = await GET_ANALYTICS_REPORTING(
      new Request("http://localhost/api/v0/reporting/analytics", { method: "GET" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      availability: "unavailable",
      analytics: null,
    });
  });

  it("rejects unknown analytics query parameters", async () => {
    const response = await GET_ANALYTICS_REPORTING(
      new Request("http://localhost/api/v0/reporting/analytics?planId=7", {
        method: "GET",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.status).toBe("error");
    expect(mockedGetDeterministicAnalyticsReadModel).not.toHaveBeenCalled();
  });
});
