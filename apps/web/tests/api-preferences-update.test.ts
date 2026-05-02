import { beforeEach, describe, expect, it, vi } from "vitest";
import { handlePreferencesUpdate } from "../src/modules/settings/service";

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

vi.mock("../src/modules/settings/service", () => ({
  handlePreferencesUpdate: vi.fn(),
}));

import { POST } from "../app/api/v0/preferences/update/route";

const mockedHandlePreferencesUpdate = vi.mocked(handlePreferencesUpdate);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/preferences/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  fatigueLevel: "hard",
  equipment: ["barbell", "dumbbell"],
  injuries: ["left_shoulder"],
  display: {
    unitSystem: "lbs",
    theme: "system",
  },
};

describe("POST /api/v0/preferences/update", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandlePreferencesUpdate.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandlePreferencesUpdate.mockResolvedValue({
      status: "success",
      preferences: {
        fatigueLevel: "hard",
        equipment: ["barbell", "dumbbell"],
        injuries: ["left_shoulder"],
        unitSystem: "lbs",
        theme: "system",
      },
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandlePreferencesUpdate).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    expect(mockedHandlePreferencesUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandlePreferencesUpdate).not.toHaveBeenCalled();
  });
});
