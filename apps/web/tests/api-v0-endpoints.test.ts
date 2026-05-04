import { describe, expect, it, vi } from "vitest";
import { DEFAULT_OPT_INS, type UserStats } from "@adaptabuddy/contracts";
import { handleVolumeAllocate } from "../src/modules/volume/service";
import { handleResolveTemplate } from "../src/modules/templates/service";
import { handleChaosPlan } from "../src/modules/chaos/service";
import { handleProgressionRecommend } from "../src/modules/progression/service";
import { handleGuardrailEvaluate } from "../src/modules/guardrails/service";
import { handleOptInUpdate } from "../src/modules/optins/service";
import { handleDeviationAnalyze } from "../src/modules/deviation/service";
import { createMockSupabase } from "./helpers/mockSupabase";

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => null,
}));

describe("api v0 services", () => {
  it("allocates volume based on fatigue state", async () => {
    const userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const stats: UserStats = {
      activeProgram: null,
      fatigue: {
        chest: { current: 10, lastUpdated: "2026-02-01T00:00:00.000Z" },
      },
      mastery: {},
      capacities: {},
      progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    const store = {
      users: [{ id: userId, stats_json: stats }],
    };

    mockSupabase = createMockSupabase(store);

    const result = await handleVolumeAllocate(userId, {
      totalSets: 12,
      musclePriorities: { chest: 1, back: 1 },
      trainingAge: "intermediate",
    });

    expect(result.status).toBe("success");
    expect(result.allocation?.allocations.chest).toBeDefined();
    expect(result.allocation?.allocations.back).toBeDefined();
  });

  it("resolves templates to a concrete session requirement", async () => {
    const userId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const templateId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const dayId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const slotId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

    mockSupabase = createMockSupabase({
      programs: [
        {
          id: templateId,
          name: "Full Body",
          days_per_week: 3,
          volume_distribution: null,
        },
      ],
      program_days: [
        {
          id: dayId,
          program_id: templateId,
          day_index: 0,
          name: "Day 1",
          intensity_target: "moderate",
          volume_multiplier: 1,
        },
      ],
      program_slots: [
        {
          id: slotId,
          program_day_id: dayId,
          slot_index: 0,
          slot_type: "main",
          muscle_targets: { chest: 1 },
          sets_min: 3,
          sets_max: 3,
          reps_min: 5,
          reps_max: 5,
          rir_min: 2,
          rir_max: 3,
          tags: [],
          movement_pattern: "push",
        },
      ],
    });

    const result = await handleResolveTemplate(userId, {
      templateId,
      weekNumber: 1,
      dayNumber: 0,
    });

    expect(result.status).toBe("success");
    expect(result.sessionRequirement?.templateId).toBe(templateId);
    expect(result.sessionRequirement?.slots.length).toBe(1);
  });

  it("builds a chaos plan from multiple templates", async () => {
    const userId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const templateA = "11111111-2222-3333-4444-555555555555";
    const templateB = "66666666-7777-8888-9999-000000000000";
    const dayA = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const dayB = "11111111-aaaa-bbbb-cccc-222222222222";

    mockSupabase = createMockSupabase({
      programs: [
        { id: templateA, name: "Template A", days_per_week: 2, volume_distribution: null },
        { id: templateB, name: "Template B", days_per_week: 2, volume_distribution: null },
      ],
      program_days: [
        {
          id: dayA,
          program_id: templateA,
          day_index: 0,
          name: "Day A1",
          intensity_target: "moderate",
          volume_multiplier: 1,
        },
        {
          id: dayB,
          program_id: templateB,
          day_index: 0,
          name: "Day B1",
          intensity_target: "moderate",
          volume_multiplier: 1,
        },
      ],
      program_slots: [
        {
          id: "slot-a",
          program_day_id: dayA,
          slot_index: 0,
          slot_type: "main",
          muscle_targets: { back: 1 },
          sets_min: 3,
          sets_max: 3,
          reps_min: 5,
          reps_max: 5,
          rir_min: 2,
          rir_max: 3,
          tags: [],
          movement_pattern: "pull",
        },
        {
          id: "slot-b",
          program_day_id: dayB,
          slot_index: 0,
          slot_type: "main",
          muscle_targets: { chest: 1 },
          sets_min: 3,
          sets_max: 3,
          reps_min: 5,
          reps_max: 5,
          rir_min: 2,
          rir_max: 3,
          tags: [],
          movement_pattern: "push",
        },
      ],
    });

    const result = await handleChaosPlan(userId, {
      templateIds: [templateA, templateB],
      weeks: 1,
      daysPerWeek: 2,
      seed: "seed-rotate",
      mode: "rotate",
    });

    expect(result.status).toBe("success");
    expect(result.plan?.sessions.length).toBe(2);
    expect(result.plan?.sessions[0].templateId).toBe(templateA);
    expect(result.plan?.sessions[1].templateId).toBe(templateB);
  });

  it("recommends progression loads based on capacities", async () => {
    const userId = "99999999-8888-7777-6666-555555555555";
    const exerciseId = "44444444-3333-2222-1111-000000000000";
    const stats: UserStats = {
      activeProgram: null,
      fatigue: {},
      mastery: {},
      capacities: {
        [exerciseId]: {
          estimated1RM: 120,
          lastWeight: 100,
          lastReps: 5,
          confidence: 0.6,
          lastPerformed: "2026-02-01T00:00:00.000Z",
        },
      },
      progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    const store = {
      users: [{ id: userId, stats_json: stats }],
    };

    mockSupabase = createMockSupabase(store);

    const result = await handleProgressionRecommend(userId, {
      exerciseIds: [exerciseId],
      repsMin: 6,
      repsMax: 8,
    });

    expect(result.status).toBe("success");
    expect(result.recommendations?.length).toBe(1);
    expect(result.recommendations?.[0].recommendedWeight).not.toBeNull();
  });

  it("evaluates guardrails using user stats context", async () => {
    const userId = "12121212-3434-5656-7878-909090909090";
    const stats: UserStats = {
      activeProgram: null,
      fatigue: { chest: { current: 0, lastUpdated: "2026-02-01T00:00:00.000Z" } },
      mastery: {},
      capacities: {},
      progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    const store = {
      users: [{ id: userId, stats_json: stats }],
    };

    mockSupabase = createMockSupabase(store);

    const result = await handleGuardrailEvaluate(userId, {
      action: "volume_change",
      weeklyVolume: { chest: 40 },
      trainingAge: "intermediate",
    });

    expect(result.status).toBe("success");
    expect(result.evaluation?.blockers?.length).toBeGreaterThan(0);
  });

  it("analyzes deviations and returns a rebalanced plan", async () => {
    const userId = "60606060-3434-5656-7878-909090909090";
    const stats: UserStats = {
      activeProgram: null,
      fatigue: {
        chest: { current: 72, lastUpdated: "2026-02-01T00:00:00.000Z" },
        back: { current: 30, lastUpdated: "2026-02-01T00:00:00.000Z" },
      },
      mastery: {},
      capacities: {},
      progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: [],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    mockSupabase = createMockSupabase({
      users: [{ id: userId, stats_json: stats }],
    });

    const result = await handleDeviationAnalyze(userId, {
      plannedSession: {
        sessionId: "planned-1",
        scheduledAt: "2026-02-14T10:00:00.000Z",
        exercises: [
          {
            exerciseId: 101,
            muscleTargets: { chest: 1 },
            plannedSets: 4,
            plannedLoad: 100,
          },
        ],
      },
      actualSession: {
        completedAt: "2026-02-14T08:00:00.000Z",
        exercises: [
          {
            exerciseId: 101,
            completedSets: 6,
            avgLoad: 108,
          },
        ],
      },
      remainingPlan: [
        {
          sessionId: "remaining-1",
          targetVolumeSets: { chest: 8 },
          intensityMultiplier: 1,
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.analysis?.deviations.length).toBeGreaterThan(0);
    expect(result.rebalancedPlan?.sessions.length).toBe(1);
  });

  it("updates opt-ins and acknowledgments in stats_json", async () => {
    const userId = "99990000-aaaa-bbbb-cccc-111122223333";
    const stats: UserStats = {
      activeProgram: null,
      fatigue: {},
      mastery: {},
      capacities: {},
      progression: { totalWorkouts: 0, weeklyVolume: 0, lastWorkoutAt: null },
      preferences: {
        fatigueLevel: "moderate",
        equipment: [],
        injuries: [],
        acknowledgedRisks: ["prev-warning"],
        optIns: { ...DEFAULT_OPT_INS },
      },
    };

    const store = {
      users: [{ id: userId, stats_json: stats }],
    };

    mockSupabase = createMockSupabase(store);

    const result = await handleOptInUpdate(userId, {
      optIns: { ...DEFAULT_OPT_INS, allowExtremeVolume: true },
      acknowledgedRisks: ["new-warning"],
    });

    expect(result.status).toBe("success");
    const updatedStats = store.users[0].stats_json as UserStats;
    expect(updatedStats.preferences.optIns.allowExtremeVolume).toBe(true);
    expect(updatedStats.preferences.acknowledgedRisks).toContain("prev-warning");
    expect(updatedStats.preferences.acknowledgedRisks).toContain("new-warning");
  });
});
