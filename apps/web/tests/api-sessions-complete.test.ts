import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCompleteSession } from "../src/modules/sessions/service";

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

import { POST } from "../app/api/v0/sessions/complete/route";

const mockedHandleCompleteSession = vi.mocked(handleCompleteSession);

const createRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/v0/sessions/complete", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const validBody = {
  programDayId: "day-1",
  seed: "seed-1",
  startedAt: "2026-02-13T12:00:00.000Z",
  completedAt: "2026-02-13T12:45:00.000Z",
  exercises: [
    {
      slotId: "slot-1",
      exerciseId: "exercise-1",
      sets: [{ setIndex: 0, weight: 100, reps: 5, rir: 2 }],
    },
  ],
  overallRpe: 7,
};

describe("POST /api/v0/sessions/complete", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleCompleteSession.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleCompleteSession.mockResolvedValue({
      status: "success",
      message: "ok",
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleCompleteSession).toHaveBeenCalledWith(
      "user-1",
      validBody,
      expect.objectContaining({
        route: "/api/v0/sessions/complete",
      })
    );
  });

  it("forwards idempotency-key header into handleCompleteSession options", async () => {
    mockedHandleCompleteSession.mockResolvedValue({
      status: "success",
      message: "ok",
    });

    const response = await POST(
      createRequest(validBody, { "idempotency-key": "completion-dup-key-1" })
    );

    expect(response.status).toBe(200);
    expect(mockedHandleCompleteSession).toHaveBeenCalledWith(
      "user-1",
      validBody,
      expect.objectContaining({
        route: "/api/v0/sessions/complete",
        idempotencyKey: "completion-dup-key-1",
      })
    );
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ seed: "seed-1" }));

    expect(response.status).toBe(400);
    expect(mockedHandleCompleteSession).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleCompleteSession).not.toHaveBeenCalled();
  });
});
