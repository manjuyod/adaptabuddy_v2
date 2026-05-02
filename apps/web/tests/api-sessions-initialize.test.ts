import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInitializeCycle } from "../src/modules/cycles/service";

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
  handleInitializeCycle: vi.fn(),
}));

import { POST } from "../app/api/v0/sessions/initialize/route";

const mockedHandleInitializeCycle = vi.mocked(handleInitializeCycle);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/sessions/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  classPresetId: "classless",
  goalBias: "strength",
  availableDaysPerWeek: 3,
  fatiguePreference: "moderate",
  injuryMuscleGroupSlugs: ["shoulders"],
  macrocycleWeeks: 8,
  selectedPrograms: [
    { programId: 2001, weight: 0.7 },
    { programId: 2002, weight: 0.3 },
  ],
};

describe("POST /api/v0/sessions/initialize", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleInitializeCycle.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleInitializeCycle.mockResolvedValue({
      status: "success",
      planId: "plan-1",
      resolvedClassArchetype: "hybrid",
      primaryProgramId: "2001",
      totalSessions: 24,
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleInitializeCycle).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ classPresetId: "classless" }));

    expect(response.status).toBe(400);
    expect(mockedHandleInitializeCycle).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-selectable class preset before service execution", async () => {
    const response = await POST(
      createRequest({
        ...validBody,
        classPresetId: "monk",
      })
    );

    expect(response.status).toBe(400);
    expect(mockedHandleInitializeCycle).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleInitializeCycle).not.toHaveBeenCalled();
  });
});
