import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS } from "@adaptabuddy/contracts";
import { handleOptInUpdate } from "../src/modules/optins/service";

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

vi.mock("../src/modules/optins/service", () => ({
  handleOptInUpdate: vi.fn(),
}));

import { POST } from "../app/api/v0/optins/update/route";

const mockedHandleOptInUpdate = vi.mocked(handleOptInUpdate);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/optins/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  optIns: { ...DEFAULT_OPT_INS, allowExtremeVolume: true },
  acknowledgedRisks: ["risk-1"],
};

describe("POST /api/v0/optins/update", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleOptInUpdate.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleOptInUpdate.mockResolvedValue({
      status: "success",
      optIns: { ...DEFAULT_OPT_INS, allowExtremeVolume: true },
      acknowledgedRisks: ["risk-1"],
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleOptInUpdate).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({}));

    expect(response.status).toBe(400);
    expect(mockedHandleOptInUpdate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleOptInUpdate).not.toHaveBeenCalled();
  });
});
