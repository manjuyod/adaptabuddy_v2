// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HistoryList } from "@/modules/history/components/HistoryList";
import { HistoryDetail } from "@/modules/history/components/HistoryDetail";
import type { HistoryWorkoutDetail, HistoryWorkoutSummary } from "@adaptabuddy/contracts";

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

describe("history UI", () => {
  it("renders workout history list entries with pagination controls", () => {
    const workouts: HistoryWorkoutSummary[] = [
      {
        id: 101,
        completedAt: "2026-02-14T12:00:00.000Z",
        programName: "Upper Lower",
        dayName: "Upper A",
        durationSeconds: 2700,
        totalVolume: 5400,
        setCount: 12,
      },
    ];

    render(
      <HistoryList
        workouts={workouts}
        page={1}
        pageSize={10}
        total={21}
        totalPages={3}
      />
    );

    expect(screen.getByText("Upper A")).toBeTruthy();
    expect(screen.getByText("Upper Lower")).toBeTruthy();
    expect(screen.getByText(/Page\s*1\s*of\s*3/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toContain(
      "/history?page=2&pageSize=10"
    );
  });

  it("renders empty state when no workouts are available", () => {
    render(
      <HistoryList
        workouts={[]}
        page={1}
        pageSize={10}
        total={0}
        totalPages={0}
      />
    );

    expect(screen.getByText("No workouts found for this filter.")).toBeTruthy();
  });

  it("renders workout detail grouped by exercise with set rows", () => {
    const workout: HistoryWorkoutDetail = {
      id: 88,
      completedAt: "2026-02-14T12:00:00.000Z",
      programName: "Full Body",
      dayName: "Day 1",
      durationSeconds: 3000,
      totalVolume: 6200,
      setCount: 3,
      explanation: {
        sessionOutcomeClassification: "complete_compromised",
        warnings: ["future_choices_tightened"],
        progressionChanges: [
          { exerciseId: "bench-press", action: "maintain", trend: "improving" },
        ],
        xp: {
          xpDelta: 15,
          streakDelta: 1,
          reason: "completed_recommended_session",
        },
        primaryExerciseId: "bench-press",
        touchedBuckets: ["progressionState", "gamificationState"],
      },
      reporting: {
        cyclePlanId: "7",
        classContext: {
          resolvedClassArchetype: "hybrid",
          classPresetId: "classless",
        },
        adherence: {
          xp: 155,
          level: 3,
          adherenceStreak: 7,
          completedSessionCount: 13,
          missedSessionCount: 0,
          lastAdherenceOutcomeClassification: "complete_compromised",
          lastAwardedAt: "2026-02-13T11:10:00.000Z",
        },
        cycleProgress: {
          currentSessionIndex: 3,
          currentMicrocycleIndex: 1,
          totalSessions: 12,
          completedSessions: 1,
          remainingSessions: 11,
          nextSessionIndex: 4,
        },
        progression: {
          totalExercises: 1,
          improvingCount: 1,
          stalledCount: 0,
          regressingCount: 0,
          blockedCount: 0,
          swapRecommendationCount: 0,
          exercises: [
            {
              exerciseId: "bench-press",
              currentAction: "maintain",
              trend: "improving",
              lastSuccessfulLoadWeight: 100,
              lastSuccessfulLoadReps: 5,
              consecutiveSuccessfulCompletions: 2,
              consecutiveStallOrRegressionCount: 0,
              swapRecommendationCount: 0,
              lastSessionOutcomeClassification: "complete_compromised",
              lastCompletedAt: "2026-02-13T11:10:00.000Z",
            },
          ],
        },
      },
      replayReference: {
        traceId: "91",
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed-plan-session-baseline",
        effectiveAt: "2026-02-13T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:reference",
      },
      exercises: [
        {
          exerciseId: 1,
          exerciseName: "Barbell Bench Press",
          sets: [
            { setIndex: 1, weight: 100, reps: 8, rir: 2 },
            { setIndex: 2, weight: 100, reps: 8, rir: 1 },
          ],
        },
        {
          exerciseId: 2,
          exerciseName: "Cable Row",
          sets: [{ setIndex: 1, weight: 70, reps: 12, rir: null }],
        },
      ],
    };

    render(<HistoryDetail workout={workout} />);

    expect(screen.getByText("Workout Summary")).toBeTruthy();
    expect(screen.getByText("Completion Explanation")).toBeTruthy();
    expect(screen.getByText("Complete compromised")).toBeTruthy();
    expect(screen.getByText("Future Choices Tightened")).toBeTruthy();
    expect(screen.getByText("Completed Recommended Session")).toBeTruthy();
    expect(screen.getByText("bench-press: Maintain / Improving")).toBeTruthy();
    expect(screen.getByText("Active Cycle Reporting")).toBeTruthy();
    expect(screen.getByText(/Adherence streak/i)).toBeTruthy();
    expect(screen.getByText("Replay Reference")).toBeTruthy();
    expect(screen.getByText("seed-plan-session-baseline")).toBeTruthy();
    expect(screen.getByText("Barbell Bench Press")).toBeTruthy();
    expect(screen.getByText("Cable Row")).toBeTruthy();
    expect(screen.getByText(/6,?200/)).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText("-")).toBeTruthy();
  });
});
