import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitBetaFeedback } from "../src/modules/support/service";

const routeContext = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  authError: null as { message: string } | null,
  ip: "127.0.0.1",
  requestId: "support-feedback-request-1",
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
      if (name.toLowerCase() === "x-request-id") {
        return routeContext.requestId;
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

vi.mock("../src/modules/support/service", () => ({
  submitBetaFeedback: vi.fn(),
}));

import { POST } from "../app/api/v0/support/feedback/route";

const mockedSubmitBetaFeedback = vi.mocked(submitBetaFeedback);

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/v0/support/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  category: "bug",
  boundaryArea: "app-shell",
  severity: "high",
  title: "Navigation freeze",
  summary: "Navigation fails after opening workout detail.",
};

describe("POST /api/v0/support/feedback", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    routeContext.requestId = "support-feedback-request-1";
    mockedSubmitBetaFeedback.mockReset();
  });

  it("returns 200 for a valid request", async () => {
    mockedSubmitBetaFeedback.mockResolvedValue({ status: "success", reportId: 9001 });

    const response = await POST(createRequest(validBody));

    const data = (await response.json()) as { status: string; reportId: number };
    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "success", reportId: 9001 });
    expect(mockedSubmitBetaFeedback).toHaveBeenCalledWith(
      "user-1",
      validBody,
      "support-feedback-request-1"
    );
  });

  it("returns 400 for invalid payloads", async () => {
    const response = await POST(createRequest({ title: "too little" }));

    expect(response.status).toBe(400);
    expect(mockedSubmitBetaFeedback).not.toHaveBeenCalled();
  });

  it("returns 401 when auth is missing", async () => {
    routeContext.userId = null;

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    expect(mockedSubmitBetaFeedback).not.toHaveBeenCalled();
  });

  it("returns 500 for service error responses", async () => {
    mockedSubmitBetaFeedback.mockResolvedValue({
      status: "error",
      errors: ["Failed to submit feedback"],
    });

    const response = await POST(createRequest(validBody));
    const data = (await response.json()) as { status: string; errors: string[] };

    expect(response.status).toBe(500);
    expect(data.status).toBe("error");
    expect(data.errors).toEqual(["Failed to submit feedback"]);
  });
});
