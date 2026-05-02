import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleGenerateSession } from "../src/modules/sessions/service";
import { CANON_REPLAY_CANONICALIZATION_VERSION, computeCanonicalReplayReferenceHash } from "../src/lib/engine-replay";
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
    startedAt: "2026-03-29T10:00:00.000Z",
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

const createEnginePlanOutput = () => ({
  schemaVersion: "engine.v1",
  operation: "plan_session",
  result: {
    recommendedSessionId: "2001-upper_push-m1",
    recommendedMovementFamily: "upper_push",
    selectedExerciseIds: ["5001"],
    sessionRationale: "Cycle-backed Rust plan result",
    progressionActionSummary: [
      {
        exerciseId: "5001",
        action: "overload",
        trend: "improving",
      },
    ],
    scoreBreakdown: {
      progressionNeed: 0.92,
      fatigueCompatibility: 0.88,
      classBias: 0.1,
      novelty: 0.02,
    },
  },
  statePatch: {},
  events: [],
  decisionLog: [],
  replayReceipt: {
    inputHash: "sha256:test-input",
    outputHash: "sha256:test-output",
    seedUsed: "cycle-seed-raw",
    effectiveAt: "2026-03-29T10:00:00.000Z",
    implementationVersion: "engine-rs-mvp-0",
    policyVersion: "policy-2026-02",
    referenceHash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
  },
});

