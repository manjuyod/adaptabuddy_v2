import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGenerateSession } from "../src/modules/sessions/service";
import { logServerEvent } from "../src/lib/observability/logger";
import { rateLimit } from "../src/lib/security/rateLimit";

const routeContext = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  authError: null as { message: string } | null,
  ip: "127.0.0.1",
  requestId: null as string | null,
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
        error: routeContext.authError,
      }),
      getSession: async () => ({
        data: {
          session: routeContext.userId ? { user: { id: routeContext.userId } } : null,
        },
      }),
    },
  }),
}));

vi.mock("../src/lib/security/rateLimit", () => ({
  rateLimit: vi.fn(),
}));

vi.mock("../src/modules/sessions/service", () => ({
  handleGenerateSession: vi.fn(),
  handleCompleteSession: vi.fn(),
}));

vi.mock("../src/lib/observability/logger", () => ({
  logServerEvent: vi.fn(),
}));

import { POST } from "../app/api/v0/sessions/generate/route";

const mockedHandleGenerateSession = vi.mocked(handleGenerateSession);
const mockedLogServerEvent = vi.mocked(logServerEvent);
const mockedRateLimit = vi.mocked(rateLimit);

const createRequest = (body: unknown, requestId?: string) =>
  new Request("http://localhost/api/v0/sessions/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
    body: JSON.stringify(body),
  });

describe("api observability wiring", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    routeContext.requestId = null;
    mockedHandleGenerateSession.mockReset();
    mockedLogServerEvent.mockReset();
    mockedRateLimit.mockReset();
    mockedRateLimit.mockResolvedValue({
      success: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      source: "memory",
    });
  });

  it("echoes x-request-id and logs success", async () => {
    routeContext.requestId = "req-success-1";
    mockedHandleGenerateSession.mockResolvedValue({
      status: "success",
      session: undefined,
      loadRecommendations: [],
    });

    const response = await POST(createRequest({ programDayId: 1, seed: "seed-1" }, "req-success-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-success-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/v0/sessions/generate",
        reason: "request_completed",
        severity: "info",
        requestId: "req-success-1",
        statusCode: 200,
      })
    );
  });

  it("logs validation failures", async () => {
    routeContext.requestId = "req-validation-1";

    const response = await POST(createRequest({ seed: "missing-program-day" }, "req-validation-1"));

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("req-validation-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "validation_failed",
        severity: "warn",
        statusCode: 400,
      })
    );
  });

  it("logs unauthorized requests", async () => {
    routeContext.userId = null;
    routeContext.requestId = "req-unauth-1";

    const response = await POST(createRequest({ programDayId: 1 }, "req-unauth-1"));

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("req-unauth-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "unauthorized",
        severity: "warn",
        statusCode: 401,
      })
    );
  });

  it("logs rate limit rejections", async () => {
    routeContext.requestId = "req-rate-1";
    mockedRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: "postgres",
    });

    const response = await POST(createRequest({ programDayId: 1 }, "req-rate-1"));

    expect(response.status).toBe(429);
    expect(response.headers.get("x-request-id")).toBe("req-rate-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "rate_limited",
        severity: "warn",
        statusCode: 429,
      })
    );
  });

  it("logs unexpected exceptions", async () => {
    routeContext.requestId = "req-throw-1";
    mockedHandleGenerateSession.mockRejectedValue(new Error("boom"));

    const response = await POST(createRequest({ programDayId: 1 }, "req-throw-1"));

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("req-throw-1");
    expect(mockedLogServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "unexpected_error",
        severity: "error",
        statusCode: 500,
      })
    );
  });
});
