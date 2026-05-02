import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleProgressionRecommend } from "../src/modules/progression/service";

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

vi.mock("../src/modules/progression/service", () => ({
  handleProgressionRecommend: vi.fn(),
}));

import { GET } from "../app/api/v0/progression/recommend/route";

const mockedHandleProgressionRecommend = vi.mocked(handleProgressionRecommend);

const createRequest = (url: string) =>
  new Request(url, {
    method: "GET",
  });

describe("GET /api/v0/progression/recommend", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleProgressionRecommend.mockReset();
  });

  it("returns 200 for valid query params", async () => {
    mockedHandleProgressionRecommend.mockResolvedValue({
      status: "success",
      recommendations: [],
    });

    const response = await GET(
      createRequest(
        "http://localhost/api/v0/progression/recommend?exerciseIds=1,2&repsMin=6&repsMax=8"
      )
    );

    expect(response.status).toBe(200);
    expect(mockedHandleProgressionRecommend).toHaveBeenCalledWith("user-1", {
      exerciseIds: ["1", "2"],
      repsMin: 6,
      repsMax: 8,
    });
  });

  it("returns 400 for invalid query params", async () => {
    const response = await GET(
      createRequest("http://localhost/api/v0/progression/recommend?repsMin=0&repsMax=8")
    );

    expect(response.status).toBe(400);
    expect(mockedHandleProgressionRecommend).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await GET(
      createRequest("http://localhost/api/v0/progression/recommend?exerciseIds=1&repsMin=6&repsMax=8")
    );

    expect(response.status).toBe(401);
    expect(mockedHandleProgressionRecommend).not.toHaveBeenCalled();
  });
});
