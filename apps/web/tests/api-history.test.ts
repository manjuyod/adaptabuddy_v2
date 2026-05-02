import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { getWorkoutDetail, getWorkoutHistory } from "../src/modules/history/service";

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

vi.mock("../src/modules/history/service", () => ({
  getWorkoutHistory: vi.fn(),
  getWorkoutDetail: vi.fn(),
}));

import { GET as GET_HISTORY_LIST } from "../app/api/v0/history/list/route";
import { GET as GET_HISTORY_DETAIL } from "../app/api/v0/history/[workoutId]/route";

const mockedGetWorkoutHistory = vi.mocked(getWorkoutHistory);
const mockedGetWorkoutDetail = vi.mocked(getWorkoutDetail);
const asNextRequest = (url: string) =>
  new Request(url, { method: "GET" }) as unknown as NextRequest;

describe("history routes", () => {
  beforeEach(() => {
    routeContext.userId = "user-1";
    routeContext.authError = null;
    routeContext.ip = "127.0.0.1";
    mockedGetWorkoutHistory.mockReset();
    mockedGetWorkoutDetail.mockReset();
  });

  it("returns 200 for a valid history list request", async () => {
    mockedGetWorkoutHistory.mockResolvedValue({
      status: "success",
      page: 2,
      pageSize: 5,
      total: 7,
      totalPages: 2,
      workouts: [],
    });

    const response = await GET_HISTORY_LIST(
      new Request("http://localhost/api/v0/history/list?page=2&pageSize=5", { method: "GET" })
    );

    expect(response.status).toBe(200);
    expect(mockedGetWorkoutHistory).toHaveBeenCalledWith("user-1", {
      page: 2,
      pageSize: 5,
    });
  });

  it("returns 400 for invalid history list query", async () => {
    const response = await GET_HISTORY_LIST(
      new Request("http://localhost/api/v0/history/list?page=0", { method: "GET" })
    );

    expect(response.status).toBe(400);
    expect(mockedGetWorkoutHistory).not.toHaveBeenCalled();
  });

  it("returns 401 for unauthenticated history list request", async () => {
    routeContext.userId = null;

    const response = await GET_HISTORY_LIST(
      new Request("http://localhost/api/v0/history/list", { method: "GET" })
    );

    expect(response.status).toBe(401);
    expect(mockedGetWorkoutHistory).not.toHaveBeenCalled();
  });

  it("returns 200 for a valid history detail request", async () => {
    mockedGetWorkoutDetail.mockResolvedValue({
      status: "success",
      workout: {
        id: 42,
        completedAt: "2026-02-14T12:00:00.000Z",
        programName: "Upper Lower",
        dayName: "Upper A",
        durationSeconds: 2700,
        totalVolume: 5400,
        setCount: 12,
        exercises: [],
        explanation: null,
        reporting: null,
        replayReference: null,
      },
    });

    const response = await GET_HISTORY_DETAIL(
      asNextRequest("http://localhost/api/v0/history/42"),
      { params: Promise.resolve({ workoutId: "42" }) }
    );

    expect(response.status).toBe(200);
    expect(mockedGetWorkoutDetail).toHaveBeenCalledWith("user-1", 42);
  });

  it("returns 400 for invalid history detail params", async () => {
    const response = await GET_HISTORY_DETAIL(
      asNextRequest("http://localhost/api/v0/history/not-a-number"),
      { params: Promise.resolve({ workoutId: "not-a-number" }) }
    );

    expect(response.status).toBe(400);
    expect(mockedGetWorkoutDetail).not.toHaveBeenCalled();
  });

  it("returns 404 when history detail is missing", async () => {
    mockedGetWorkoutDetail.mockResolvedValue({
      status: "error",
      errors: ["Workout not found"],
    });

    const response = await GET_HISTORY_DETAIL(
      asNextRequest("http://localhost/api/v0/history/999"),
      { params: Promise.resolve({ workoutId: "999" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns 401 for unauthenticated history detail request", async () => {
    routeContext.userId = null;

    const response = await GET_HISTORY_DETAIL(
      asNextRequest("http://localhost/api/v0/history/1"),
      { params: Promise.resolve({ workoutId: "1" }) }
    );

    expect(response.status).toBe(401);
    expect(mockedGetWorkoutDetail).not.toHaveBeenCalled();
  });
});
