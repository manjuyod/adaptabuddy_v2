import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAdvanceCycle } from "../src/modules/cycles/service";
import { runEngineInput } from "../src/lib/engine-runner";
import { computeCanonicalReplayReferenceHash } from "../src/lib/engine-replay";
import { createMockSupabase } from "./helpers/mockSupabase";

let mockSupabase: ReturnType<typeof createMockSupabase>;
let mockAdminSupabase: ReturnType<typeof createMockSupabase> | null;
let store: Record<string, Array<Record<string, unknown>>>;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

vi.mock("../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockAdminSupabase,
}));

vi.mock("../src/lib/engine-runner", () => ({
  runEngineInput: vi.fn(async () => ({
    replayReceipt: {
      inputHash: "sha256:input",
      outputHash: "sha256:output",
      seedUsed: "advance-user-1-1",
      effectiveAt: "2026-03-29T10:00:00.000Z",
      implementationVersion: "engine-rs-mvp-0",
      policyVersion: "rules-2026-03",
      referenceHash: "sha256:test",
    },
    decisionLog: [{ stepType: "rank", ruleId: "advance_cycle_rank_v1", outcome: "rank=A" }],
    result: {
      seasonSummary: {
        planId: "1",
        seasonIndex: 1,
        completedSessions: 2,
        missedSessions: 0,
        totalSessions: 2,
        completionRate: 1,
        progressionTrend: "improving",
        recoveryStatus: "recoverable",
      },
      seasonRank: "A",
      rankBreakdown: {
        adherenceScore: 100,
        qualityScore: 86,
        progressionScore: 80,
        recoveryScore: 80,
        consistencyScore: 90,
        constraintModifier: 0,
        finalScore: 87,
        rank: "A",
      },
      awards: [{ id: "season-clear", label: "Season Clear", reason: "Completed", xp: 120 }],
      evolutionPatch: { difficultyDelta: 0 },
      seasonIndex: 2,
      awardedXp: 120,
      nextCycleRequest: {
        classPresetId: "bb",
        goalBias: "balanced",
        availableDaysPerWeek: 4,
        fatiguePreference: "moderate",
        injuryMuscleGroupSlugs: [],
        macrocycleWeeks: 8,
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
    },
  })),
}));

vi.mock("../src/lib/engine-replay", () => ({
  CANON_REPLAY_CANONICALIZATION_VERSION: "canon.v1",
  computeCanonicalReplayReferenceHash: vi.fn(() => "sha256:test"),
}));

describe("handleAdvanceCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const userId = "user-1";
    store = {
      engine_cycle_profiles: [
        {
          id: 10,
          user_id: userId,
          class_preset_id: "bb",
          class_choice: "bb",
          goal_bias: "balanced",
          available_days_per_week: 4,
          fatigue_preference: "moderate",
          injury_muscle_group_slugs: [],
          macrocycle_weeks: 8,
        },
      ],
      engine_cycle_program_mix: [
        {
          id: 11,
          user_id: userId,
          profile_id: 10,
          program_id: 2001,
          selection_weight: 1,
          role: "primary",
        },
      ],
      programs: [
        {
          id: 2001,
          slug: "powerlifting-core",
          name: "Powerlifting Core",
          is_active: true,
          metadata: {},
        },
      ],
      program_days: [
        {
          id: 3001,
          program_id: 2001,
          day_index: 0,
          name: "Day 1",
        },
      ],
      program_slots: [
        {
          id: 4001,
          program_day_id: 3001,
          slot_index: 0,
          slot_type: "main",
          locked_exercise_id: null,
          movement_pattern: "squat",
          sets_min: 3,
          sets_max: 5,
          reps_min: 3,
          reps_max: 5,
          muscle_targets: { quads: 1 },
          tags_required: ["compound"],
          prescription: {},
        },
      ],
      engine_cycle_plans: [
        {
          id: 1,
          user_id: userId,
          profile_id: 10,
          is_active: true,
          total_sessions: 2,
          current_session_index: 2,
          current_microcycle_index: 1,
          current_mesocycle_index: 0,
          resolved_class_archetype: "hybrid",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 101,
          user_id: userId,
          plan_id: 1,
          session_index: 0,
          completed_at: "2026-03-20T10:00:00.000Z",
          program_id: 2001,
          program_day_id: 3001,
          program_day_name: "Day 1",
        },
        {
          id: 102,
          user_id: userId,
          plan_id: 1,
          session_index: 1,
          completed_at: "2026-03-22T10:00:00.000Z",
          program_id: 2001,
          program_day_id: 3002,
          program_day_name: "Day 2",
        },
      ],
      engine_gamification_states: [
        {
          id: 201,
          user_id: userId,
          plan_id: 1,
          xp: 500,
          level: 5,
          adherence_streak: 2,
          completed_session_count: 2,
          missed_session_count: 0,
        },
      ],
      engine_progression_states: [],
      engine_session_traces: [],
      engine_cycle_season_summaries: [],
      engine_cycle_season_awards: [],
      engine_cycle_transitions: [],
    };
    mockSupabase = createMockSupabase(store);
    mockAdminSupabase = createMockSupabase(store);
  });
  it("returns success when engine emits advance_cycle result", async () => {
    const result = await handleAdvanceCycle("user-1", {
      planId: "1",
      programAdaptationInputs: {
        challengeBaselines: {},
        strengthBaselines: {
          squat: { estimatedOneRepMax: 225, unit: "lbs" },
          deadlift: { estimatedOneRepMax: 225, unit: "lbs" },
          bench_press: { estimatedOneRepMax: 100, unit: "lbs" },
          overhead_press: { estimatedOneRepMax: 75, unit: "lbs" },
        },
      },
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.seasonRank).toBe("A");
      expect(result.awardedXp).toBe(120);
      expect(result.transitionId).toBe("1");
    }

    expect(runEngineInput).toHaveBeenCalledTimes(1);
    const invocation = vi.mocked(runEngineInput).mock.calls[0]?.[0] as {
      determinism?: { referenceHash?: string };
      request?: {
        completionRate?: number;
        seasonIndex?: number;
        completedSessionCount?: number;
        missedSessionCount?: number;
        currentCycleRequest?: {
          profile?: { fatiguePreference?: string };
          selectedPrograms?: Array<{
            programId?: string;
            days?: Array<{ slots?: unknown[] }>;
          }>;
          programAdaptationInputs?: {
            strengthBaselines?: {
              bench_press?: { estimatedOneRepMax?: number };
            };
          };
        };
        programAdaptationInputs?: {
          strengthBaselines?: {
            bench_press?: { estimatedOneRepMax?: number };
          };
        };
      };
    };
    expect(invocation.determinism?.referenceHash).toMatch(/^sha256:/);
    expect(invocation.request?.completionRate).toBe(1);
    expect(invocation.request?.seasonIndex).toBe(1);
    expect(invocation.request?.completedSessionCount).toBe(2);
    expect(invocation.request?.missedSessionCount).toBe(0);
    expect(invocation.request?.currentCycleRequest?.profile?.fatiguePreference).toBe("moderate");
    expect(invocation.request?.currentCycleRequest?.selectedPrograms?.[0]?.programId).toBe("2001");
    expect(invocation.request?.currentCycleRequest?.selectedPrograms?.[0]?.days?.[0]?.slots).toHaveLength(1);
    expect(
      invocation.request?.currentCycleRequest?.programAdaptationInputs?.strengthBaselines
        ?.bench_press?.estimatedOneRepMax,
    ).toBe(100);
    expect(
      invocation.request?.programAdaptationInputs?.strengthBaselines?.bench_press
        ?.estimatedOneRepMax,
    ).toBe(100);
    expect(store.engine_cycle_season_summaries).toHaveLength(1);
    expect(store.engine_cycle_season_awards).toHaveLength(1);
    expect(store.engine_cycle_transitions).toHaveLength(1);
    expect(store.engine_session_traces).toHaveLength(1);
  });

  it("returns error when replay reference hash computation fails", async () => {
    vi.mocked(computeCanonicalReplayReferenceHash).mockImplementationOnce(() => {
      throw new Error("hash failure");
    });

    const result = await handleAdvanceCycle("user-1", { planId: "1" });

    expect(result.status).toBe("error");
    expect(runEngineInput).toHaveBeenCalledTimes(0);
  });

  it("uses server-derived season facts and current cycle context over client supplied context", async () => {
    await handleAdvanceCycle("user-1", {
      planId: "1",
      completedSessionCount: 999,
      missedSessionCount: 999,
      currentCycleRequest: {
        classPresetId: "classless",
        goalBias: "conditioning",
        availableDaysPerWeek: 1,
        fatiguePreference: "low",
        injuryMuscleGroupSlugs: ["client-spoof"],
        macrocycleWeeks: 1,
        selectedPrograms: [{ programId: 9999, weight: 1 }],
      },
    });

    const invocation = vi.mocked(runEngineInput).mock.calls[0]?.[0] as {
      request?: {
        completedSessionCount?: number;
        missedSessionCount?: number;
        currentCycleRequest?: {
          profile?: {
            goalBias?: string;
            injuryMuscleGroupSlugs?: string[];
          };
          selectedPrograms?: Array<{ programId?: string }>;
        };
      };
    };
    expect(invocation.request?.completedSessionCount).toBe(2);
    expect(invocation.request?.missedSessionCount).toBe(0);
    expect(invocation.request?.currentCycleRequest?.profile?.goalBias).toBe("balanced");
    expect(
      invocation.request?.currentCycleRequest?.profile?.injuryMuscleGroupSlugs,
    ).toEqual([]);
    expect(invocation.request?.currentCycleRequest?.selectedPrograms?.[0]?.programId).toBe("2001");
  });

  it("rejects active cycles that are not complete", async () => {
    mockSupabase = createMockSupabase({
      engine_cycle_plans: [
        {
          id: 1,
          user_id: "user-1",
          profile_id: 10,
          is_active: true,
          total_sessions: 2,
          current_session_index: 1,
        },
      ],
      engine_cycle_sessions: [
        { id: 101, user_id: "user-1", plan_id: 1, session_index: 0, completed_at: null },
        { id: 102, user_id: "user-1", plan_id: 1, session_index: 1, completed_at: null },
      ],
    });

    const result = await handleAdvanceCycle("user-1", { planId: "1" });

    expect(result).toEqual({
      status: "error",
      errors: ["Active cycle is not complete"],
    });
    expect(runEngineInput).not.toHaveBeenCalled();
  });
});
