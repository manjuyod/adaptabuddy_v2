import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleCompleteSession } from "../src/modules/sessions/service";
import { createMockSupabase } from "./helpers/mockSupabase";
import { runEngineInput } from "../src/lib/engine-runner";

let mockSupabase: ReturnType<typeof createMockSupabase>;
let mockAdminSupabase: ReturnType<typeof createMockSupabase> | null;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockAdminSupabase,
}));

vi.mock("../src/lib/engine-runner", () => ({
  runEngineInput: vi.fn(),
}));

const mockedRunEngineInput = vi.mocked(runEngineInput);

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

const createEngineCompleteOutput = () => ({
  schemaVersion: "engine.v1",
  operation: "complete_session",
  result: {
    sessionOutcomeClassification: "complete_clean",
    updatedProgressionActionSummary: [
      {
        exerciseId: "5001",
        action: "overload",
        trend: "improving",
      },
    ],
    awardedXpSummary: {
      xpDelta: 20,
      streakDelta: 1,
      reason: "completed_recommended_session",
    },
    levelUpIndicator: false,
    warnings: [],
  },
  statePatch: {
    progressionState: {
      "5001": {
        currentAction: "overload",
        trend: "improving",
        lastSuccessfulLoad: {
          weight: 100,
          reps: 5,
        },
        consecutiveSuccessfulCompletions: 3,
        consecutiveStallOrRegressionCount: 0,
        swapRecommendationCount: 0,
        lastSessionOutcomeClassification: "complete_clean",
        lastCompletedAt: "2026-02-04T12:00:00.000Z",
      },
    },
    readinessState: {
      systemicFatigue: "moderate",
    },
    gamificationState: {
      xp: 222,
      level: 4,
      adherenceStreak: 11,
      completedSessionCount: 19,
      missedSessionCount: 2,
      lastAdherenceOutcomeClassification: "complete_clean",
      lastAwardedAt: "2026-02-04T12:00:00.000Z",
    },
  },
  events: [],
  decisionLog: [],
  replayReceipt: {
    inputHash: "sha256:test-input",
    outputHash: "sha256:test-output",
    seedUsed: "seed-123",
    effectiveAt: "2026-02-04T12:00:00.000Z",
    implementationVersion: "engine-rs-mvp-0",
    policyVersion: "policy-2026-02",
    referenceHash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
  },
});

