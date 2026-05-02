import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { completeOnboarding } from "@/modules/onboarding/actions";

const context = vi.hoisted(() => ({
  userId: "11111111-1111-1111-1111-111111111111",
  authError: null as { message: string } | null,
  userStats: null as UserStats | null,
  activePlanRows: [] as Array<Record<string, unknown>>,
  programResult: {
    id: 2,
    slug: "upper-lower",
    name: "Upper Lower",
    description: "Balanced split",
    default_days_per_week: 4,
    min_days_per_week: 3,
    max_days_per_week: 5,
    is_active: true,
  } as {
    id: number;
    slug: string;
    name: string;
    description: string;
    default_days_per_week: number;
    min_days_per_week: number;
    max_days_per_week: number;
    is_active: boolean;
  } | null,
  selectError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updatePayload: null as Record<string, unknown> | null,
}));

const mockFrom = vi.fn((table: string) => {
  if (table === "engine_cycle_plans") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: context.activePlanRows[0] ?? null,
              error: null,
            })),
          })),
        })),
      })),
    };
  }

  if (table !== "users") {
    throw new Error(`Unexpected table ${table}`);
  }

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: context.selectError
            ? null
            : {
                stats_json: context.userStats,
              },
          error: context.selectError,
        })),
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

vi.mock("@/modules/programs/service", () => ({
  getProgramById: async () => ({
    program: context.programResult,
    error: context.programResult ? undefined : "Program not found",
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("completeOnboarding", () => {
  beforeEach(() => {
    context.userId = "11111111-1111-1111-1111-111111111111";
    context.authError = null;
    context.userStats = null;
    context.activePlanRows = [];
    context.programResult = {
      id: 2,
      slug: "upper-lower",
      name: "Upper Lower",
      description: "Balanced split",
      default_days_per_week: 4,
      min_days_per_week: 3,
      max_days_per_week: 5,
      is_active: true,
    };
    context.selectError = null;
    context.updateError = null;
    context.updatePayload = null;
    mockFrom.mockClear();
  });

  it("persists onboarding choices and marks has_save in one update", async () => {
    const result = await completeOnboarding({
      equipment: ["Barbell", "Dumbbell"],
      fatigueLevel: "hard",
      unitSystem: "lbs",
      programId: 2,
    });

    expect(result).toEqual({ status: "success" });
    expect(context.updatePayload?.has_save).toBe(true);

    const nextStats = context.updatePayload?.stats_json as UserStats;
    expect(nextStats.activeProgram).toMatchObject({
      programId: "2",
      currentDayIndex: 0,
      currentMicrocycle: 1,
      daysPerWeek: 4,
    });
    expect(nextStats.preferences.fatigueLevel).toBe("hard");
    expect(nextStats.preferences.unitSystem).toBe("lbs");
    expect(nextStats.preferences.equipment).toEqual(["barbell", "dumbbell"]);
  });

  it("returns error for invalid payload", async () => {
    const result = await completeOnboarding({
      equipment: [],
      fatigueLevel: "hard",
      unitSystem: "lbs",
      programId: 2,
    });

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/invalid onboarding input/i);
  });

  it("returns error when not authenticated", async () => {
    context.userId = "";

    const result = await completeOnboarding({
      equipment: ["barbell"],
      fatigueLevel: "moderate",
      unitSystem: "kg",
      programId: 2,
    });

    expect(result).toEqual({ status: "error", error: "Not authenticated." });
  });

  it("returns error when selected program is unavailable", async () => {
    context.programResult = null;

    const result = await completeOnboarding({
      equipment: ["barbell"],
      fatigueLevel: "moderate",
      unitSystem: "kg",
      programId: 999,
    });

    expect(result).toEqual({
      status: "error",
      error: "Selected program is unavailable.",
    });
  });

  it("preserves preferences without reseeding activeProgram when a normalized cycle is already active", async () => {
    context.userStats = {
      activeProgram: {
        programId: "9",
        startedAt: "2026-02-01T00:00:00.000Z",
        currentDayIndex: 2,
        currentMicrocycle: 4,
        daysPerWeek: 5,
      },
      fatigue: {},
      mastery: {},
      capacities: {},
      progression: {
        totalWorkouts: 2,
        weeklyVolume: 900,
        lastWorkoutAt: null,
      },
      preferences: {
        fatigueLevel: "moderate",
        equipment: ["barbell"],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
        unitSystem: "kg",
      },
    };
    context.activePlanRows = [
      {
        id: 1,
        user_id: context.userId,
        is_active: true,
      },
    ];

    const result = await completeOnboarding({
      equipment: ["Dumbbell"],
      fatigueLevel: "hard",
      unitSystem: "lbs",
      programId: 2,
    });

    expect(result).toEqual({ status: "success" });
    const nextStats = context.updatePayload?.stats_json as UserStats;
    expect(nextStats.activeProgram).toEqual(context.userStats!.activeProgram);
    expect(nextStats.preferences.fatigueLevel).toBe("hard");
    expect(nextStats.preferences.unitSystem).toBe("lbs");
    expect(nextStats.preferences.equipment).toEqual(["dumbbell"]);
  });
});
