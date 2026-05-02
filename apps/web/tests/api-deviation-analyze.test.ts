import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleDeviationAnalyze } from "../src/modules/deviation/service";

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

vi.mock("../src/modules/deviation/service", () => ({
  handleDeviationAnalyze: vi.fn(),
}));

import { POST } from "../app/api/v0/deviation/analyze/route";

const mockedHandleDeviationAnalyze = vi.mocked(handleDeviationAnalyze);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/deviation/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  plannedSession: {
    sessionId: "session-1",
    scheduledAt: "2026-02-14T10:00:00.000Z",
    exercises: [
      {
        exerciseId: 101,
        muscleTargets: { chest: 1 },
        plannedSets: 4,
        plannedLoad: 100,
      },
    ],
  },
  actualSession: {
    completedAt: "2026-02-14T08:00:00.000Z",
    exercises: [
      {
        exerciseId: 101,
        completedSets: 5,
        avgLoad: 105,
      },
    ],
  },
  remainingPlan: [
    {
      sessionId: "remaining-1",
      targetVolumeSets: { chest: 8 },
      intensityMultiplier: 1,
    },
  ],
};

describe("POST /api/v0/deviation/analyze", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleDeviationAnalyze.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleDeviationAnalyze.mockResolvedValue({
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
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleDeviationAnalyze).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ plannedSession: {}, actualSession: {} }));

    expect(response.status).toBe(400);
    expect(mockedHandleDeviationAnalyze).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleDeviationAnalyze).not.toHaveBeenCalled();
  });
});
