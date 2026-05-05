import { describe, expect, it } from "vitest";
import {
  AdvanceCycleRequestSchema,
  AdvanceCycleResponseSchema,
  NextCyclePreviewSchema,
  SeasonAwardSchema,
  SeasonRankSchema,
  SeasonSummarySchema,
} from "../src/cycles";

describe("advance cycle contract schemas", () => {
  it("accepts valid request payload", () => {
    const parsed = AdvanceCycleRequestSchema.parse({
      planId: "42",
      idempotencyKey: "advance-plan-42",
      currentCycleRequest: {
        classPresetId: "powa",
        goalBias: "strength",
        availableDaysPerWeek: 3,
        fatiguePreference: "high",
        injuryMuscleGroupSlugs: ["quads"],
        macrocycleWeeks: 8,
        selectedPrograms: [
          { programId: 2001, weight: 0.5 },
          { programId: 2002, weight: 0.3 },
          { programId: 2003, weight: 0.2 },
        ],
      },
      programAdaptationInputs: {
        challengeBaselines: {
          push_up: { maxReps: 20 },
        },
        strengthBaselines: {
          squat: { estimatedOneRepMax: 225, unit: "lbs" },
          deadlift: { estimatedOneRepMax: 225, unit: "lbs" },
          bench_press: { estimatedOneRepMax: 100, unit: "lbs" },
          overhead_press: { estimatedOneRepMax: 75, unit: "lbs" },
        },
      },
      completedSessionCount: 18,
      missedSessionCount: 0,
    });

    expect(parsed.planId).toBe("42");
    expect(parsed.currentCycleRequest?.selectedPrograms).toHaveLength(3);
    expect(parsed.programAdaptationInputs?.challengeBaselines?.push_up?.maxReps).toBe(20);
    expect(parsed.completedSessionCount).toBe(18);
  });

  it("rejects client supplied season facts", () => {
    const parsed = AdvanceCycleRequestSchema.safeParse({
      planId: "42",
      seasonIndex: 1,
      completionRate: 0.95,
      focus: "strength",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts rank, award, preview, and season summary models", () => {
    expect(SeasonRankSchema.parse("S")).toBe("S");
    expect(
      SeasonAwardSchema.parse({
        id: "season-clear",
        label: "Season Clear",
        reason: "Completed every planned session",
        xp: 120,
      })
    ).toMatchObject({ id: "season-clear" });
    expect(
      NextCyclePreviewSchema.parse({
        rankEffect: "increase_difficulty",
        programBlendDirection: "strength",
        difficultyAdjustment: 1,
        recoveryAdjustment: 0,
        unlockEligibility: ["advanced-blend"],
        constraintNotes: [],
      })
    ).toMatchObject({ difficultyAdjustment: 1 });
    expect(
      SeasonSummarySchema.parse({
        planId: "42",
        seasonIndex: 3,
        completedSessions: 10,
        missedSessions: 1,
        totalSessions: 12,
        completionRate: 0.83,
        progressionTrend: "improving",
        recoveryStatus: "recoverable",
      })
    ).toMatchObject({ totalSessions: 12 });
  });

  it("accepts success response with next cycle request", () => {
    const parsed = AdvanceCycleResponseSchema.parse({
      status: "success",
      planId: "42",
      seasonIndex: 3,
      seasonRank: "A",
      rankBreakdown: {
        adherenceScore: 84,
        qualityScore: 80,
        progressionScore: 76,
        recoveryScore: 88,
        consistencyScore: 82,
        constraintModifier: 0,
        finalScore: 82,
        rank: "A",
      },
      awardedXp: 125,
      awards: [
        {
          id: "steady-season",
          label: "Steady Season",
          reason: "Strong season adherence",
          xp: 125,
        },
      ],
      seasonSummary: {
        planId: "42",
        seasonIndex: 3,
        completedSessions: 10,
        missedSessions: 1,
        totalSessions: 12,
        completionRate: 0.83,
        progressionTrend: "improving",
        recoveryStatus: "recoverable",
      },
      nextCycleRequest: {
        classPresetId: "bb",
        goalBias: "balanced",
        availableDaysPerWeek: 4,
        fatiguePreference: "moderate",
        selectedPrograms: [{ programId: 2001, weight: 1 }],
      },
      nextCyclePreview: {
        rankEffect: "maintain_direction",
        programBlendDirection: "balanced",
        difficultyAdjustment: 0,
        recoveryAdjustment: 0,
        unlockEligibility: [],
        constraintNotes: [],
      },
      transitionId: "99",
      replayReceipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
      },
    });

    expect(parsed.status).toBe("success");
  });
});