describe("cycle-backed session generation", () => {
  beforeEach(() => {
    mockAdminSupabase = null;
    mockedRunEngineInput.mockReset();
    mockedRunEngineInput.mockResolvedValue(createEnginePlanOutput());
    const userId = "11111111-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-1",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              exerciseId: "5001",
              exerciseSlug: "bench-press",
              exerciseName: "Bench Press",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              restSeconds: 120,
              score: 0.92,
              rationale: "Cycle-backed primary slot",
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [],
      program_slots: [],
      exercises: [],
      exercise_muscle_map: [],
    });
  });

  it("returns the persisted cycle session before falling back to legacy generation", async () => {
    const result = await handleGenerateSession("11111111-1111-1111-1111-111111111111", {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result.status).toBe("success");
    expect(result.session?.programDayId).toBe("3001");
    expect(result.session?.seed).toBe("cycle-seed-1");
    expect(result.session?.slots[0]?.exerciseId).toBe("5001");
    expect(result.loadRecommendations).toEqual([]);
    expect(result.explanation).toBeUndefined();
  });

  it("regenerates and persists the active cycle session when normalized slot payload is still raw", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              movementPattern: "push",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              muscleTargets: { chest: 1 },
              tagsRequired: ["push"],
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_session_traces: [] as Array<Record<string, unknown>>,
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
          last_completed_at: "2026-03-28T10:00:00.000Z",
        },
      ],
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    };
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result.status).toBe("success");
    expect(mockedRunEngineInput).toHaveBeenCalledTimes(1);
    const firstEngineCall = mockedRunEngineInput.mock.calls[0]?.[0] as {
      request?: Record<string, unknown>;
      determinism?: {
        referenceHash?: string;
        canonicalizationVersion?: string;
      };
      referenceSnapshot?: unknown;
      stateSnapshot?: {
        progressionState?: {
          records?: unknown;
        };
      };
    };
    expect(firstEngineCall.request).toMatchObject({
      programId: "2001",
      microcycleIndex: 1,
      sessionFocus: "upper_push",
    });
    expect(firstEngineCall.determinism).toMatchObject({
      canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      referenceHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
    });
    expect(firstEngineCall.referenceSnapshot).toBeDefined();
    expect(firstEngineCall.determinism?.referenceHash).toBe(
      computeCanonicalReplayReferenceHash(firstEngineCall.referenceSnapshot as Record<string, unknown>)
    );
    expect(firstEngineCall.stateSnapshot?.progressionState?.records).toEqual([
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
        lastCompletedAt: "2026-03-28T10:00:00.000Z",
      },
    ]);
    expect(result.session?.seed).toBe("cycle-seed-raw");
    expect(result.session?.slots).toHaveLength(1);
    expect(result.session?.slots[0]?.exerciseId).toBe("5001");
    expect(result.explanation).toMatchObject({
      sessionRationale: "Cycle-backed Rust plan result",
      recommendedMovementFamily: "upper_push",
      selectedExerciseIds: ["5001"],
      replayReference: {
        seedUsed: "cycle-seed-raw",
      },
    });
    expect(store.engine_session_traces).toHaveLength(1);
    expect(store.engine_session_traces[0]).toMatchObject({
      operation: "plan_session",
      cycle_session_id: 1,
      cycle_plan_id: 1,
      workout_log_id: null,
    });
    const traceInputMaterial = store.engine_session_traces[0]
      .input_material as Record<string, unknown>;
    expect(traceInputMaterial.schemaVersion).toBe("engine.v1");
    expect(traceInputMaterial.operation).toBe("plan_session");
    expect(traceInputMaterial.determinism).toMatchObject({
      canonicalizationVersion: CANON_REPLAY_CANONICALIZATION_VERSION,
      ruleVersion: "rules-2026-03",
      referenceHash: firstEngineCall.determinism?.referenceHash,
    });
    expect(traceInputMaterial.metadata).toMatchObject({
      correlationId: "[REDACTED]",
    });
    expect(
      ((store.engine_cycle_sessions[0].slot_payload as Array<{ exerciseId?: string }>)[0]
        ?.exerciseId)
    ).toBe("5001");
  });

  it("does not persist generated cycle session payload if trace persistence fails", async () => {
    const userId = "12121212-1212-1212-1212-121212121212";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              movementPattern: "push",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              muscleTargets: { chest: 1 },
              tagsRequired: ["push"],
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationFailures: {
        engine_session_traces: {
          insert: {
            message: "forced engine trace persistence failure",
            code: "XX000",
          },
        },
      },
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["forced engine trace persistence failure"],
    });
    expect(store.engine_cycle_sessions[0].slot_payload).toEqual([
      {
        slotId: "4001",
        slotIndex: 0,
        slotType: "main",
        movementPattern: "push",
        setsMin: 4,
        setsMax: 5,
        repsMin: 3,
        repsMax: 5,
        muscleTargets: { chest: 1 },
        tagsRequired: ["push"],
      },
    ]);
    expect(store.engine_session_traces).toHaveLength(0);
  });

  it("rolls back the plan trace if generated cycle session payload persistence fails", async () => {
    const userId = "13131313-1313-1313-1313-131313131313";
    const rawSlotPayload = [
      {
        slotId: "4001",
        slotIndex: 0,
        slotType: "main",
        movementPattern: "push",
        setsMin: 4,
        setsMax: 5,
        repsMin: 3,
        repsMax: 5,
        muscleTargets: { chest: 1 },
        tagsRequired: ["push"],
      },
    ];
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: rawSlotPayload,
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    };

    mockSupabase = createMockSupabase(store, {
      mutationFailures: {
        engine_cycle_sessions: {
          update: {
            message: "forced cycle session persistence failure",
            code: "XX000",
          },
        },
      },
    });
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to persist generated active cycle session"],
    });
    expect(store.engine_cycle_sessions[0].slot_payload).toEqual(rawSlotPayload);
    expect(store.engine_session_traces).toHaveLength(0);
  });

  it("returns an error when no stable effectiveAt source exists for plan_session determinism", async () => {
    const userId = "12121212-1212-1212-1212-121212121212";
    mockSupabase = createMockSupabase({
      users: [
        {
          id: userId,
          stats_json: {
            ...createStats(),
            activeProgram: null,
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              movementPattern: "push",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              muscleTargets: { chest: 1 },
              tagsRequired: ["push"],
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          class_archetype: "hybrid",
        },
      ],
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
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
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Missing effectiveAt for cycle-backed plan_session input"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
  });

  it("sanitizes nested exercise equipment arrays before cycle-backed plan_session", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              movementPattern: "push",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              muscleTargets: { chest: 1 },
              tagsRequired: ["push"],
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [["dumbbell", "barbell", "machine"]],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    };
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result.status).toBe("success");
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceSnapshot: expect.objectContaining({
          exercises: expect.arrayContaining([
            expect.objectContaining({
              id: "5001",
              equipment: ["dumbbell", "barbell", "machine"],
            }),
          ]),
        }),
      })
    );
  });

  it("prefers the active normalized plan when historical plans exist", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 1999,
          current_session_index: 0,
          is_active: false,
          total_sessions: 1,
          resolved_class_archetype: "legacy",
        },
        {
          id: 2,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 1,
          is_active: true,
          total_sessions: 2,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3999,
          program_day_name: "Historical Day",
          session_seed: "legacy-seed",
          slot_payload: [],
          projected_fatigue_cost: {},
          completed_at: null,
        },
        {
          id: 2,
          plan_id: 2,
          user_id: userId,
          session_index: 1,
          program_day_id: 3001,
          program_day_name: "Active Day",
          session_seed: "active-seed",
          slot_payload: [
            {
              slotId: "5001",
              slotIndex: 0,
              slotType: "main",
              exerciseId: "6001",
              exerciseSlug: "front-squat",
              exerciseName: "Front Squat",
              setsMin: 3,
              setsMax: 4,
              repsMin: 4,
              repsMax: 6,
              restSeconds: 150,
              score: 0.98,
              rationale: "Active plan session",
            },
          ],
          projected_fatigue_cost: { legs: 10 },
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
          completed_session_count: 40,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-03-20T10:00:00.000Z",
          class_archetype: "legacy",
        },
        {
          id: 2,
          user_id: userId,
          plan_id: 2,
          xp: 140,
          level: 3,
          adherence_streak: 6,
          completed_session_count: 12,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [],
      program_slots: [],
      exercises: [],
      exercise_muscle_map: [],
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result.status).toBe("success");
    expect(result.session?.seed).toBe("active-seed");
    expect(result.session?.programDayName).toBe("Active Day");
    expect(result.session?.slots[0]?.exerciseId).toBe("6001");
    expect(result.session?.projectedFatigueCost).toEqual({ legs: 10 });
  });

  it("falls back to targeted slot generation instead of short-circuiting the active cycle session", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-1",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              exerciseId: "5001",
              exerciseSlug: "bench-press",
              exerciseName: "Bench Press",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              restSeconds: 120,
              score: 0.92,
              rationale: "Cycle-backed primary slot",
            },
          ],
          projected_fatigue_cost: { chest: 12 },
          completed_at: null,
        },
      ],
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5002,
              muscle_targets: { chest: 1 },
              sets_min: 3,
              sets_max: 3,
              reps_min: 8,
              reps_max: 8,
              rest_seconds: 90,
              tags_required: [],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5002,
          slug: "push-up",
          name: "Push-Up",
          movement_pattern: "push",
          equipment: [],
          tags: ["bodyweight"],
          contraindications: [],
          is_bodyweight: true,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5002,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "targeted-seed",
      slotId: "4001",
    });

    expect(result.status).toBe("success");
    expect(result.session?.seed).toBe("targeted-seed");
    expect(result.session?.slots).toHaveLength(1);
    expect(result.session?.slots[0]?.exerciseId).toBe("5002");
    expect(result.loadRecommendations).toHaveLength(1);
  });

  it("rejects wrong-day targeted generation requests while an active cycle session exists", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-1",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              exerciseId: "5001",
              exerciseSlug: "bench-press",
              exerciseName: "Bench Press",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              restSeconds: 120,
              score: 0.92,
              rationale: "Cycle-backed primary slot",
            },
          ],
          projected_fatigue_cost: { chest: 12 },
          completed_at: null,
        },
      ],
      program_days: [
        {
          id: 3999,
          program_id: 2001,
          name: "Wrong Day",
          day_index: 1,
          program_slots: [
            {
              id: 4002,
              program_day_id: 3999,
              slot_index: 0,
              slot_type: "main",
              lock_type: "none",
              locked_exercise_id: null,
              muscle_targets: { chest: 1 },
              sets_min: 3,
              sets_max: 3,
              reps_min: 8,
              reps_max: 8,
              rest_seconds: 90,
              tags_required: [],
            },
          ],
        },
      ],
      program_slots: [],
      exercises: [],
      exercise_muscle_map: [],
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3999",
      seed: "targeted-seed",
      slotId: "4002",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Requested program day does not match the active cycle session"],
    });
  });

  it("rejects plain wrong-day requests while an active cycle session exists", async () => {
    const result = await handleGenerateSession("11111111-1111-1111-1111-111111111111", {
      programDayId: "3999",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Requested program day does not match the active cycle session"],
    });
  });

  it("falls back to legacy generation when exclusions are requested for the active cycle session", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-1",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              exerciseId: "5001",
              exerciseSlug: "bench-press",
              exerciseName: "Bench Press",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              restSeconds: 120,
              score: 0.92,
              rationale: "Cycle-backed primary slot",
            },
          ],
          projected_fatigue_cost: { chest: 12 },
          completed_at: null,
        },
      ],
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "none",
              locked_exercise_id: null,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 4,
              reps_min: 6,
              reps_max: 6,
              rest_seconds: 120,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: true,
        },
        {
          id: 5002,
          slug: "push-up",
          name: "Push-Up",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: true,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
        {
          exercise_id: 5002,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "exclude-seed",
      excludeExerciseIds: ["5001"],
    });

    expect(result.status).toBe("success");
    expect(result.session?.seed).toBe("exclude-seed");
    expect(result.session?.slots).toHaveLength(1);
    expect(result.session?.slots[0]?.exerciseId).toBe("5002");
    expect(result.loadRecommendations).toHaveLength(1);
  });

  it("returns an error when the active cycle plan cannot be read", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase(
      {
        users: [{ id: userId, stats_json: createStats() }],
        engine_cycle_plans: [] as Array<Record<string, unknown>>,
        engine_cycle_sessions: [] as Array<Record<string, unknown>>,
        program_days: [] as Array<Record<string, unknown>>,
        program_slots: [] as Array<Record<string, unknown>>,
        exercises: [] as Array<Record<string, unknown>>,
        exercise_muscle_map: [] as Array<Record<string, unknown>>,
      },
      {
        queryFailures: {
          engine_cycle_plans: { message: "forced cycle plan read failure" },
        },
      }
    );

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load active cycle plan"],
    });
  });

  it("treats an active plan with no current session row as terminal instead of falling back to legacy generation", async () => {
    const userId = "77777777-1111-1111-1111-111111111111";
    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 9,
          is_active: true,
          total_sessions: 9,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [] as Array<Record<string, unknown>>,
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Legacy Day",
          day_index: 0,
          program_slots: [],
        },
      ],
      program_slots: [],
      exercises: [],
      exercise_muscle_map: [],
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Active cycle is completed"],
    });
  });

  it("returns an error when Rust plan_session output is malformed for a raw active cycle session", async () => {
    const userId = "12121212-1111-1111-1111-111111111111";
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "plan_session",
      result: {},
    });

    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              movementPattern: "push",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              muscleTargets: { chest: 1 },
              tagsRequired: ["push"],
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    });

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Engine returned invalid plan_session output"],
    });
  });

  it("omits the session explanation when the persisted plan trace replay metadata cannot be normalized into the read-model contract", async () => {
    const userId = "13131313-1111-1111-1111-111111111111";
    mockedRunEngineInput.mockResolvedValue({
      ...createEnginePlanOutput(),
      replayReceipt: {
        ...createEnginePlanOutput().replayReceipt,
        effectiveAt: "not-a-datetime",
      },
    });

    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          primary_program_id: 2001,
          current_session_index: 0,
          is_active: true,
          total_sessions: 1,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 1,
          plan_id: 1,
          user_id: userId,
          session_index: 0,
          program_day_id: 3001,
          program_day_name: "Strength Day 1",
          session_seed: "cycle-seed-raw",
          slot_payload: [
            {
              slotId: "4001",
              slotIndex: 0,
              slotType: "main",
              movementPattern: "push",
              setsMin: 4,
              setsMax: 5,
              repsMin: 3,
              repsMax: 5,
              muscleTargets: { chest: 1 },
              tagsRequired: ["push"],
            },
          ],
          projected_fatigue_cost: { chest: 12 },
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
          last_awarded_at: "2026-03-28T10:00:00.000Z",
          class_archetype: "hybrid",
        },
      ],
      engine_session_traces: [] as Array<Record<string, unknown>>,
      engine_progression_states: [] as Array<Record<string, unknown>>,
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          name: "Strength Day 1",
          day_index: 0,
          program_slots: [
            {
              id: 4001,
              program_day_id: 3001,
              slot_index: 0,
              slot_type: "main",
              lock_type: "hard",
              locked_exercise_id: 5001,
              muscle_targets: { chest: 1 },
              sets_min: 4,
              sets_max: 5,
              reps_min: 3,
              reps_max: 5,
              tags_required: ["push"],
            },
          ],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["push"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 5001,
          muscle_group_slug: "chest",
          role: "primary",
          contribution: 1,
        },
      ],
    };
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleGenerateSession(userId, {
      programDayId: "3001",
      seed: "ignored-seed",
    });

    expect(result.status).toBe("success");
    expect(result.explanation).toBeUndefined();
    expect(store.engine_session_traces).toHaveLength(1);
  });
});
