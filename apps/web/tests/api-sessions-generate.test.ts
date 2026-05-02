import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGenerateSession } from "../src/modules/sessions/service";

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

vi.mock("../src/modules/sessions/service", () => ({
  handleGenerateSession: vi.fn(),
  handleCompleteSession: vi.fn(),
}));

import { POST } from "../app/api/v0/sessions/generate/route";

const mockedHandleGenerateSession = vi.mocked(handleGenerateSession);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/sessions/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/v0/sessions/generate", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleGenerateSession.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleGenerateSession.mockResolvedValue({
      status: "success",
      session: undefined,
      loadRecommendations: [],
    });

    const response = await POST(createRequest({ programDayId: 1, seed: "seed-1" }));

    expect(response.status).toBe(200);
    expect(mockedHandleGenerateSession).toHaveBeenCalledWith("user-1", {
      programDayId: 1,
      seed: "seed-1",
    });
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ seed: "seed-1" }));

    expect(response.status).toBe(400);
    expect(mockedHandleGenerateSession).not.toHaveBeenCalled();
  });

  it("accepts slot swap payload", async () => {
    mockedHandleGenerateSession.mockResolvedValue({
      status: "success",
      session: undefined,
      loadRecommendations: [],
    });

    const response = await POST(
      createRequest({
        programDayId: 1,
        slotId: 2,
        excludeExerciseIds: [10, "11"],
      })
    );

    expect(response.status).toBe(200);
    expect(mockedHandleGenerateSession).toHaveBeenCalledWith("user-1", {
      programDayId: 1,
      slotId: 2,
      excludeExerciseIds: [10, "11"],
    });
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest({ programDayId: 1 }));

    expect(response.status).toBe(401);
    expect(mockedHandleGenerateSession).not.toHaveBeenCalled();
  });
});
