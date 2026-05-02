import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleGuardrailEvaluate } from "../src/modules/guardrails/service";

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

vi.mock("../src/modules/guardrails/service", () => ({
  handleGuardrailEvaluate: vi.fn(),
}));

import { POST } from "../app/api/v0/guardrails/evaluate/route";

const mockedHandleGuardrailEvaluate = vi.mocked(handleGuardrailEvaluate);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/guardrails/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  action: "session_generate" as const,
  trainingAge: "intermediate" as const,
};

describe("POST /api/v0/guardrails/evaluate", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedHandleGuardrailEvaluate.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedHandleGuardrailEvaluate.mockResolvedValue({
      status: "success",
      evaluation: {
        passed: true,
        warnings: [],
        blockers: [],
        recommendations: [],
      },
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mockedHandleGuardrailEvaluate).toHaveBeenCalledWith("user-1", validBody);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(createRequest({ action: "not-a-real-action" }));

    expect(response.status).toBe(400);
    expect(mockedHandleGuardrailEvaluate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedHandleGuardrailEvaluate).not.toHaveBeenCalled();
  });
});
