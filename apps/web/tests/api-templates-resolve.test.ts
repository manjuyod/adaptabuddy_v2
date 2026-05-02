import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleResolveTemplate } from "../src/modules/templates/service";

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

vi.mock("../src/modules/templates/service", () => ({
  handleResolveTemplate: vi.fn(),
}));

import { POST } from "../app/api/v0/templates/resolve/route";

const mockedHandleResolveTemplate = vi.mocked(handleResolveTemplate);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/templates/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  templateId: 1,
  weekNumber: 1,
  dayNumber: 0,
};

describe("POST /api/v0/templates/resolve", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleResolveTemplate.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleResolveTemplate.mockResolvedValue({
      status: "success",
      sessionRequirement: {
        templateId: "template-1",
        dayIndex: 0,
        name: "Day 1",
        intensityTarget: "moderate",
        volumeMultiplier: 1,
        slots: [
          {
            slotType: "main",
            muscleTargets: { chest: 1 },
            setsMin: 3,
            setsMax: 3,
            repsMin: 5,
            repsMax: 5,
            tags: [],
          },
        ],
      },
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleResolveTemplate).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ weekNumber: 1 }));

    expect(response.status).toBe(400);
    expect(mockedHandleResolveTemplate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleResolveTemplate).not.toHaveBeenCalled();
  });
});
