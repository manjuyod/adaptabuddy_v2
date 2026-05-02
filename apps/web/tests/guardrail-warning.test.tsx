// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkoutClient } from "../app/(game)/workout/workout-client";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

describe("WorkoutClient guardrails", () => {
  it("surfaces warnings and requires acknowledgment", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "success",
        evaluation: {
          passed: true,
          warnings: [
            {
              id: "performance-decline",
              severity: "warning",
              category: "performance",
              title: "Performance decline",
              description: "Performance has declined.",
              impact: "Recovery risk.",
              mitigation: "Schedule deload.",
            },
          ],
          blockers: [],
          recommendations: [],
        },
      }),
    });

    const userStats: UserStats = {
      activeProgram: null,
      fatigue: {},
      mastery: {},
      capacities: {},
      progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    render(
      <WorkoutClient
        program={{ name: "Test Program", daysPerWeek: 3 }}
        activeProgram={{
          programId: "11111111-1111-1111-1111-111111111111",
          startedAt: "2026-02-01T00:00:00.000Z",
          currentDayIndex: 0,
          currentMicrocycle: 1,
          daysPerWeek: 3,
        }}
        currentDay={{ id: "day-1", name: "Day 1", dayIndex: 0 }}
        userStats={userStats}
      />
    );

    const generateButton = screen.getByRole("button", { name: /generate workout/i });
    await act(async () => {
      await user.click(generateButton);
    });

    expect(await screen.findByTestId("guardrail-panel")).toBeTruthy();
    expect(screen.queryByTestId("guardrail-proceed")).toBeNull();

    const ack = screen.getByTestId("guardrail-ack-performance-decline");
    await act(async () => {
      await user.click(ack);
    });

    expect(await screen.findByTestId("guardrail-proceed")).toBeTruthy();
  });
});
