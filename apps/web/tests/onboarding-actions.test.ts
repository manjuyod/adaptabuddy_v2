import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OPT_INS,
  type InitializeCycleResponse,
  type UserStats,
} from "@adaptabuddy/contracts";
import { completeOnboarding } from "@/modules/onboarding/actions";
import { handleInitializeCycle } from "@/modules/cycles/service";

const context = vi.hoisted(() => ({
  userId: "11111111-1111-1111-1111-111111111111",
  authError: null as { message: string } | null,
  initializeResult: {
    status: "success",
    planId: "20",
    resolvedClassArchetype: "hybrid",
    primaryProgramId: "2",
    totalSessions: 1,
  } as InitializeCycleResponse,
  userRows: [] as Array<UserStats | null>,
  selectErrors: [] as Array<{ message: string } | null>,
  selectCall: 0,
  selectError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updatePayload: null as Record<string, unknown> | null,
}));

const defaultStats = (): UserStats => ({
  activeProgram: null,
  fatigue: {},
  mastery: {},
  capacities: {},
  progression: {
    totalWorkouts: 0,
    weeklyVolume: 0,
    lastWorkoutAt: null,
  },
  preferences: {
    fatigueLevel: "moderate",
    equipment: [],
    injuries: [],
    acknowledgedRisks: [],
    optIns: { ...DEFAULT_OPT_INS },
  },
});

const mockFrom = vi.fn((table: string) => {
  if (table !== "users") {
    throw new Error(`Unexpected table ${table}`);
  }

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => {
          const rowIndex = context.selectCall;
          context.selectCall += 1;
          const stats = context.userRows[rowIndex] ?? null;
          return {
            data: { stats_json: stats },
            error: context.selectErrors[rowIndex] ?? context.selectError,
          };
        }),
      })),
    })),
    update: vi.fn((payload: Record<string, unknown>) => {
      context.updatePayload = payload;
      return {
        eq: vi.fn(async () => ({
          error: context.updateError,
        })),
      };
    }),
  };
});

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: context.userId ? { id: context.userId } : null },
      error: context.authError,
    })),
  },
  from: mockFrom,
};

vi.mock("@/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => null,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/modules/cycles/service", () => ({
  handleInitializeCycle: vi.fn(),
}));

const mockedHandleInitializeCycle = vi.mocked(handleInitializeCycle);

