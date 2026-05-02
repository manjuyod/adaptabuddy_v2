import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleVolumeAllocate } from "../src/modules/volume/service";

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

vi.mock("../src/modules/volume/service", () => ({
  handleVolumeAllocate: vi.fn(),
}));

import { POST } from "../app/api/v0/volume/allocate/route";

const mockedHandleVolumeAllocate = vi.mocked(handleVolumeAllocate);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/volume/allocate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  totalSets: 12,
  musclePriorities: { chest: 1, back: 1 },
  trainingAge: "intermediate" as const,
};

describe("POST /api/v0/volume/allocate", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleVolumeAllocate.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleVolumeAllocate.mockResolvedValue({
      status: "success",
      allocation: {
        allocations: { chest: 6, back: 6 },
        totalAllocated: 12,
        remainingSets: 0,
        cappedByMRV: [],
      },
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleVolumeAllocate).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ totalSets: -1, musclePriorities: {} }));

    expect(response.status).toBe(400);
    expect(mockedHandleVolumeAllocate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleVolumeAllocate).not.toHaveBeenCalled();
  });
});
