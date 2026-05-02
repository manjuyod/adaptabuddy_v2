import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateProgramAction } from "@/modules/programs/actions";

const context = vi.hoisted(() => ({
  userId: "11111111-1111-1111-1111-111111111111",
  authError: null as { message: string } | null,
  program: {
    id: 2,
    slug: "upper-lower",
    name: "Upper Lower",
    description: "Balanced split",
    default_days_per_week: 4,
    min_days_per_week: 3,
    max_days_per_week: 5,
    is_active: true,
  },
  activeCycleView: null as null | {
    source: "normalized" | "legacy";
    status: "active" | "completed";
    programId: string;
    startedAt: string;
    daysPerWeek: number;
    currentDayIndex: number | null;
    currentMicrocycle: number | null;
    programDayId: string | null;
    programDayName: string | null;
    classPresetId: string | null;
    resolvedClassArchetype: string | null;
  },
  updateResult: { success: true, error: undefined as string | undefined },
  updateCalls: [] as Array<{ userId: string; programId: string }>,
}));

const mockSupabase = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: context.userId ? { id: context.userId } : null },
      error: context.authError,
    })),
  },
};

vi.mock("@/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("@/modules/programs/service", () => ({
  getProgramById: async () => ({
    program: context.program,
    error: undefined,
  }),
  getUserActiveCycleView: async () => ({
    activeCycleView: context.activeCycleView,
    error: undefined,
  }),
  updateUserActiveProgram: async (_supabase: unknown, userId: string, activeProgram: {
    programId: string;
  }) => {
    context.updateCalls.push({ userId, programId: activeProgram.programId });
    return context.updateResult;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("activateProgramAction", () => {
  beforeEach(() => {
    context.userId = "11111111-1111-1111-1111-111111111111";
    context.authError = null;
    context.activeCycleView = null;
    context.updateResult = { success: true, error: undefined };
    context.updateCalls = [];
  });

  it("does not overwrite compatibility state when a normalized active cycle already exists", async () => {
    context.activeCycleView = {
      source: "normalized",
      status: "active",
      programId: "2001",
      startedAt: "2026-03-01T00:00:00.000Z",
      daysPerWeek: 3,
      currentDayIndex: 0,
      currentMicrocycle: 1,
      programDayId: "3001",
      programDayName: "Day 1",
      classPresetId: "classless",
      resolvedClassArchetype: "hybrid",
    };

    const result = await activateProgramAction(2);

    expect(result).toEqual({
      success: false,
      error: "Cannot manually activate a legacy program while a normalized cycle is active",
    });
    expect(context.updateCalls).toEqual([]);
  });
});
