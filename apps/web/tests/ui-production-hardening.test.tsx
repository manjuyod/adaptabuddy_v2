// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import RootError from "../app/error";
import GameError from "../app/(game)/error";
import NotFoundPage from "../app/not-found";
import DashboardLoading from "../app/(game)/dashboard/loading";
import WorkoutLoading from "../app/(game)/workout/loading";
import ProgramsLoading from "../app/(game)/programs/loading";
import HistoryLoading from "../app/(game)/history/loading";
import SettingsLoading from "../app/(game)/settings/loading";
import { NavigationBar } from "../src/components/NavigationBar";

const navigationContext = vi.hoisted(() => ({
  pathname: "/dashboard"
}));

const healthContext = vi.hoisted(() => ({
  probeError: null as { code?: string; message?: string } | null,
  throwProbe: false
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    usePathname: () => navigationContext.pathname
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        limit: async () => {
          if (healthContext.throwProbe) {
            throw new Error("network error");
          }
          return { data: null, error: healthContext.probeError };
        }
      })
    })
  })
}));

let healthGet: null | ((request: Request) => Promise<Response>) = null;

const loadHealthGet = async () => {
  if (!healthGet) {
    const route = await import("../app/api/health/route");
    healthGet = route.GET;
  }
  return healthGet;
};

beforeAll(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigationContext.pathname = "/dashboard";
  healthContext.probeError = null;
  healthContext.throwProbe = false;
});

describe("spec 12 production hardening UI", () => {
  it("renders root error boundary and retry control", async () => {
    const reset = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RootError error={new Error("root failure")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "AdaptaBuddy hit a critical fault." })).toBeTruthy();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    retryButton.click();
    expect(reset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
  });

  it("renders game error boundary with back-to-dashboard action", async () => {
    const reset = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<GameError error={new Error("game failure")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Unable to load this screen" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Dashboard" }).getAttribute("href")).toBe(
      "/dashboard"
    );
    const retryButton = screen.getByRole("button", { name: "Retry" });
    retryButton.click();
    expect(reset).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
  });

  it("renders branded not-found page", () => {
    render(<NotFoundPage />);

    expect(screen.getByRole("heading", { name: "Route not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Dashboard" }).getAttribute("href")).toBe(
      "/dashboard"
    );
  });

  it("renders route loading skeletons", () => {
    render(
      <>
        <DashboardLoading />
        <WorkoutLoading />
        <ProgramsLoading />
        <HistoryLoading />
        <SettingsLoading />
      </>
    );

    expect(screen.getByTestId("dashboard-loading-skeleton")).toBeTruthy();
    expect(screen.getByTestId("workout-loading-skeleton")).toBeTruthy();
    expect(screen.getByTestId("programs-loading-skeleton")).toBeTruthy();
    expect(screen.getByTestId("history-loading-skeleton")).toBeTruthy();
    expect(screen.getByTestId("settings-loading-skeleton")).toBeTruthy();
  });

  it("renders shared navigation and highlights the active route", () => {
    navigationContext.pathname = "/workout/log";
    render(<NavigationBar />);

    for (const label of ["Dashboard", "Workout", "Programs", "History", "Settings"]) {
      expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    }

    const activeWorkoutLinks = screen.getAllByRole("link", { name: "Workout" });
    activeWorkoutLinks.forEach((link) => {
      expect(link.getAttribute("data-active")).toBe("true");
    });

    const inactiveHistoryLinks = screen.getAllByRole("link", { name: "History" });
    inactiveHistoryLinks.forEach((link) => {
      expect(link.getAttribute("data-active")).toBe("false");
    });
  });
});

describe("spec 12 health endpoint", () => {
  it("returns connected when supabase probe succeeds", async () => {
    const GET = await loadHealthGet();
    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: {
          "x-request-id": "health-check-1",
        },
      })
    );
    const body = (await response.json()) as {
      status: string;
      timestamp: string;
      supabase: "connected" | "error";
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.supabase).toBe("connected");
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("health-check-1");
  });

  it("returns error when supabase probe reports an error", async () => {
    healthContext.probeError = { code: "PGRST301", message: "invalid key" };

    const GET = await loadHealthGet();
    const response = await GET(new Request("http://localhost/api/health"));
    const body = (await response.json()) as { supabase: "connected" | "error" };

    expect(body.supabase).toBe("error");
  });

  it("treats permission-denied probe as connected", async () => {
    healthContext.probeError = { code: "42501", message: "permission denied" };

    const GET = await loadHealthGet();
    const response = await GET(new Request("http://localhost/api/health"));
    const body = (await response.json()) as { supabase: "connected" | "error" };

    expect(body.supabase).toBe("connected");
  });
});
