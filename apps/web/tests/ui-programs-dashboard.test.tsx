// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import type { ActiveCycleView, ProgramCatalogItem } from "@/modules/programs/contracts";
import { ProgramsClient } from "../app/(game)/programs/programs-client";
import {
  getFatigueSummary,
  getRecentWorkoutSummary,
} from "../src/modules/dashboard/summary";
import { activateProgramAction } from "@/modules/programs/actions";

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
  ),
}));

vi.mock("@/modules/programs/actions", () => ({
  activateProgramAction: vi.fn(),
}));

const mockedActivateProgramAction = vi.mocked(activateProgramAction);

const programs: ProgramCatalogItem[] = [
  {
    id: 1,
    slug: "upper-lower",
    name: "Upper Lower",
    description: "Balanced hypertrophy split",
    default_days_per_week: 4,
    min_days_per_week: 3,
    max_days_per_week: 5,
    is_active: true,
    muscleCoverage: [
      { muscle: "chest", score: 3.4 },
      { muscle: "back", score: 3.1 },
    ],
    days: [
      {
        id: 10,
        dayIndex: 0,
        name: "Upper A",
        slots: [
          {
            id: 101,
            slotIndex: 0,
            slotType: "main",
            setsMin: 3,
            setsMax: 4,
            repsMin: 5,
            repsMax: 8,
            muscleTargets: { chest: 1, triceps: 0.4 },
          },
        ],
      },
    ],
  },
  {
    id: 2,
    slug: "full-body",
    name: "Full Body",
    description: "Simple full body progression",
    default_days_per_week: 3,
    min_days_per_week: 3,
    max_days_per_week: 4,
    is_active: true,
    muscleCoverage: [{ muscle: "quads", score: 2.8 }],
    days: [],
  },
];

const baseStats: UserStats = {
  activeProgram: null,
  fatigue: {},
  mastery: {},
  capacities: {},
  progression: { totalWorkouts: 3, weeklyVolume: 1800, lastWorkoutAt: null },
  preferences: {
    fatigueLevel: "moderate",
    equipment: [],
    injuries: [],
    acknowledgedRisks: [],
    optIns: { ...DEFAULT_OPT_INS },
  },
};

describe("Spec 04 programs and dashboard UI", () => {
  beforeEach(() => {
    mockedActivateProgramAction.mockReset();
  });

  it("renders program details and muscle coverage when expanded", async () => {
    const user = userEvent.setup();

    render(
      <ProgramsClient
        programs={programs}
        activeProgram={null}
      />
    );

    expect(screen.getAllByText("Muscle Coverage").length).toBeGreaterThan(0);
    expect(screen.getByText("Upper Lower")).toBeTruthy();

    await act(async () => {
      await user.click(screen.getAllByRole("button", { name: "View Details" })[0]);
    });

    expect(screen.getByText("Day 1: Upper A")).toBeTruthy();
    expect(screen.getByText("Slot 1 · main")).toBeTruthy();
    expect(screen.getByText(/Targets: Chest, Triceps/i)).toBeTruthy();
  });

  it("requires confirmation before activating a program", async () => {
    const user = userEvent.setup();

    mockedActivateProgramAction.mockResolvedValue({
      success: true,
      activeProgram: {
        programId: "2",
        startedAt: "2026-02-14T00:00:00.000Z",
        currentDayIndex: 0,
        currentMicrocycle: 1,
        daysPerWeek: 3,
      },
    });

    const confirmSpy = vi.spyOn(window, "confirm");
    confirmSpy.mockReturnValueOnce(false);

    render(
      <ProgramsClient
        programs={programs}
        activeProgram={null}
      />
    );

    await act(async () => {
      await user.click(screen.getAllByRole("button", { name: "Activate Program" })[0]);
    });
    expect(confirmSpy).toHaveBeenCalledWith("Switch to this program?");
    expect(mockedActivateProgramAction).toHaveBeenCalledTimes(0);

    confirmSpy.mockReturnValueOnce(true);
    await act(async () => {
      await user.click(screen.getAllByRole("button", { name: "Activate Program" })[0]);
    });

    await waitFor(() => expect(mockedActivateProgramAction).toHaveBeenCalledTimes(1));
    expect(mockedActivateProgramAction).toHaveBeenCalledWith(1);
  });

  it("blocks manual activation while a normalized cycle remains authoritative", async () => {
    const user = userEvent.setup();
    const activeCycleView: ActiveCycleView = {
      source: "normalized",
      status: "completed",
      programId: "2",
      startedAt: "2026-03-01T00:00:00.000Z",
      daysPerWeek: 3,
      currentDayIndex: null,
      currentMicrocycle: null,
      programDayId: null,
      programDayName: null,
      classPresetId: "classless",
      resolvedClassArchetype: "hybrid",
    };

    render(
      <ProgramsClient
        programs={programs}
        activeCycleView={activeCycleView}
      />
    );

    const activateButtons = screen.getAllByRole("button", { name: "Activate Program" });
    expect((activateButtons[0] as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      await user.click(activateButtons[0]);
    });

    expect(mockedActivateProgramAction).not.toHaveBeenCalled();
  });

  it("builds fatigue and recent workout summaries from stats_json data", () => {
    const statsWithData = {
      ...baseStats,
      fatigue: {
        chest: { current: 78, lastUpdated: "2026-02-14T10:00:00.000Z" },
        back: { current: 52, lastUpdated: "2026-02-14T10:00:00.000Z" },
      },
      progression: {
        totalWorkouts: 10,
        weeklyVolume: 4200,
        lastWorkoutAt: "2026-02-14T12:00:00.000Z",
        recentWorkouts: [
          {
            completedAt: "2026-02-12T12:00:00.000Z",
            dayName: "Lower B",
            volume: 1300,
          },
          {
            completedAt: "2026-02-14T12:00:00.000Z",
            dayName: "Upper A",
            volume: 1500,
          },
        ],
      },
    } as UserStats;

    const fatigue = getFatigueSummary(statsWithData);
    expect(fatigue[0]).toMatchObject({ muscle: "chest", severity: "high" });
    expect(fatigue[1]).toMatchObject({ muscle: "back", severity: "moderate" });

    const recent = getRecentWorkoutSummary(statsWithData);
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ dayName: "Upper A", volume: 1500 });
    expect(recent[1]).toMatchObject({ dayName: "Lower B", volume: 1300 });
  });
});
