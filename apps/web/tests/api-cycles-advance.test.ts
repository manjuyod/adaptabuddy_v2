import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAdvanceCycle } from "../src/modules/cycles/service";

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

vi.mock("../src/modules/cycles/service", () => ({
  handleAdvanceCycle: vi.fn(),
}));

import { POST } from "../app/api/v0/cycles/advance/route";

const mockedHandleAdvanceCycle = vi.mocked(handleAdvanceCycle);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/cycles/advance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  planId: "1",
  idempotencyKey: "advance-1",
};

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

describe("POST /api/v0/cycles/advance", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleAdvanceCycle.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleAdvanceCycle.mockResolvedValue(successResponse);

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleAdvanceCycle).toHaveBeenCalledWith(
      "user-1",
      validBody,
      expect.objectContaining({
        route: "/api/v0/cycles/advance",
      })
    );
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(createRequest({ completionRate: 0.8 }));

    expect(response.status).toBe(400);
    expect(mockedHandleAdvanceCycle).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleAdvanceCycle).not.toHaveBeenCalled();
  });
});
