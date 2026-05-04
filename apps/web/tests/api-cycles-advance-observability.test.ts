import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAdvanceCycle } from "../src/modules/cycles/service";
import { logServerEvent } from "../src/lib/observability/logger";
import { rateLimit } from "../src/lib/security/rateLimit";

const routeContext = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  authError: null as { message: string } | null,
  ip: "127.0.0.1",
  requestId: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get() { return undefined; }, set() {}, delete() {} }),
  headers: async () => ({
    get(name: string) {
      const normalized = name.toLowerCase();
      if (normalized === "x-forwarded-for") return routeContext.ip;
      if (normalized === "x-request-id") return routeContext.requestId;
      return null;
    },
  }),
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

vi.mock("../src/lib/security/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("../src/modules/cycles/service", () => ({ handleAdvanceCycle: vi.fn() }));
vi.mock("../src/lib/observability/logger", () => ({ logServerEvent: vi.fn() }));

import { POST } from "../app/api/v0/cycles/advance/route";

const mockedHandleAdvanceCycle = vi.mocked(handleAdvanceCycle);
const mockedLogServerEvent = vi.mocked(logServerEvent);
const mockedRateLimit = vi.mocked(rateLimit);

const createRequest = (body: unknown, requestId?: string) =>
  new Request("http://localhost/api/v0/cycles/advance", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
    body: JSON.stringify(body),
  });

const successResponse = {
  status: "success" as const,
  planId: "1",
  seasonIndex: 1,
  seasonRank: "A" as const,
  rankBreakdown: {
    adherenceScore: 100,
    qualityScore: 86,
    progressionScore: 80,
    recoveryScore: 80,
    consistencyScore: 90,
    constraintModifier: 0,
    finalScore: 87,
    rank: "A" as const,
  },
  awardedXp: 120,
  awards: [{ id: "season-clear", label: "Season Clear", reason: "Completed", xp: 120 }],
  seasonSummary: {
    planId: "1",
    seasonIndex: 1,
    completedSessions: 2,
    missedSessions: 0,
    totalSessions: 2,
    completionRate: 1,
    progressionTrend: "improving" as const,
    recoveryStatus: "recoverable" as const,
  },
  nextCycleRequest: {
    classPresetId: "bb" as const,
    goalBias: "balanced" as const,
    availableDaysPerWeek: 4,
    fatiguePreference: "moderate" as const,
    injuryMuscleGroupSlugs: [],
    macrocycleWeeks: 12,
    selectedPrograms: [{ programId: 2001, weight: 1 }],
  },
  nextCyclePreview: {
    rankEffect: "maintain_direction",
    programBlendDirection: "balanced",
    difficultyAdjustment: 0,
    recoveryAdjustment: 0,
    unlockEligibility: [],
    constraintNotes: [],
  },
  transitionId: "99",
  replayReceipt: { inputHash: "sha256:input", outputHash: "sha256:output" },
};

describe("api cycles advance observability", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    routeContext.requestId = null;
    mockedHandleAdvanceCycle.mockReset();
    mockedLogServerEvent.mockReset();
    mockedRateLimit.mockReset();
    mockedRateLimit.mockResolvedValue({
      success: true,
      remaining: 10,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });
  });

  it("echoes request id and logs success", async () => {
    routeContext.requestId = "advance-req-1";
    mockedHandleAdvanceCycle.mockResolvedValue(successResponse);

    const response = await POST(
      createRequest({ planId: "1", idempotencyKey: "advance-1" }, "advance-req-1")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("advance-req-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/v0/cycles/advance",
        reason: "request_completed",
        requestId: "advance-req-1",
        statusCode: 200,
      })
    );
  });

  it("logs rate-limited requests", async () => {
    routeContext.requestId = "advance-rate-1";
    mockedRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: "postgres",
    });

    const response = await POST(
      createRequest({ planId: "1", idempotencyKey: "advance-1" }, "advance-rate-1")
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("x-request-id")).toBe("advance-rate-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/v0/cycles/advance",
        reason: "rate_limited",
        requestId: "advance-rate-1",
        statusCode: 429,
      })
    );
  });
});