describe("completeOnboarding", () => {
  beforeEach(() => {
    context.userId = "11111111-1111-1111-1111-111111111111";
    context.authError = null;
    context.initializeResult = {
      status: "success",
      planId: "20",
      resolvedClassArchetype: "hybrid",
      primaryProgramId: "2",
      totalSessions: 1,
    };
    context.userRows = [
      {
        ...defaultStats(),
        activeProgram: {
          programId: "11",
          startedAt: new Date().toISOString(),
          currentDayIndex: 1,
          currentMicrocycle: 2,
          daysPerWeek: 4,
        },
      },
    ];
    context.selectErrors = [];
    context.selectError = null;
    context.selectCall = 0;
    context.updateError = null;
    context.updatePayload = null;
    mockedHandleInitializeCycle.mockReset();
    mockedHandleInitializeCycle.mockResolvedValue(context.initializeResult);
    vi.clearAllMocks();
  });

  const baseInput = {
    equipment: ["Barbell", "Dumbbell"],
    fatiguePreference: "moderate" as const,
    unitSystem: "lbs" as const,
    classPresetId: "classless" as const,
    goalBias: "strength" as const,
    availableDaysPerWeek: 4,
    injuryMuscleGroupSlugs: ["Shoulder", "Lower_Back"],
    macrocycleWeeks: 8,
    selectedPrograms: [
      { programId: 2, weight: 70 },
      { programId: 3, weight: 30 },
    ],
  };

  it("initializes a cycle and merges onboarding preferences from projection", async () => {
    const result = await completeOnboarding(baseInput);

    expect(result).toEqual({ status: "success" });
    expect(context.selectCall).toBe(1);
    expect(mockedHandleInitializeCycle).toHaveBeenCalledWith(context.userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 4,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulder", "lower_back"],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 2, weight: 0.7 },
        { programId: 3, weight: 0.3 },
      ],
    });

    expect(context.updatePayload?.has_save).toBe(true);
    const nextStats = context.updatePayload?.stats_json as UserStats;
    expect(nextStats.activeProgram).toEqual({
      programId: "11",
      startedAt: expect.any(String) as string,
      currentDayIndex: 1,
      currentMicrocycle: 2,
      daysPerWeek: 4,
    });
    expect(nextStats.preferences.fatigueLevel).toBe("moderate");
    expect(nextStats.preferences.unitSystem).toBe("lbs");
    expect(nextStats.preferences.equipment).toEqual(["barbell", "dumbbell"]);
    expect(nextStats.preferences.injuries).toEqual(["shoulder", "lower_back"]);
  });

  it("passes challenge and strength baseline inputs to cycle initialization", async () => {
    const result = await completeOnboarding({
      ...baseInput,
      challengeBaselines: {
        push_up: { maxReps: 14 },
      },
      strengthBaselines: {
        squat: { estimatedOneRepMax: 275, unit: "lbs" },
        deadlift: { estimatedOneRepMax: 315, unit: "lbs" },
        bench_press: { estimatedOneRepMax: 185, unit: "lbs" },
        overhead_press: { estimatedOneRepMax: 115, unit: "lbs" },
      },
    });

    expect(result).toEqual({ status: "success" });
    expect(mockedHandleInitializeCycle).toHaveBeenCalledWith(context.userId, expect.objectContaining({
      programAdaptationInputs: {
        challengeBaselines: {
          push_up: { maxReps: 14 },
        },
        strengthBaselines: {
          squat: { estimatedOneRepMax: 275, unit: "lbs" },
          deadlift: { estimatedOneRepMax: 315, unit: "lbs" },
          bench_press: { estimatedOneRepMax: 185, unit: "lbs" },
          overhead_press: { estimatedOneRepMax: 115, unit: "lbs" },
        },
      },
    }));
  });

  it("returns error for invalid payload", async () => {
    const result = await completeOnboarding({
      ...baseInput,
      equipment: [],
    });

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/invalid onboarding input/i);
    expect(mockedHandleInitializeCycle).not.toHaveBeenCalled();
  });

  it("requires explicit macrocycle weeks in the onboarding payload", async () => {
    const { macrocycleWeeks: _macrocycleWeeks, ...missingMacrocycleWeeks } = baseInput;

    const result = await completeOnboarding(missingMacrocycleWeeks as never);

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/invalid onboarding input/i);
    expect(mockedHandleInitializeCycle).not.toHaveBeenCalled();
  });

  it("returns error when not authenticated", async () => {
    context.userId = "";

    const result = await completeOnboarding(baseInput);

    expect(result).toEqual({ status: "error", error: "Not authenticated." });
    expect(mockedHandleInitializeCycle).not.toHaveBeenCalled();
  });

  it("returns friendly error when cycle initialization fails and does not save", async () => {
    context.initializeResult = { status: "error", errors: ["Engine down"] };
    mockedHandleInitializeCycle.mockResolvedValueOnce(context.initializeResult);

    const result = await completeOnboarding(baseInput);

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/unable to complete onboarding/i);
    expect(context.updatePayload).toBeNull();
    expect(context.selectCall).toBe(0);
  });

  it("updates preferences without overwriting existing profile preferences and keeps has_save false on db errors", async () => {
    context.updateError = { message: "forced write failure" };
    const result = await completeOnboarding(baseInput);

    expect(result).toEqual({ status: "error", error: "Failed to save onboarding choices." });
    expect(context.updatePayload?.has_save).toBe(true);
  });

  it("returns error when reloading projection stats fails after initialization", async () => {
    context.selectErrors = [{ message: "forced projection read failure" }];
    const result = await completeOnboarding(baseInput);
    expect(result).toEqual({ status: "error", error: "Failed to load onboarding profile." });
    expect(context.updatePayload).toBeNull();
  });
});
