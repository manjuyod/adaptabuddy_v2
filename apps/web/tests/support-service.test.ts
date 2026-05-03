import { describe, expect, it, vi } from "vitest";
import type { BetaFeedbackSubmitRequest } from "@adaptabuddy/contracts";
import { submitBetaFeedback } from "../src/modules/support/service";
import { createMockSupabase } from "./helpers/mockSupabase";

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

describe("submitBetaFeedback service", () => {
  it("persists required fields and returns reportId", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const store = {
      users: [{ id: userId }],
      beta_feedback_reports: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);

    const result = await submitBetaFeedback(
      userId,
      {
        category: "performance",
        boundaryArea: "deterministic-engine-behavior",
        severity: "critical",
        title: "Engine jitter",
        summary: "Session planning stutters on slow network.",
      },
      "feedback-request-1"
    );

    expect(result).toEqual({ status: "success", reportId: 1 });
    expect(store.beta_feedback_reports).toHaveLength(1);

    const row = store.beta_feedback_reports[0] as Record<string, unknown>;
    expect(row.user_id).toBe(userId);
    expect(row.category).toBe("performance");
    expect(row.boundary_area).toBe("deterministic-engine-behavior");
    expect(row.severity).toBe("critical");
    expect(row.status).toBe("open");
    expect(row.title).toBe("Engine jitter");
    expect(row.summary).toBe("Session planning stutters on slow network.");
    expect(row.current_route).toBeNull();
    expect(row.request_id).toBe("feedback-request-1");
    expect(row.replay_reference).toEqual({});
    expect(row.client_context).toEqual({});
  });

  it("normalizes optional fields and sanitizes client context", async () => {
    const userId = "22222222-2222-2222-2222-222222222222";
    const store = {
      users: [{ id: userId }],
      beta_feedback_reports: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);

    const inputWithUnsafeContext = {
      category: "workflow_pain",
      boundaryArea: "adapter-contract",
      severity: "medium",
      title: "Auth contract friction",
      summary: "Need clearer contract mismatch messaging.",
      currentRoute: "/settings/support",
      requestId: "req-42",
      replayReference: { trace: "replay-77", version: 3 },
      diagnosticConsent: true,
      clientContext: {
        route: "/settings/support",
        viewportWidth: 390,
        viewportHeight: 720,
        online: false,
        userAgent: "BrowserX",
        authToken: "do-not-store",
      },
    } as unknown as BetaFeedbackSubmitRequest;

    const result = await submitBetaFeedback(userId, inputWithUnsafeContext, "server-req-42");

    expect(result).toEqual({ status: "success", reportId: 1 });
    const row = store.beta_feedback_reports[0] as Record<string, unknown>;

    expect(row.current_route).toBe("/settings/support");
    expect(row.request_id).toBe("server-req-42");
    expect(row.replay_reference).toMatchObject({ trace: "replay-77", version: 3 });

    expect(row.client_context).toEqual({
      viewportWidth: 390,
      viewportHeight: 720,
      online: false,
      userAgent: "BrowserX",
    });
  });

  it("returns a structured error on persistence failures without leaking request body", async () => {
    const userId = "33333333-3333-3333-3333-333333333333";
    const store = {
      users: [{ id: userId }],
      beta_feedback_reports: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store, {
      mutationFailures: {
        beta_feedback_reports: {
          insert: {
            message: "forced persistence failure for security audit",
            code: "23514",
          },
        },
      },
    });

    const result = await submitBetaFeedback(
      userId,
      {
        category: "other",
        boundaryArea: "unknown",
        severity: "low",
        title: "Needs improvement",
        summary: "Detailed body that should never leak to user-facing errors.",
      },
      "feedback-request-error"
    );

    expect(result).toEqual({ status: "error", errors: ["Failed to submit feedback"] });
    expect(store.beta_feedback_reports).toHaveLength(0);
  });
});
