import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleCompleteSession } from "../src/modules/sessions/service";
import { createMockSupabase } from "./helpers/mockSupabase";

let mockSupabase: ReturnType<typeof createMockSupabase>;
let mockAdminSupabase: ReturnType<typeof createMockSupabase> | null;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockAdminSupabase,
}));

const createStats = (): UserStats => ({
  activeProgram: {
    programId: "2001",
    startedAt: "2026-02-01T00:00:00.000Z",
    currentDayIndex: 0,
    currentMicrocycle: 1,
    daysPerWeek: 3,
  },
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

const createCompletionInput = () => ({
  programDayId: "3001",
  seed: "seed-123",
  startedAt: "2026-02-04T11:00:00.000Z",
  completedAt: "2026-02-04T12:00:00.000Z",
  overallRpe: 7,
  exercises: [
    {
      slotId: "4001",
      exerciseId: "5001",
      sets: [
        { setIndex: 0, weight: 100, reps: 5, rir: 2 },
        { setIndex: 1, weight: 100, reps: 5, rir: 2 },
      ],
    },
  ],
});

const richerGamificationRow = {
  xp: 140,
  level: 3,
  adherence_streak: 6,
  completed_session_count: 12,
  missed_session_count: 0,
  last_adherence_outcome_classification: "complete_clean",
  last_awarded_at: "2026-02-10T10:00:00.000Z",
} as const;

describe("session compatibility projection", () => {
  const TEST_TIMEOUT_MS = 15_000;
  beforeEach(() => {
    mockAdminSupabase = null;
  });

  it("refreshes compatibility cursor fields from the next normalized session row", async () => {
    const userId = "66666666-6666-6666-6666-666666666666";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      program_days: [{ id: 3001, program_id: 2001, name: "Day 1" }],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
      workout_logs: [] as Array<Record<string, unknown>>,
      set_logs: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          profile_id: 11,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          current_microcycle_index: 0,
          current_mesocycle_index: 0,
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Day 1",
          planned_day_of_week: 0,
          microcycle_index: 0,
          completed_at: null,
        },
        {
          id: 2,
          plan_id: 1,
          user_id: userId,
          session_index: 1,
          program_day_id: 3002,
          program_day_name: "Day 2",
          planned_day_of_week: 2,
          microcycle_index: 4,
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          ...richerGamificationRow,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const nextWorkoutId = (mutableStore.workout_logs?.length ?? 0) + 1;
          mutableStore.workout_logs = [
            ...(mutableStore.workout_logs ?? []),
            {
              id: nextWorkoutId,
              user_id: args.p_user_id,
              completed_at: args.p_completed_at,
            },
          ];
          mutableStore.users = (mutableStore.users ?? []).map((row) =>
            row.id === args.p_user_id ? { ...row, stats_json: args.p_stats_json } : row
          );
          return {
            data: [{ workout_log_id: nextWorkoutId, reused: false }],
          };
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "projection-next-session-derived",
    });

    expect(result.status).toBe("success");
    const projectedStats = store.users[0].stats_json as UserStats;
    expect(projectedStats.activeProgram?.currentDayIndex).toBe(2);
    expect(projectedStats.activeProgram?.currentMicrocycle).toBe(5);
  }, TEST_TIMEOUT_MS);

  it("resolves workout log program identity from the normalized active plan before stale stats_json data", async () => {
    const userId = "77777777-6666-6666-6666-666666666666";
    const store = {
      users: [
        {
          id: userId,
          stats_json: {
            ...createStats(),
            activeProgram: {
              ...createStats().activeProgram!,
              programId: "9999",
            },
          },
        },
      ],
      program_days: [{ id: 3001, program_id: 2001, name: "Day 1" }],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
      workout_logs: [] as Array<Record<string, unknown>>,
      set_logs: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          profile_id: 11,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          current_microcycle_index: 0,
          current_mesocycle_index: 0,
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Day 1",
          planned_day_of_week: 0,
          microcycle_index: 0,
          session_seed: "seed-123",
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          ...richerGamificationRow,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const nextWorkoutId = (mutableStore.workout_logs?.length ?? 0) + 1;
          mutableStore.workout_logs = [
            ...(mutableStore.workout_logs ?? []),
            {
              id: nextWorkoutId,
              user_id: args.p_user_id,
              program_id: args.p_program_id,
              completed_at: args.p_completed_at,
            },
          ];
          mutableStore.users = (mutableStore.users ?? []).map((row) =>
            row.id === args.p_user_id ? { ...row, stats_json: args.p_stats_json } : row
          );
          return {
            data: [{ workout_log_id: nextWorkoutId, reused: false }],
          };
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "normalized-program-id",
    });

    expect(result.status).toBe("success");
    expect(store.workout_logs[0]?.program_id).toBe(2001);
  }, TEST_TIMEOUT_MS);
});
