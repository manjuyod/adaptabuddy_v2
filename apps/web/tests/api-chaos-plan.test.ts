import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleChaosPlan } from "../src/modules/chaos/service";

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

vi.mock("../src/modules/chaos/service", () => ({
  handleChaosPlan: vi.fn(),
}));

import { POST } from "../app/api/v0/chaos/plan/route";

const mockedHandleChaosPlan = vi.mocked(handleChaosPlan);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/chaos/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  templateIds: [1, 2],
  weeks: 1,
  daysPerWeek: 2,
  seed: "seed-1",
  mode: "rotate" as const,
};

describe("POST /api/v0/chaos/plan", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleChaosPlan.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleChaosPlan.mockResolvedValue({
      status: "success",
      plan: {
        seed: "seed-1",
        weeks: 1,
        daysPerWeek: 2,
        sessions: [
          {
            weekNumber: 1,
            dayIndex: 0,
            templateId: "1",
            templateName: "A",
            sourceDayIndex: 0,
          },
        ],
      },
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleChaosPlan).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ templateIds: [], weeks: 0, daysPerWeek: 0 }));

    expect(response.status).toBe(400);
    expect(mockedHandleChaosPlan).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleChaosPlan).not.toHaveBeenCalled();
  });
});
