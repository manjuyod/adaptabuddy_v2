import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleInitializeCycle } from "../src/modules/cycles/service";
import { CANON_REPLAY_CANONICALIZATION_VERSION, computeCanonicalReplayReferenceHash } from "../src/lib/engine-replay";
import { createMockSupabase } from "./helpers/mockSupabase";

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

import { runEngineInput } from "../src/lib/engine-runner";

const mockedRunEngineInput = vi.mocked(runEngineInput);
const richerGamificationState = {
  xp: 140,
  level: 3,
  adherenceStreak: 6,
  completedSessionCount: 12,
  missedSessionCount: 0,
  lastAdherenceOutcomeClassification: "complete_clean",
  lastAwardedAt: "2026-02-10T10:00:00.000Z",
} as const;

const createStats = (): UserStats => ({
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

const createActivePlanInsertGuard = () => ({
  insert: ({ table, payload, store }: {
    table: string;
    payload: Record<string, unknown> | Record<string, unknown>[] | null;
    store: Record<string, Array<Record<string, unknown>>>;
  }) => {
    if (table !== "engine_cycle_plans" || !payload || Array.isArray(payload)) {
      return null;
    }

    if (payload.is_active === false) {
      return null;
    }

    const conflictingActivePlan = (store.engine_cycle_plans ?? []).find(
      (row) => row.user_id === payload.user_id && row.is_active === true
    );

    if (!conflictingActivePlan) {
      return null;
    }

    return {
      code: "23505",
      message: "duplicate key value violates unique constraint \"idx_engine_cycle_plans_user_active\"",
    };
  },
});

describe("initialize cycle service", () => {
  beforeEach(() => {
    mockAdminSupabase = null;
    mockedRunEngineInput.mockReset();
  });

  it("persists the initialized cycle tables and updates stats_json projection", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const existingProfileId = 7;
    const existingPlanId = 11;
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [
        { id: 2001, slug: "strength", name: "Strength Builder", is_active: true },
        { id: 2002, slug: "hypertrophy", name: "Hypertrophy Builder", is_active: true },
      ],
      program_days: [
        { id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" },
        { id: 3002, program_id: 2002, day_index: 0, name: "Hypertrophy Day 1" },
      ],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1, shoulders: 0.4 },
          tags_required: ["compound"],
        },
        {
          id: 4002,
          program_day_id: 3002,
          slot_index: 0,
          slot_type: "accessory",
          movement_pattern: "pull",
          sets_min: 3,
          sets_max: 4,
          reps_min: 8,
          reps_max: 12,
          muscle_targets: { back: 1 },
          tags_required: ["hypertrophy"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [
        { id: existingProfileId, user_id: "existing-user", resolved_class_archetype: "legacy" },
      ] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        { id: existingPlanId, user_id: "existing-user", profile_id: existingProfileId },
      ] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [
          { programId: "2001", weight: 0.7, role: "primary" },
          { programId: "2002", weight: 0.3, role: "secondary" },
        ],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [
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
                  tagsRequired: ["compound"],
                  sourceProgramId: "2001",
                  sourceProgramDayId: "3001",
                },
              ],
            },
          ],
        },
        initialGamificationState: {
          ...richerGamificationState,
        },
      },
      statePatch: {
        gamificationState: {
          ...richerGamificationState,
        },
      },
      events: [],
      decisionLog: [],
      replayReceipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed",
        effectiveAt: "2026-03-29T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
      },
    });

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 2001, weight: 0.7 },
        { programId: 2002, weight: 0.3 },
      ],
    });

    expect(result).toMatchObject({
      status: "success",
      resolvedClassArchetype: "hybrid",
      primaryProgramId: "2001",
      totalSessions: 1,
    });
    expect(store.engine_cycle_profiles).toHaveLength(2);
    const persistedProfile = store.engine_cycle_profiles[store.engine_cycle_profiles.length - 1];
    expect(persistedProfile.id).toBe(existingProfileId + 1);
    expect(persistedProfile.class_choice).toBe("hybrid");
    expect(persistedProfile).not.toHaveProperty("resolved_class_archetype");
    expect(store.engine_cycle_program_mix).toHaveLength(2);
    expect(store.engine_cycle_plans).toHaveLength(2);
    const persistedPlan = store.engine_cycle_plans[store.engine_cycle_plans.length - 1];
    expect(persistedPlan.id).toBe(existingPlanId + 1);
    expect(persistedPlan.profile_id).toBe(persistedProfile.id);
    expect(persistedPlan.resolved_class_archetype).toBe("hybrid");
    expect(store.engine_cycle_sessions).toHaveLength(1);
    expect(store.engine_cycle_sessions[0].plan_id).toBe(persistedPlan.id);
    expect(store.engine_cycle_sessions[0].class_archetype).toBe("hybrid");
    expect(store.engine_gamification_states).toHaveLength(1);
    expect(store.engine_gamification_states[0].plan_id).toBe(persistedPlan.id);
    expect(store.engine_gamification_states[0]).toMatchObject({
      class_archetype: "hybrid",
      completed_session_count: 12,
      missed_session_count: 0,
      last_adherence_outcome_classification: "complete_clean",
      last_awarded_at: "2026-02-10T10:00:00.000Z",
    });
    expect((store.users[0].stats_json as UserStats).activeProgram?.programId).toBe("2001");
    const engineInput = mockedRunEngineInput.mock.calls[0]?.[0] as {
      determinism?: {
        referenceHash?: string;
        canonicalizationVersion?: string;
      };
      referenceSnapshot?: unknown;
    } | undefined;
    expect(engineInput?.determinism?.canonicalizationVersion).toBe(
      CANON_REPLAY_CANONICALIZATION_VERSION
    );
    expect(engineInput?.determinism?.referenceHash).toMatch(
      /^sha256:[0-9a-f]{64}$/
    );
    expect(engineInput?.referenceSnapshot).toBeDefined();
    expect(engineInput?.determinism?.referenceHash).toBe(
      computeCanonicalReplayReferenceHash(
        (engineInput?.referenceSnapshot as Record<string, unknown>) ?? {}
      )
    );
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        stateSnapshot: expect.objectContaining({
          athleteProfile: expect.objectContaining({
            classArchetype: "hybrid",
          }),
        }),
        request: expect.objectContaining({
          profile: expect.objectContaining({
            classChoice: "hybrid",
          }),
        }),
      })
    );
  });

  it("changes reference hash when initialize_cycle reference snapshot changes", async () => {
    const userId = "10101010-1010-1010-1010-101010101010";
    const baseStore = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [
        { id: 2001, slug: "strength", name: "Strength Builder", is_active: true },
        { id: 2002, slug: "hypertrophy", name: "Hypertrophy Builder", is_active: true },
      ],
      program_days: [
        { id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" },
        { id: 3002, program_id: 2002, day_index: 0, name: "Hypertrophy Day 1" },
      ],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1, shoulders: 0.4 },
          tags_required: ["compound"],
        },
        {
          id: 4002,
          program_day_id: 3002,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "pull",
          sets_min: 3,
          sets_max: 4,
          reps_min: 8,
          reps_max: 12,
          muscle_targets: { back: 1 },
          tags_required: ["hypertrophy"],
        },
      ],
      exercises: [
        {
          id: 5001,
          slug: "bench-press",
          name: "Bench Press",
          movement_pattern: "push",
          equipment: [],
          tags: ["compound"],
          contraindications: [],
          is_bodyweight: false,
        },
        {
          id: 5002,
          slug: "row",
          name: "Barbell Row",
          movement_pattern: "pull",
          equipment: [],
          tags: ["hypertrophy"],
          contraindications: [],
          is_bodyweight: false,
        },
      ],
      exercise_muscle_map: [
        { exercise_id: 5001, role: "primary", contribution: 1, muscle_group_slug: "chest" },
        { exercise_id: 5002, role: "primary", contribution: 1, muscle_group_slug: "back" },
      ],
      muscle_groups: [
        { id: 1, slug: "shoulders", name: "Shoulders" },
        { id: 2, slug: "back", name: "Back" },
      ],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(baseStore);
    mockAdminSupabase = createMockSupabase(baseStore);
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [
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
                  tagsRequired: ["compound"],
                  sourceProgramId: "2001",
                  sourceProgramDayId: "3001",
                },
              ],
            },
          ],
        },
        initialGamificationState: richerGamificationState,
      },
      statePatch: {
        gamificationState: {
          ...richerGamificationState,
        },
      },
      events: [],
      decisionLog: [],
      replayReceipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed",
        effectiveAt: "2026-03-29T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
      },
    });

    const first = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(first.status).toBe("success");
    const firstCall = mockedRunEngineInput.mock.calls[0]?.[0] as {
      determinism?: {
        referenceHash?: string;
        canonicalizationVersion?: string;
      };
      referenceSnapshot?: Record<string, unknown>;
    };
    const firstReferenceHash = firstCall.determinism?.referenceHash;
    expect(firstReferenceHash).toBe(
      computeCanonicalReplayReferenceHash((firstCall.referenceSnapshot as Record<string, unknown>) ?? {})
    );

    mockedRunEngineInput.mockReset();
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [
          { programId: "2001", weight: 0.7, role: "primary" },
          { programId: "2002", weight: 0.3, role: "secondary" },
        ],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [
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
                  tagsRequired: ["compound"],
                  sourceProgramId: "2001",
                  sourceProgramDayId: "3001",
                },
              ],
            },
          ],
        },
        initialGamificationState: richerGamificationState,
      },
      statePatch: {
        gamificationState: {
          ...richerGamificationState,
        },
      },
      events: [],
      decisionLog: [],
      replayReceipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed",
        effectiveAt: "2026-03-29T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
      },
    });

    const second = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 2001, weight: 0.7 },
        { programId: 2002, weight: 0.3 },
      ],
    });

    expect(second.status).toBe("success");
    const secondCall = mockedRunEngineInput.mock.calls[0]?.[0] as {
      determinism?: {
        referenceHash?: string;
        canonicalizationVersion?: string;
      };
      referenceSnapshot?: Record<string, unknown>;
    };
    const secondReferenceHash = secondCall.determinism?.referenceHash;
    expect(secondReferenceHash).toBe(
      computeCanonicalReplayReferenceHash((secondCall.referenceSnapshot as Record<string, unknown>) ?? {})
    );
    expect(secondReferenceHash).not.toBe(firstReferenceHash);
  });

  it("rolls back normalized cycle rows when session persistence fails after parent inserts", async () => {
    const userId = "22222222-2222-2222-2222-222222222222";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [
        { id: 2001, slug: "strength", name: "Strength Builder", is_active: true },
        { id: 2002, slug: "hypertrophy", name: "Hypertrophy Builder", is_active: true },
      ],
      program_days: [
        { id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" },
        { id: 3002, program_id: 2002, day_index: 0, name: "Hypertrophy Day 1" },
      ],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1, shoulders: 0.4 },
          tags_required: ["compound"],
        },
        {
          id: 4002,
          program_day_id: 3002,
          slot_index: 0,
          slot_type: "accessory",
          movement_pattern: "pull",
          sets_min: 3,
          sets_max: 4,
          reps_min: 8,
          reps_max: 12,
          muscle_targets: { back: 1 },
          tags_required: ["hypertrophy"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationFailures: {
        engine_cycle_sessions: {
          insert: { message: "forced session insert failure" },
        },
      },
    });
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [
          { programId: "2001", weight: 0.7, role: "primary" },
          { programId: "2002", weight: 0.3, role: "secondary" },
        ],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [
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
                  tagsRequired: ["compound"],
                  sourceProgramId: "2001",
                  sourceProgramDayId: "3001",
                },
              ],
            },
          ],
        },
        initialGamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
      statePatch: {
        gamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
      events: [],
      decisionLog: [],
      replayReceipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed",
        effectiveAt: "2026-03-29T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00",
      },
    });

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 2001, weight: 0.7 },
        { programId: 2002, weight: 0.3 },
      ],
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") {
      throw new Error("Expected initialize cycle failure result");
    }
    expect(result.errors).toEqual(["Failed to persist cycle sessions: forced session insert failure"]);
    expect(store.engine_cycle_profiles).toHaveLength(0);
    expect(store.engine_cycle_program_mix).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(0);
    expect(store.engine_cycle_sessions).toHaveLength(0);
    expect(store.engine_gamification_states).toHaveLength(0);
    expect((store.users[0].stats_json as UserStats).activeProgram).toBeNull();
  });

  it("re-initializes by deactivating the previous active plan before inserting the new active plan", async () => {
    const userId = "33333333-3333-3333-3333-333333333333";
    const store = {
      users: [
        {
          id: userId,
          stats_json: {
            ...createStats(),
            activeProgram: {
              programId: "1999",
              startedAt: "2026-03-01T00:00:00.000Z",
              currentDayIndex: 2,
              currentMicrocycle: 1,
              daysPerWeek: 3,
            },
          },
        },
      ],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [
        { id: 5, user_id: userId, resolved_class_archetype: "legacy" },
      ] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 8,
          user_id: userId,
          profile_id: 5,
          primary_program_id: 1999,
          current_session_index: 2,
          is_active: true,
        },
      ] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [
        {
          id: 9,
          user_id: userId,
          plan_id: 8,
          session_index: 2,
          program_day_id: 3999,
          completed_at: null,
        },
      ] as Array<Record<string, unknown>>,
      engine_gamification_states: [
        {
          id: 10,
          user_id: userId,
          plan_id: 8,
          xp: 80,
          level: 2,
          adherence_streak: 3,
          completed_session_count: 9,
          missed_session_count: 1,
          last_adherence_outcome_classification: "partial",
          last_awarded_at: "2026-03-15T10:00:00.000Z",
        },
      ] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationGuards: createActivePlanInsertGuard(),
    });
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-2-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [
                {
                  slotId: "4001",
                  slotIndex: 0,
                  slotType: "main",
                  movementPattern: "push",
                  setsMin: 4,
                  setsMax: 5,
                  repsMin: 3,
                  repsMax: 5,
                },
              ],
            },
          ],
        },
        initialGamificationState: {
          xp: 80,
          level: 2,
          adherenceStreak: 3,
          completedSessionCount: 9,
          missedSessionCount: 1,
          lastAdherenceOutcomeClassification: "partial",
          lastAwardedAt: "2026-03-15T10:00:00.000Z",
        },
      },
    });

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toMatchObject({
      status: "success",
      primaryProgramId: "2001",
      totalSessions: 1,
    });
    expect(store.engine_cycle_plans).toHaveLength(2);
    expect(store.engine_cycle_plans.filter((plan) => plan.is_active === true)).toHaveLength(1);
    expect(store.engine_cycle_plans[0].is_active).toBe(false);
    expect(store.engine_cycle_plans[1].is_active).toBe(true);
    expect(store.engine_cycle_sessions).toHaveLength(2);
    expect(store.engine_gamification_states).toHaveLength(2);
    expect(store.engine_gamification_states[1]).toMatchObject({
      xp: 80,
      level: 2,
      adherence_streak: 3,
      completed_session_count: 9,
      missed_session_count: 1,
      last_adherence_outcome_classification: "partial",
      last_awarded_at: "2026-03-15T10:00:00.000Z",
      class_archetype: "hybrid",
    });
    expect(mockedRunEngineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        stateSnapshot: expect.objectContaining({
          gamificationState: {
            xp: 80,
            level: 2,
            adherenceStreak: 3,
            completedSessionCount: 9,
            missedSessionCount: 1,
            lastAdherenceOutcomeClassification: "partial",
            lastAwardedAt: "2026-03-15T10:00:00.000Z",
          },
        }),
      })
    );
    expect((store.users[0].stats_json as UserStats).activeProgram?.programId).toBe("2001");
  });

  it("restores the previous active plan when re-initialize fails after the new plan is inserted", async () => {
    const userId = "44444444-4444-4444-4444-444444444444";
    const store = {
      users: [
        {
          id: userId,
          stats_json: {
            ...createStats(),
            activeProgram: {
              programId: "1999",
              startedAt: "2026-03-01T00:00:00.000Z",
              currentDayIndex: 2,
              currentMicrocycle: 1,
              daysPerWeek: 3,
            },
          },
        },
      ],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [
        { id: 5, user_id: userId, resolved_class_archetype: "legacy" },
      ] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 8,
          user_id: userId,
          profile_id: 5,
          primary_program_id: 1999,
          current_session_index: 2,
          is_active: true,
        },
      ] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [
        {
          id: 9,
          user_id: userId,
          plan_id: 8,
          session_index: 2,
          program_day_id: 3999,
          completed_at: null,
        },
      ] as Array<Record<string, unknown>>,
      engine_gamification_states: [
        {
          id: 10,
          user_id: userId,
          plan_id: 8,
          xp: 80,
          level: 2,
          adherence_streak: 3,
        },
      ] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store, {
      mutationGuards: createActivePlanInsertGuard(),
      mutationFailures: {
        engine_cycle_sessions: {
          insert: { message: "forced session insert failure" },
        },
      },
    });
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-2-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [
                {
                  slotId: "4001",
                  slotIndex: 0,
                  slotType: "main",
                  movementPattern: "push",
                  setsMin: 4,
                  setsMax: 5,
                  repsMin: 3,
                  repsMax: 5,
                },
              ],
            },
          ],
        },
        initialGamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
    });

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to persist cycle sessions: forced session insert failure"],
    });
    expect(store.engine_cycle_profiles).toHaveLength(1);
    expect(store.engine_cycle_program_mix).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(1);
    expect(store.engine_cycle_plans[0].id).toBe(8);
    expect(store.engine_cycle_plans[0].is_active).toBe(true);
    expect(store.engine_cycle_sessions).toHaveLength(1);
    expect(store.engine_cycle_sessions[0].plan_id).toBe(8);
    expect(store.engine_gamification_states).toHaveLength(1);
    expect(store.engine_gamification_states[0].plan_id).toBe(8);
    expect((store.users[0].stats_json as UserStats).activeProgram?.programId).toBe("1999");
  });

  it("rejects selected programs with missing days or slot templates before calling the engine", async () => {
    const userId = "55555555-5555-5555-5555-555555555555";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [
        { id: 2001, slug: "strength", name: "Strength Builder", is_active: true },
        { id: 2002, slug: "hypertrophy", name: "Hypertrophy Builder", is_active: true },
      ],
      program_days: [{ id: 3001, program_id: 2002, day_index: 0, name: "Hypertrophy Day 1" }],
      program_slots: [] as Array<Record<string, unknown>>,
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [
        { programId: 2001, weight: 0.5 },
        { programId: 2002, weight: 0.5 },
      ],
    });

    expect(result).toEqual({
      status: "error",
      errors: [
        "Selected program templates are incomplete: program 2001 has no program days; program 2002 day 3001 has no program slots",
      ],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
    expect(store.engine_cycle_profiles).toHaveLength(0);
    expect(store.engine_cycle_program_mix).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(0);
  });

  it("returns an error when muscle group reference data fails to load", async () => {
    const userId = "66666666-6666-6666-6666-666666666666";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [] as Array<Record<string, unknown>>,
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store, {
      queryFailures: {
        muscle_groups: { message: "forced muscle group lookup failure" },
      },
    });
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load muscle groups for cycle initialization"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
  });

  it("returns an error when current user state fails to load before initialization", async () => {
    const userId = "67676767-6767-6767-6767-676767676767";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store, {
      queryFailures: {
        users: { message: "forced user state read failure" },
      },
    });
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load current user state: forced user state read failure"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
    expect(store.engine_cycle_profiles).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(0);
  });

  it("returns an error when an active plan exists without a normalized gamification row", async () => {
    const userId = "78787878-7878-7878-7878-787878787878";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [
        { id: 5, user_id: userId, resolved_class_archetype: "legacy" },
      ] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [
        {
          id: 8,
          user_id: userId,
          profile_id: 5,
          primary_program_id: 1999,
          current_session_index: 2,
          is_active: true,
        },
      ] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Failed to load current cycle gamification state: missing active gamification row"],
    });
    expect(mockedRunEngineInput).not.toHaveBeenCalled();
    expect(store.engine_cycle_profiles).toHaveLength(1);
    expect(store.engine_cycle_plans).toHaveLength(1);
  });

  it("seeds compatibility cursor fields from the active normalized session row", async () => {
    const userId = "77777777-7777-7777-7777-777777777777";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 4,
              sessionIndex: 0,
              plannedDayOfWeek: 2,
              classArchetype: "hybrid",
              slotPayload: [
                {
                  slotId: "4001",
                  slotIndex: 0,
                  slotType: "main",
                  movementPattern: "push",
                  setsMin: 4,
                  setsMax: 5,
                  repsMin: 3,
                  repsMax: 5,
                },
              ],
            },
          ],
        },
        initialGamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
    });

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result.status).toBe("success");
    const projectedStats = store.users[0].stats_json as UserStats;
    expect(projectedStats.activeProgram?.currentDayIndex).toBe(2);
    expect(projectedStats.activeProgram?.currentMicrocycle).toBe(5);
  });

  it("rejects initialize output when resolvedClassArchetype is missing or non-canonical", async () => {
    const userId = "88888888-8888-8888-8888-888888888888";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [],
            },
          ],
        },
        initialGamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
    });

    const missingResolvedResult = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(missingResolvedResult).toEqual({
      status: "error",
      errors: ["Engine did not return an initialize_cycle result"],
    });
    expect(store.engine_cycle_profiles).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(0);

    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "legacy",
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "hybrid",
              slotPayload: [],
            },
          ],
        },
        initialGamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
    });

    const nonCanonicalResolvedResult = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(nonCanonicalResolvedResult).toEqual({
      status: "error",
      errors: ["Engine did not return an initialize_cycle result"],
    });
    expect(store.engine_cycle_profiles).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(0);
  });

  it("rejects initialize output when session classArchetype values do not match the resolved archetype", async () => {
    const userId = "99999999-9999-9999-9999-999999999999";
    const store = {
      users: [{ id: userId, stats_json: createStats() }],
      programs: [{ id: 2001, slug: "strength", name: "Strength Builder", is_active: true }],
      program_days: [{ id: 3001, program_id: 2001, day_index: 0, name: "Strength Day 1" }],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          movement_pattern: "push",
          sets_min: 4,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { chest: 1 },
          tags_required: ["compound"],
        },
      ],
      exercises: [],
      exercise_muscle_map: [],
      muscle_groups: [{ id: 1, slug: "shoulders", name: "Shoulders" }],
      engine_cycle_profiles: [] as Array<Record<string, unknown>>,
      engine_cycle_program_mix: [] as Array<Record<string, unknown>>,
      engine_cycle_plans: [] as Array<Record<string, unknown>>,
      engine_cycle_sessions: [] as Array<Record<string, unknown>>,
      engine_gamification_states: [] as Array<Record<string, unknown>>,
    };

    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
    mockedRunEngineInput.mockResolvedValue({
      schemaVersion: "engine.v1",
      operation: "initialize_cycle",
      result: {
        resolvedClassArchetype: "hybrid",
        primaryProgramId: "2001",
        programBlend: [{ programId: "2001", weight: 1, role: "primary" }],
        macrocycle: {
          totalWeeks: 8,
          mesocycleCount: 2,
          currentMesocycleIndex: 0,
          currentMicrocycleIndex: 0,
          currentSessionIndex: 0,
          sessions: [
            {
              sessionId: "plan-1-w1-d1",
              programId: "2001",
              programDayId: "3001",
              programDayName: "Strength Day 1",
              macroWeek: 1,
              mesocycleIndex: 0,
              microcycleIndex: 0,
              sessionIndex: 0,
              plannedDayOfWeek: 0,
              classArchetype: "strength",
              slotPayload: [],
            },
          ],
        },
        initialGamificationState: {
          xp: 140,
          level: 3,
          adherenceStreak: 6,
        },
      },
    });

    const result = await handleInitializeCycle(userId, {
      classPresetId: "classless",
      goalBias: "strength",
      availableDaysPerWeek: 3,
      fatiguePreference: "moderate",
      injuryMuscleGroupSlugs: ["shoulders"],
      macrocycleWeeks: 8,
      selectedPrograms: [{ programId: 2001, weight: 1 }],
    });

    expect(result).toEqual({
      status: "error",
      errors: ["Engine did not return a canonical initialize_cycle result"],
    });
    expect(store.engine_cycle_profiles).toHaveLength(0);
    expect(store.engine_cycle_plans).toHaveLength(0);
    expect(store.engine_cycle_sessions).toHaveLength(0);
    expect(store.engine_gamification_states).toHaveLength(0);
  });
});
