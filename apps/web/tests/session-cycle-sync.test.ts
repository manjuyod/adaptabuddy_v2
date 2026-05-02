import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleCompleteSession } from "../src/modules/sessions/service";
import { CANON_REPLAY_CANONICALIZATION_VERSION, computeCanonicalReplayReferenceHash } from "../src/lib/engine-replay";
import { createMockSupabase } from "./helpers/mockSupabase";
import { runEngineInput } from "../src/lib/engine-runner";

let mockSupabase: ReturnType<typeof createMockSupabase>;
let mockAdminSupabase: ReturnType<typeof createMockSupabase> | null;

vi.mock("../src/lib/engine-runner", () => ({
  runEngineInput: vi.fn(),
}));

const mockedRunEngineInput = vi.mocked(runEngineInput);

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
      xpDelta: 22,
      streakDelta: 0,
      reason: "completed_recommended_session",
    },
    levelUpIndicator: true,
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
        consecutiveSuccessfulCompletions: 4,
        consecutiveStallOrRegressionCount: 0,
        swapRecommendationCount: 1,
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

describe("cycle-backed completion sync", () => {
  beforeEach(() => {
    mockAdminSupabase = null;
    mockedRunEngineInput.mockReset();
    mockedRunEngineInput.mockResolvedValue(createEngineCompleteOutput());
  });

  it("advances the normalized cycle state and gamification projection after completion", async () => {
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
          completed_session_count: 12,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-02-03T12:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_session_traces: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue(createEngineCompleteOutput());
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

    const result = await handleCompleteSession(
      userId,
      {
        ...createCompletionInput(),
        notes: "private completion note",
      },
      {
        idempotencyKey: "cycle-sync-1",
      }
    );

    expect(result.status).toBe("success");
    expect(store.engine_cycle_plans[0].current_session_index).toBe(1);
    expect(store.engine_cycle_sessions[0].completed_at).toBe("2026-02-04T12:00:00.000Z");
    expect(store.engine_gamification_states[0].xp).toBe(222);
    expect(store.engine_gamification_states[0].level).toBe(4);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(11);
    expect(store.engine_gamification_states[0].completed_session_count).toBe(19);
    expect(store.engine_gamification_states[0].missed_session_count).toBe(2);
    expect(store.engine_gamification_states[0].last_adherence_outcome_classification).toBe(
      "complete_clean"
    );
    expect(store.engine_gamification_states[0].last_awarded_at).toBe(
      "2026-02-04T12:00:00.000Z"
    );
    expect(store.engine_session_traces).toHaveLength(1);
    expect(store.engine_session_traces[0]).toMatchObject({
      operation: "complete_session",
      cycle_plan_id: 1,
      cycle_session_id: 1,
      workout_log_id: 1,
    });
    const traceInputMaterial = store.engine_session_traces[0]
      .input_material as Record<string, unknown>;
    expect(traceInputMaterial.schemaVersion).toBe("engine.v1");
    expect(traceInputMaterial.operation).toBe("complete_session");
    expect(traceInputMaterial.determinism).toMatchObject({
      canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      ruleVersion: "rules-2026-03",
    });
    expect(traceInputMaterial.metadata).toMatchObject({
      correlationId: "[REDACTED]",
    });
    expect(traceInputMaterial.request).toMatchObject({
      session: {
        notes: "[REDACTED]",
      },
    });
    expect(mockedRunEngineInput).toHaveBeenCalledTimes(1);
  });

  it("builds a Rust complete_session input from the active cycle state and recent workout history", async () => {
    const userId = "99999999-1111-1111-1111-111111111111";
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
          id: 41,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-02T12:00:00.000Z",
          seed: "history-seed-1",
          metadata: {},
        },
        {
          id: 42,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-03T12:00:00.000Z",
          seed: "history-seed-2",
          metadata: {},
        },
      ] as Array<Record<string, unknown>>,
      set_logs: [
        {
          id: 1,
          workout_log_id: 41,
          exercise_id: 5001,
          set_number: 1,
          weight: 95,
          reps: 5,
          rir: 2,
          failed: false,
        },
        {
          id: 2,
          workout_log_id: 42,
          exercise_id: 5001,
          set_number: 1,
          weight: 97.5,
          reps: 5,
          rir: 1,
          failed: false,
        },
      ] as Array<Record<string, unknown>>,
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
          program_day_name: "Day 1",
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
          completed_session_count: 12,
          missed_session_count: 1,
          last_adherence_outcome_classification: "partial",
          last_awarded_at: "2026-02-03T12:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue(createEngineCompleteOutput());
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
      idempotencyKey: "cycle-sync-engine-input",
    });

    expect(result.status).toBe("success");
    expect(mockedRunEngineInput).toHaveBeenCalledTimes(1);
    const firstEngineCall = mockedRunEngineInput.mock.calls[0]?.[0] as {
      determinism?: {
        canonicalizationVersion?: string;
        referenceHash?: string;
      };
      referenceSnapshot?: Record<string, unknown>;
      stateSnapshot?: {
        recentCompletions?: unknown;
      };
    } & Record<string, unknown>;

    expect(firstEngineCall).toMatchObject({
      schemaVersion: "engine.v1",
      operation: "complete_session",
      stateSnapshot: {
        gamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
          completedSessionCount: 12,
          missedSessionCount: 1,
          lastAdherenceOutcomeClassification: "partial",
          lastAwardedAt: "2026-02-03T12:00:00.000Z",
        },
        activeProgramState: {
          programId: "2001",
          currentDayIndex: 0,
          currentMicrocycle: 1,
        },
      },
      request: {
        session: createCompletionInput(),
      },
    });
    expect(firstEngineCall.stateSnapshot?.recentCompletions).toEqual([
      {
        exerciseId: "5001",
        completedAt: "2026-02-03T12:00:00.000Z",
        quality: "complete_clean",
      },
      {
        exerciseId: "5001",
        completedAt: "2026-02-02T12:00:00.000Z",
        quality: "complete_clean",
      },
    ]);

    expect(firstEngineCall.determinism).toMatchObject({
      canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      referenceHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    expect(firstEngineCall.determinism?.referenceHash).toBe(
      computeCanonicalReplayReferenceHash(firstEngineCall.referenceSnapshot as Record<string, unknown>)
    );
  });

  it("returns an error when the Rust complete_session output is malformed", async () => {
    const userId = "88888888-1111-1111-1111-111111111111";
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
          program_day_name: "Day 1",
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
          completed_session_count: 12,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-02-03T12:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "complete_session",
      result: {},
      statePatch: {},
    });
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
      idempotencyKey: "cycle-sync-bad-engine-output",
    });

    expect(result.status).toBe("error");
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    expect(store.engine_gamification_states[0].xp).toBe(140);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(6);
  });

  it("upserts normalized progression state from the Rust state patch", async () => {
    const userId = "77777777-1111-1111-1111-111111111111";
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
          program_day_name: "Day 1",
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
          completed_session_count: 12,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-02-03T12:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_progression_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue(createEngineCompleteOutput());
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
      idempotencyKey: "cycle-sync-progression-upsert",
    });

    expect(result.status).toBe("success");
    expect(store.engine_progression_states).toHaveLength(1);
    expect(store.engine_progression_states[0]).toMatchObject({
      user_id: userId,
      plan_id: 1,
      exercise_id: "5001",
      current_action: "overload",
      trend: "improving",
      last_successful_load_weight: 100,
      last_successful_load_reps: 5,
      consecutive_successful_completions: 4,
      consecutive_stall_or_regression_count: 0,
      swap_recommendation_count: 1,
      last_session_outcome_classification: "complete_clean",
      last_completed_at: "2026-02-04T12:00:00.000Z",
    });
  });

  it("prefers normalized progression rows over stats_json when building the Rust state snapshot", async () => {
    const userId = "66666666-1111-1111-1111-111111111111";
    const store = {
      users: [
        {
          id: userId,
          stats_json: {
            ...createStats(),
            capacities: {
              "5001": {
                estimated1RM: 123,
                lastWeight: 88,
                lastReps: 8,
                confidence: 0.2,
                lastPerformed: "2026-01-01T12:00:00.000Z",
              },
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
          program_day_name: "Day 1",
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
          completed_session_count: 12,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-02-03T12:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_progression_states: [
        {
          id: 1,
          user_id: userId,
          plan_id: 1,
          exercise_id: "5001",
          current_action: "swap",
          trend: "blocked",
          last_successful_load_weight: 105,
          last_successful_load_reps: 3,
          consecutive_successful_completions: 0,
          consecutive_stall_or_regression_count: 4,
          swap_recommendation_count: 2,
          last_session_outcome_classification: "missed",
          last_completed_at: "2026-02-03T12:00:00.000Z",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue(createEngineCompleteOutput());
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
      idempotencyKey: "cycle-sync-normalized-progression-read",
    });

    expect(result.status).toBe("success");
    const progressionEngineCall = mockedRunEngineInput.mock.calls[0]?.[0] as {
      stateSnapshot?: {
        progressionState?: {
          records?: unknown;
        };
      };
    };

    expect(progressionEngineCall.stateSnapshot?.progressionState?.records).toEqual(
      [
        {
          exerciseId: "5001",
          previousPerformanceReference: {
            weight: 105,
            reps: 3,
          },
          trend: "blocked",
          currentAction: "swap",
          consecutiveSuccessfulCompletions: 0,
          consecutiveStallOrRegressionCount: 4,
          swapRecommendationCount: 2,
          lastSessionOutcomeClassification: "missed",
          lastCompletedAt: "2026-02-03T12:00:00.000Z",
        },
      ]
    );
  });

  it("syncs the active plan only when historical plans and gamification rows also exist", async () => {
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
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 1999,
          current_session_index: 4,
          is_active: false,
          current_microcycle_index: 1,
          current_mesocycle_index: 1,
        },
        {
          id: 2,
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
          session_index: 4,
          program_day_id: 3999,
          completed_at: null,
        },
        {
          id: 2,
          plan_id: 2,
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
          xp: 900,
          level: 7,
          adherence_streak: 21,
          class_archetype: "legacy",
        },
        {
          id: 2,
          user_id: userId,
          plan_id: 2,
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
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "cycle-sync-multi-plan",
    });

    expect(result.status).toBe("success");
    expect(store.engine_cycle_plans[0].current_session_index).toBe(4);
    expect(store.engine_cycle_plans[1].current_session_index).toBe(1);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_sessions[1].completed_at).toBe("2026-02-04T12:00:00.000Z");
    expect(store.engine_gamification_states[0].xp).toBe(900);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(21);
    expect(store.engine_gamification_states[1].xp).toBe(222);
    expect(store.engine_gamification_states[1].adherence_streak).toBe(11);
  });

  it("leaves normalized cycle state untouched when the completion does not match the active session seed", async () => {
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
          session_seed: "cycle-seed-1",
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

    const result = await handleCompleteSession(
      userId,
      { ...createCompletionInput(), seed: "manual-seed" },
      { idempotencyKey: "manual-mismatch-seed" }
    );

    expect(result.status).toBe("success");
    expect(store.workout_logs).toHaveLength(1);
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_gamification_states[0].xp).toBe(140);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(6);
  });

  it("returns an error when the active cycle plan cannot be read during completion", async () => {
    const userId = "45454545-4545-4545-4545-454545454545";
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
      engine_cycle_plans: [],
    };

    mockSupabase = createMockSupabase(store, {
      queryFailures: {
        engine_cycle_plans: { message: "cycle plan read failed" },
      },
    });
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleCompleteSession(userId, createCompletionInput());

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load active cycle plan"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
    expect(store.workout_logs).toHaveLength(0);
  });

  it("returns an error when the active cycle session cannot be read during completion", async () => {
    const userId = "46464646-4646-4646-4646-464646464646";
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
      engine_cycle_sessions: [],
    };

    mockSupabase = createMockSupabase(store, {
      queryFailures: {
        engine_cycle_sessions: { message: "cycle session read failed" },
      },
    });
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleCompleteSession(userId, createCompletionInput());

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load active cycle session"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
    expect(store.workout_logs).toHaveLength(0);
  });

  it("returns an error when the active cycle session row is missing during completion", async () => {
    const userId = "47474747-4747-4747-4747-474747474747";
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
      engine_cycle_sessions: [],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleCompleteSession(userId, createCompletionInput());

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load active cycle session"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
    expect(store.workout_logs).toHaveLength(0);
  });

  it("returns an error when normalized follow-up mutations fail after a fallback completion write", async () => {
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
          class_archetype: "hybrid",
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationFailures: {
        engine_cycle_sessions: {
          update: { message: "forced normalized sync failure", code: "XX000" },
        },
      },
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "fallback-normalized-sync-failure",
    });

    expect(result.status).toBe("error");
    expect(result.errors).toEqual(["Failed to synchronize normalized cycle state"]);
    expect(store.workout_logs).toHaveLength(0);
    expect(store.engine_cycle_sessions[0].completed_at).toBeNull();
    expect(store.engine_cycle_plans[0].current_session_index).toBe(0);
    expect(store.engine_gamification_states[0].xp).toBe(140);
    expect(store.engine_gamification_states[0].adherence_streak).toBe(6);
  });

  it("refreshes the compatibility projection after advancing to the next microcycle", async () => {
    const userId = "55555555-5555-5555-5555-555555555555";
    const store = {
      users: [
        {
          id: userId,
          stats_json: {
            ...createStats(),
            activeProgram: {
              ...createStats().activeProgram!,
              currentDayIndex: 2,
              currentMicrocycle: 1,
            },
          },
        },
      ],
      program_days: [{ id: 3001, program_id: 2001, name: "Day 3" }],
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
          current_session_index: 2,
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
          session_index: 2,
          program_day_id: 3001,
          planned_day_of_week: 2,
          microcycle_index: 0,
          program_day_name: "Day 3",
          session_seed: "seed-123",
          completed_at: null,
        },
        {
          id: 2,
          plan_id: 1,
          user_id: userId,
          session_index: 3,
          program_day_id: 3002,
          planned_day_of_week: 0,
          microcycle_index: 1,
          program_day_name: "Day 1",
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
    });

    const result = await handleCompleteSession(userId, createCompletionInput(), {
      idempotencyKey: "projection-refresh-1",
    });

    expect(result.status).toBe("success");
    const projectedStats = store.users[0].stats_json as UserStats;
    expect(projectedStats.activeProgram?.currentDayIndex).toBe(0);
    expect(projectedStats.activeProgram?.currentMicrocycle).toBe(2);
  });
});
