// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkoutClient } from "../app/(game)/workout/workout-client";
import { LogClient } from "../app/(game)/workout/log/log-client";
import {
  DEFAULT_OPT_INS,
  type PlanSessionExplanationReadModel,
  type UserStats,
} from "@adaptabuddy/contracts";

const mockPush = vi.fn();
const mockFetch = vi.fn();
const mockRouter = { push: mockPush };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const createJsonResponse = (payload: unknown, ok = true) => ({
  ok,
  json: async () => payload,
});

const baseUserStats: UserStats = {
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

const createPlanExplanation = (): PlanSessionExplanationReadModel => ({
  sessionRationale: "Cycle-backed plan balanced push volume with your current progression.",
  recommendedMovementFamily: "upper_push",
  selectedExerciseIds: ["exercise-1", "exercise-2"],
  progressionChanges: [
    {
      exerciseId: "exercise-1",
      action: "overload",
      trend: "improving",
    },
  ],
  scope: {
    ruleId: "scope.active-cycle",
    outcome: "widened",
    resolvedFocus: "upper_push",
    preferredScopeBucket: "push",
    survivingScopeBucket: "upper_push",
    wideningApplied: true,
  },
  filter: {
    ruleId: "filter.constraints",
    outcome: "survived",
    evaluatedCandidateIds: ["candidate-a", "candidate-b"],
    survivingCandidateIds: ["candidate-a"],
    blockedCandidateIds: ["candidate-b"],
  },
  tieBreak: {
    ruleId: "tie_break.seeded",
    outcome: "selected",
    selectedCandidateId: "candidate-a",
    eligibleCandidateIds: ["candidate-a"],
    topScore: 0.92,
    bandWidth: 0.05,
  },
  replayReference: {
    traceId: "trace-1",
    inputHash: "sha256:input",
    outputHash: "sha256:output",
    seedUsed: "cycle-seed-1",
    effectiveAt: "2026-02-13T00:00:00.000Z",
    implementationVersion: "engine-rs-mvp-0",
    policyVersion: "policy-2026-02",
    referenceHash: "sha256:reference",
  },
});

describe("Spec 03 workout UI flow", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
    sessionStorage.clear();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("sends slot swap request with slot id and exclusions", async () => {
    const user = userEvent.setup();

    const initialSession = {
      programDayId: "day-1",
      programDayName: "Upper A",
      seed: "seed-1",
      generatedAt: "2026-02-13T00:00:00.000Z",
      projectedFatigueCost: { chest: 12, back: 10 },
      slots: [
        {
          slotId: "slot-1",
          slotIndex: 0,
          slotType: "main",
          exerciseId: "exercise-1",
          exerciseSlug: "bench-press",
          exerciseName: "Bench Press",
          setsMin: 3,
          setsMax: 3,
          repsMin: 6,
          repsMax: 8,
          restSeconds: 120,
          score: 0.9,
          rationale: "High chest stimulus",
        },
        {
          slotId: "slot-2",
          slotIndex: 1,
          slotType: "accessory",
          exerciseId: "exercise-2",
          exerciseSlug: "lat-pulldown",
          exerciseName: "Lat Pulldown",
          setsMin: 3,
          setsMax: 3,
          repsMin: 8,
          repsMax: 10,
          restSeconds: 90,
          score: 0.8,
          rationale: "Balances push volume",
        },
      ],
    };

    const swappedSession = {
      ...initialSession,
      seed: "seed-2",
      slots: [
        {
          slotId: "slot-2",
          slotIndex: 1,
          slotType: "accessory",
          exerciseId: "exercise-3",
          exerciseSlug: "cable-row",
          exerciseName: "Cable Row",
          setsMin: 3,
          setsMax: 3,
          repsMin: 8,
          repsMax: 10,
          restSeconds: 90,
          score: 0.77,
          rationale: "Alternative pulling pattern",
        },
      ],
      projectedFatigueCost: { back: 11 },
    };

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          evaluation: {
            passed: true,
            warnings: [],
            blockers: [],
            recommendations: [],
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          session: initialSession,
          loadRecommendations: [
            {
              exerciseId: "exercise-1",
              recommendedWeight: 80,
              recommendedReps: 8,
              targetRir: 2,
              reasoning: "Base load",
              isProgression: false,
            },
            {
              exerciseId: "exercise-2",
              recommendedWeight: 55,
              recommendedReps: 10,
              targetRir: 2,
              reasoning: "Base load",
              isProgression: false,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          session: swappedSession,
          loadRecommendations: [
            {
              exerciseId: "exercise-3",
              recommendedWeight: 50,
              recommendedReps: 10,
              targetRir: 2,
              reasoning: "Swap alternative",
              isProgression: false,
            },
          ],
        })
      );

    render(
      <WorkoutClient
        program={{ name: "Power Program", daysPerWeek: 3 }}
        activeProgram={{
          programId: "11111111-1111-1111-1111-111111111111",
          startedAt: "2026-02-01T00:00:00.000Z",
          currentDayIndex: 0,
          currentMicrocycle: 1,
          daysPerWeek: 3,
        }}
        currentDay={{ id: "day-1", name: "Day 1", dayIndex: 0 }}
        userStats={baseUserStats}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /generate workout/i }));
    });

    await screen.findByText("Lat Pulldown");

    const swapButtons = screen.getAllByRole("button", { name: "Swap" });
    await act(async () => {
      await user.click(swapButtons[1]);
    });

    await screen.findByText("Cable Row");
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));

    const swapCall = mockFetch.mock.calls[2];
    const swapPayload = JSON.parse((swapCall[1] as RequestInit).body as string) as {
      slotId: string;
      excludeExerciseIds: string[];
    };

    expect(swapPayload.slotId).toBe("slot-2");
    expect(swapPayload.excludeExerciseIds).toContain("exercise-1");
    expect(swapPayload.excludeExerciseIds).toContain("exercise-2");
  });

  it("renders the cycle-backed session explanation without exposing replay hashes", async () => {
    const user = userEvent.setup();

    const generatedSession = {
      programDayId: "day-1",
      programDayName: "Upper A",
      seed: "seed-17",
      generatedAt: "2026-02-13T00:00:00.000Z",
      projectedFatigueCost: { chest: 12 },
      slots: [
        {
          slotId: "slot-1",
          slotIndex: 0,
          slotType: "main",
          exerciseId: "exercise-1",
          exerciseSlug: "bench-press",
          exerciseName: "Bench Press",
          setsMin: 3,
          setsMax: 3,
          repsMin: 6,
          repsMax: 8,
          restSeconds: 120,
          score: 0.9,
          rationale: "High chest stimulus",
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          evaluation: {
            passed: true,
            warnings: [],
            blockers: [],
            recommendations: [],
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          session: generatedSession,
          loadRecommendations: [],
          explanation: createPlanExplanation(),
        })
      );

    render(
      <WorkoutClient
        program={{ name: "Power Program", daysPerWeek: 3 }}
        activeProgram={{
          programId: "11111111-1111-1111-1111-111111111111",
          startedAt: "2026-02-01T00:00:00.000Z",
          currentDayIndex: 0,
          currentMicrocycle: 1,
          daysPerWeek: 3,
        }}
        currentDay={{ id: "day-1", name: "Day 1", dayIndex: 0 }}
        userStats={baseUserStats}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /generate workout/i }));
    });

    expect(await screen.findByText("Why this session")).toBeTruthy();
    expect(
      screen.getByText("Cycle-backed plan balanced push volume with your current progression.")
    ).toBeTruthy();
    expect(screen.getByText("Upper Push")).toBeTruthy();
    expect(screen.getByText("Scope widened to upper push")).toBeTruthy();
    expect(screen.getByText("1 of 2 candidates survived filtering")).toBeTruthy();
    expect(screen.getByText("exercise-1: Overload / Improving")).toBeTruthy();
    expect(screen.queryByText("sha256:input")).toBeNull();
    expect(screen.queryByText("sha256:output")).toBeNull();
  });

  it("shows loading state, supports retry after generation failure, and sends cookie-auth requests", async () => {
    const user = userEvent.setup();

    let resolveGenerate:
      | ((value: { ok: boolean; json: () => Promise<unknown> }) => void)
      | undefined;
    const pendingGenerate = new Promise<{ ok: boolean; json: () => Promise<unknown> }>(
      (resolve) => {
        resolveGenerate = resolve;
      }
    );

    const generatedSession = {
      programDayId: "day-1",
      programDayName: "Upper A",
      seed: "seed-3",
      generatedAt: "2026-02-13T00:00:00.000Z",
      projectedFatigueCost: { chest: 12 },
      slots: [
        {
          slotId: "slot-1",
          slotIndex: 0,
          slotType: "main",
          exerciseId: "exercise-1",
          exerciseSlug: "bench-press",
          exerciseName: "Bench Press",
          setsMin: 3,
          setsMax: 3,
          repsMin: 6,
          repsMax: 8,
          restSeconds: 120,
          score: 0.9,
          rationale: "High chest stimulus",
        },
      ],
    };

    mockFetch
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          evaluation: {
            passed: true,
            warnings: [],
            blockers: [],
            recommendations: [],
          },
        })
      )
      .mockImplementationOnce(() => pendingGenerate as unknown as Promise<Response>)
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          evaluation: {
            passed: true,
            warnings: [],
            blockers: [],
            recommendations: [],
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          status: "success",
          session: generatedSession,
          loadRecommendations: [
            {
              exerciseId: "exercise-1",
              recommendedWeight: 80,
              recommendedReps: 8,
              targetRir: 2,
              reasoning: "Base load",
              isProgression: false,
            },
          ],
        })
      );

    render(
      <WorkoutClient
        program={{ name: "Power Program", daysPerWeek: 3 }}
        activeProgram={{
          programId: "11111111-1111-1111-1111-111111111111",
          startedAt: "2026-02-01T00:00:00.000Z",
          currentDayIndex: 0,
          currentMicrocycle: 1,
          daysPerWeek: 3,
        }}
        currentDay={{ id: "day-1", name: "Day 1", dayIndex: 0 }}
        userStats={baseUserStats}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /generate workout/i }));
    });

    expect(document.querySelector(".animate-pulse")).toBeTruthy();

    await act(async () => {
      resolveGenerate?.(
        createJsonResponse(
          {
            status: "error",
            errors: ["Generation failed"],
          },
          false
        )
      );
    });

    expect((await screen.findAllByText("Generation failed")).length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Retry" }));
    });

    await screen.findByText("Bench Press");
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));

    expect(mockFetch.mock.calls[0][0]).toBe("/api/v0/guardrails/evaluate");
    expect(mockFetch.mock.calls[1][0]).toBe("/api/v0/sessions/generate");
    expect(mockFetch.mock.calls[2][0]).toBe("/api/v0/guardrails/evaluate");
    expect(mockFetch.mock.calls[3][0]).toBe("/api/v0/sessions/generate");

    const credentialModes = mockFetch.mock.calls.map(
      (call) => (call[1] as RequestInit).credentials
    );
    expect(credentialModes).toEqual(["include", "include", "include", "include"]);
  });

  it("handles offline generation gracefully without network calls", async () => {
    const user = userEvent.setup();

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(
      <WorkoutClient
        program={{ name: "Power Program", daysPerWeek: 3 }}
        activeProgram={{
          programId: "11111111-1111-1111-1111-111111111111",
          startedAt: "2026-02-01T00:00:00.000Z",
          currentDayIndex: 0,
          currentMicrocycle: 1,
          daysPerWeek: 3,
        }}
        currentDay={{ id: "day-1", name: "Day 1", dayIndex: 0 }}
        userStats={baseUserStats}
      />
    );

    await screen.findByText(
      "You are offline. Session generation, swap, and completion sync require a connection."
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /generate workout/i }));
    });

    expect(
      (await screen.findAllByText("You appear to be offline. Reconnect and retry.")).length
    ).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(0);
  });

  it("handles tap-complete, rest timer, undo, and submit payload", async () => {
    const user = userEvent.setup();

    sessionStorage.setItem(
      "workoutSession",
      JSON.stringify({
        programName: "Power Program",
        dayName: "Day 1",
        loadRecommendations: [
          {
            exerciseId: "exercise-1",
            recommendedWeight: 50,
            recommendedReps: 8,
            targetRir: 2,
            reasoning: "Base load",
            isProgression: false,
          },
        ],
        session: {
          programDayId: "day-1",
          programDayName: "Upper A",
          seed: "seed-1",
          generatedAt: "2026-02-13T00:00:00.000Z",
          projectedFatigueCost: { chest: 10 },
          slots: [
            {
              slotId: "slot-1",
              slotIndex: 0,
              slotType: "main",
              exerciseId: "exercise-1",
              exerciseSlug: "bench-press",
              exerciseName: "Bench Press",
              setsMin: 2,
              setsMax: 2,
              repsMin: 8,
              repsMax: 8,
              restSeconds: 90,
              score: 0.8,
              rationale: "Main lift",
            },
          ],
        },
      })
    );

    mockFetch.mockResolvedValueOnce(
      createJsonResponse({ status: "success", message: "Session completed successfully" })
    );

    render(<LogClient />);
    await screen.findByText("Bench Press");

    const markDoneButtons = screen.getAllByRole("button", { name: "Mark Done" });
    await act(async () => {
      await user.click(markDoneButtons[0]);
    });

    expect(screen.getByText("01:30")).toBeTruthy();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Undo Last" }));
    });

    expect(screen.getAllByRole("button", { name: "Mark Done" }).length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getAllByRole("button", { name: "Mark Done" })[0]);
    });

    await act(async () => {
      await user.click(screen.getAllByRole("button", { name: "Complete Workout" })[0]);
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const submitPayload = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      exercises: Array<{
        sets: Array<{ setIndex: number; weight: number; reps: number; rir: number | null }>;
      }>;
    };

    expect(submitPayload.exercises[0].sets).toHaveLength(1);
    expect(submitPayload.exercises[0].sets[0]).toMatchObject({
      setIndex: 0,
      weight: 50,
      reps: 8,
      rir: 2,
    });
  });
});
