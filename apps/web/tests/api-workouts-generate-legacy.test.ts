import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGenerateWorkout } from "../src/modules/workouts/service";
import { rateLimit } from "../src/lib/security/rateLimit";

const routeContext = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  ip: "127.0.0.1",
  requestId: "legacy-req-1",
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
      const normalized = name.toLowerCase();
      if (normalized === "x-forwarded-for") {
        return routeContext.ip;
      }
      if (normalized === "x-request-id") {
        return routeContext.requestId;
      }
      return null;
    },
  }),
}));

vi.mock("../src/lib/supabase/server", () => ({
  getClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: routeContext.userId ? { id: routeContext.userId } : null },
        error: null,
      }),
      getSession: async () => ({
        data: { session: routeContext.userId ? { user: { id: routeContext.userId } } : null },
      }),
    },
  }),
}));

vi.mock("../src/lib/security/rateLimit", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("../src/modules/workouts/service", () => ({
  handleGenerateWorkout: vi.fn(),
}));

import { POST } from "../app/api/v0/workouts/generate/route";

const mockedRateLimit = vi.mocked(rateLimit);
const mockedHandleGenerateWorkout = vi.mocked(handleGenerateWorkout);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/workouts/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("legacy workouts generate route", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.requestId = "legacy-req-1";
    mockedRateLimit.mockReset();
    mockedHandleGenerateWorkout.mockReset();
    mockedRateLimit.mockResolvedValue({
      success: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });
  });

  it("keeps legacy response shape and adds deprecation headers", async () => {
    mockedHandleGenerateWorkout.mockReturnValue({
      status: "no_solution",
      debug: { seed: 1, selected_ids: [], rejected: [] },
      errors: ["Request payload failed validation."],
    });

    const response = await POST(createRequest({ goals: ["strength"] }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("legacy-req-1");
    expect(response.headers.get("Deprecation")).toBe("true");
    expect(response.headers.get("Sunset")).toBeTruthy();
    expect(response.headers.get("Link")).toContain("/api/v0/sessions/generate");
    expect(mockedHandleGenerateWorkout).toHaveBeenCalledWith({ goals: ["strength"] });
  });

  it("returns legacy 429 body", async () => {
    mockedRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });

    const response = await POST(createRequest({}));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Rate limit exceeded" });
  });

  it("returns legacy 401 body", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest({}));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