describe("session completion reliability", () => {
  beforeEach(() => {
    mockAdminSupabase = null;
    mockedRunEngineInput.mockReset();
    mockedRunEngineInput.mockResolvedValue(createEngineCompleteOutput());
  });

  it("reuses an existing completion for duplicate idempotency keys", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
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
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
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
          planned_day_of_week: 1,
          microcycle_index: 0,
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          completed_session_count: null,
          missed_session_count: null,
          last_adherence_outcome_classification: null,
          last_awarded_at: null,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const existing = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === args.p_user_id &&
              row.idempotency_key === args.p_idempotency_key
          );

          if (existing) {
            return {
              data: [{ workout_log_id: existing.id, reused: true }],
            };
          }

          const nextWorkoutId = (mutableStore.workout_logs?.length ?? 0) + 1;
          const workoutLog = {
            id: nextWorkoutId,
            user_id: args.p_user_id,
            program_id: args.p_program_id,
            program_day_id: args.p_program_day_id,
            completed_at: args.p_completed_at,
            duration_seconds: args.p_duration_seconds,
            total_volume: args.p_total_volume,
            seed: args.p_seed,
            metadata: args.p_metadata,
            idempotency_key: args.p_idempotency_key,
          };

          mutableStore.workout_logs = [...(mutableStore.workout_logs ?? []), workoutLog];

          const setPayload = Array.isArray(args.p_set_logs) ? args.p_set_logs : [];
          const existingSetCount = mutableStore.set_logs?.length ?? 0;
          const insertedSets = setPayload.map((setRow, index) => ({
            id: existingSetCount + index + 1,
            workout_log_id: nextWorkoutId,
            ...(setRow as Record<string, unknown>),
          }));
          mutableStore.set_logs = [...(mutableStore.set_logs ?? []), ...insertedSets];

          mutableStore.users = (mutableStore.users ?? []).map((row) =>
            row.id === args.p_user_id ? { ...row, stats_json: args.p_stats_json } : row
          );

          return {
            data: [{ workout_log_id: nextWorkoutId, reused: false }],
          };
        },
      },
    });

    const first = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "dup-key-1",
    });
    const second = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "dup-key-1",
    });

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(store.set_logs).toHaveLength(2);
    expect(store.engine_cycle_plans[0].current_session_index).toBe(1);
    expect(store.engine_cycle_sessions[0].completed_at).toBe("2026-02-04T12:00:00.000Z");
    expect(store.engine_gamification_states[0].xp).toBe(222);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(11);
  });

  it("derives a stable idempotency key when callers omit one", async () => {
    const userId = "10101010-1111-1111-1111-111111111111";
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
          planned_day_of_week: 1,
          microcycle_index: 0,
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          completed_session_count: null,
          missed_session_count: null,
          last_adherence_outcome_classification: null,
          last_awarded_at: null,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const existing = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === args.p_user_id &&
              row.idempotency_key === args.p_idempotency_key
          );

          if (existing) {
            return {
              data: [{ workout_log_id: existing.id, reused: true }],
            };
          }

          const nextWorkoutId = (mutableStore.workout_logs?.length ?? 0) + 1;
          mutableStore.workout_logs = [
            ...(mutableStore.workout_logs ?? []),
            {
              id: nextWorkoutId,
              user_id: args.p_user_id,
              completed_at: args.p_completed_at,
              idempotency_key: args.p_idempotency_key,
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

    const first = await handleCompleteSession(userId, createCompletionInput());
    const second = await handleCompleteSession(userId, createCompletionInput());

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(typeof store.workout_logs[0].idempotency_key).toBe("string");
    expect(store.engine_cycle_plans[0].current_session_index).toBe(1);
  });

  it("repairs pending normalized cycle state for reused completions without double-advancing later retries", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
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
      workout_logs: [
        {
          id: 9,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-04T12:00:00.000Z",
          duration_seconds: 3600,
          total_volume: 1000,
          seed: "seed-123",
          metadata: { source: "existing-rpc-write" },
          idempotency_key: "repair-key-1",
        },
      ] as Array<Record<string, unknown>>,
      set_logs: [] as Array<Record<string, unknown>>,
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
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
          session_seed: "seed-123",
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const existing = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === args.p_user_id &&
              row.idempotency_key === args.p_idempotency_key
          );

          if (!existing) {
            return {
              error: { code: "XX000", message: "expected reused completion" },
            };
          }

          return {
            data: [{ workout_log_id: existing.id, reused: true }],
          };
        },
      },
    });

    const first = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "repair-key-1",
    });
    const second = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "repair-key-1",
    });

    expect(first.status).toBe("success");
    expect(second.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(store.engine_cycle_plans[0].current_session_index).toBe(1);
    expect(store.engine_cycle_sessions[0].completed_at).toBe("2026-02-04T12:00:00.000Z");
    expect(store.engine_gamification_states[0].xp).toBe(222);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(11);
  });

  it("returns deterministic error when atomic rpc fails", async () => {
    const userId = "22222222-2222-2222-2222-222222222222";
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
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: () => ({
          error: { code: "XX000", message: "forced rpc failure" },
        }),
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "rpc-failure",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["Failed to save session completion"]);
    expect(store.workout_logs).toHaveLength(0);
    expect(store.set_logs).toHaveLength(0);
  });

  it("returns an error when normalized gamification state is missing", async () => {
    const userId = "23232323-2222-2222-2222-222222222222";
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
          planned_day_of_week: 1,
          microcycle_index: 0,
          completed_at: null,
        },
      ],
      engine_gamification_states: [] as Array<Record<string, unknown>>,
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
      idempotencyKey: "missing-gamification-state",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["Missing normalized gamification state"]);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
  });

  it("does not double-apply stats when projection refresh fails before an idempotent retry", async () => {
    const userId = "24242424-2222-2222-2222-222222222222";
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
          planned_day_of_week: 1,
          microcycle_index: 0,
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          class_archetype: "hybrid",
        },
      ],
    };

    let projectionUpdateAttempts = 0;
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const existing = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === args.p_user_id &&
              row.idempotency_key === args.p_idempotency_key
          );
          if (existing) {
            return {
              data: [{ workout_log_id: existing.id, reused: true }],
            };
          }

          const nextWorkoutId = (mutableStore.workout_logs?.length ?? 0) + 1;
          mutableStore.workout_logs = [
            ...(mutableStore.workout_logs ?? []),
            {
              id: nextWorkoutId,
              user_id: args.p_user_id,
              completed_at: args.p_completed_at,
              idempotency_key: args.p_idempotency_key,
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
      mutationGuards: {
        update: ({ table }) => {
          if (table !== "users") {
            return null;
          }

          projectionUpdateAttempts += 1;
          if (projectionUpdateAttempts === 1) {
            return {
              code: "XX000",
              message: "forced projection refresh failure",
            };
          }

          return null;
        },
      },
    });

    const first = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "projection-refresh-retry",
    });
    store.users[0].stats_json = {
      ...(store.users[0].stats_json as UserStats),
      activeProgram: {
        ...(store.users[0].stats_json as UserStats).activeProgram!,
        currentDayIndex: 0,
        currentMicrocycle: 1,
      },
    } satisfies UserStats;
    const second = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "projection-refresh-retry",
    });

    expect(first.status).toBe("error");
    expect(first.errors).toEqual(["forced projection refresh failure"]);
    expect(second.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    const completedStats = store.users[0].stats_json as UserStats;
    expect(completedStats.progression.totalWorkouts).toBe(1);
    expect(completedStats.activeProgram?.currentDayIndex).toBe(1);
  });

  it("returns an error when normalized follow-up mutations fail after the workout is saved", async () => {
    const userId = "33333333-3333-3333-3333-333333333333";
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
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
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
      mutationFailures: {
        engine_cycle_sessions: {
          update: { message: "forced normalized sync failure", code: "XX000" },
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "normalized-sync-failure",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["Failed to synchronize normalized cycle state"]);
    expect(store.workout_logs).toHaveLength(0);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    expect(store.engine_gamification_states[0].xp).toBe(140);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(6);
    const restoredStats = store.users[0].stats_json as UserStats;
    expect(restoredStats.progression.totalWorkouts).toBe(0);
    expect(restoredStats.activeProgram?.currentDayIndex).toBe(0);
  });

  it("rolls back normalized completion changes when plan advancement fails after marking the session complete", async () => {
    const userId = "44444444-4444-4444-4444-444444444444";
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
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          completed_session_count: null,
          missed_session_count: null,
          last_adherence_outcome_classification: null,
          last_awarded_at: null,
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
      mutationFailures: {
        engine_cycle_plans: {
          update: { message: "forced plan sync failure", code: "XX000" },
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "normalized-plan-sync-failure",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["Failed to synchronize normalized cycle state"]);
    expect(store.workout_logs).toHaveLength(0);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    expect(store.engine_gamification_states[0].xp).toBe(140);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(6);
    expect(store.engine_gamification_states[0].completed_session_count).toBeNull();
    expect(store.engine_gamification_states[0].missed_session_count).toBeNull();
    expect(store.engine_gamification_states[0].last_adherence_outcome_classification).toBeNull();
    expect(store.engine_gamification_states[0].last_awarded_at).toBeNull();
    const restoredStats = store.users[0].stats_json as UserStats;
    expect(restoredStats.progression.totalWorkouts).toBe(0);
    expect(restoredStats.activeProgram?.currentDayIndex).toBe(0);
  });

  it("rolls back fallback completion writes when completion trace persistence fails", async () => {
    const userId = "77777777-7777-7777-7777-777777777777";
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
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
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
          session_seed: "seed-123",
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationFailures: {
        engine_session_traces: {
          insert: { message: "forced trace failure", code: "XX000" },
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "fallback-trace-failure",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["forced trace failure"]);
    expect(store.workout_logs).toHaveLength(0);
    expect(store.set_logs).toHaveLength(0);
    expect(store.engine_session_traces).toHaveLength(0);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    const restoredStats = store.users[0].stats_json as UserStats;
    expect(restoredStats.progression.totalWorkouts).toBe(0);
    expect(restoredStats.activeProgram?.currentDayIndex).toBe(0);
  });

  it("does not delete an existing workout log when normalized sync fails on a reused idempotent completion", async () => {
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
      workout_logs: [
        {
          id: 9,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-04T12:00:00.000Z",
          duration_seconds: 3600,
          total_volume: 1000,
          seed: "seed-123",
          metadata: { source: "existing-rpc-write" },
          idempotency_key: "reuse-sync-failure",
        },
      ] as Array<Record<string, unknown>>,
      set_logs: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
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
          session_seed: "seed-123",
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      rpcHandlers: {
        complete_session_atomic: (args, mutableStore) => {
          const existing = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === args.p_user_id &&
              row.idempotency_key === args.p_idempotency_key
          );
          if (!existing) {
            return {
              error: { code: "XX000", message: "expected existing completion for reused path" },
            };
          }

          return {
            data: [{ workout_log_id: existing.id, reused: true }],
          };
        },
      },
      mutationFailures: {
        engine_cycle_sessions: {
          update: { message: "forced normalized sync failure", code: "XX000" },
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "reuse-sync-failure",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["Failed to synchronize normalized cycle state"]);
    expect(store.workout_logs).toHaveLength(1);
    expect(store.workout_logs[0].idempotency_key).toBe("reuse-sync-failure");
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    expect(store.engine_gamification_states[0].xp).toBe(140);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(6);
  });

  it("repairs normalized cycle state when fallback duplicate idempotency retries an existing workout log", async () => {
    const userId = "55555555-5555-5555-5555-555555555555";
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
      workout_logs: [
        {
          id: 9,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-04T12:00:00.000Z",
          duration_seconds: 3600,
          total_volume: 1000,
          seed: "seed-123",
          metadata: { source: "fallback-duplicate" },
          idempotency_key: "fallback-repair-key-1",
        },
      ] as Array<Record<string, unknown>>,
      set_logs: [] as Array<Record<string, unknown>>,
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
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
          session_seed: "seed-123",
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationGuards: {
        insert: ({ table, payload, store: mutableStore }) => {
          if (table !== "workout_logs" || !payload || Array.isArray(payload)) {
            return null;
          }

          const duplicate = (mutableStore.workout_logs ?? []).find(
            (row) =>
              row.user_id === payload.user_id &&
              row.idempotency_key === payload.idempotency_key
          );
          if (!duplicate) {
            return null;
          }

          return {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          };
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "fallback-repair-key-1",
    });

    expect(result.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(store.engine_session_traces).toHaveLength(1);
    expect(store.engine_session_traces[0]).toMatchObject({
      operation: "complete_session",
      workout_log_id: 9,
      cycle_session_id: 1,
    });
    expect(store.engine_cycle_sessions[0].completed_at).toBe("2026-02-04T12:00:00.000Z");
    expect(store.engine_cycle_plans[0].current_session_index).toBe(1);
    expect(store.engine_gamification_states[0].xp).toBe(222);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(11);
  });
});
