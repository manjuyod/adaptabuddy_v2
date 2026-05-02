import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "./helpers/mockSupabase";
import { getWorkoutDetail } from "../src/modules/history/service";

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("../src/lib/supabase/next", () => ({
  createSupabaseServerActionClient: async () => mockSupabase,
}));

describe("history reporting read models", () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase({
      workout_logs: [],
      set_logs: [],
      engine_session_traces: [],
      engine_cycle_plans: [],
      engine_cycle_sessions: [],
      engine_gamification_states: [],
      engine_progression_states: [],
    });
  });

  it("enriches a workout detail with completion explanation, cycle reporting, and replay references", async () => {
    const userId = "11111111-1111-1111-1111-111111111111";

    mockSupabase = createMockSupabase({
      workout_logs: [
        {
          id: 42,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-13T11:10:00.000Z",
          duration_seconds: 3000,
          total_volume: 6200,
          seed: "seed-plan-session-baseline",
          metadata: {
            programName: "Upper Lower",
            programDayName: "Upper A",
          },
        },
      ],
      set_logs: [
        {
          id: 1,
          workout_log_id: 42,
          exercise_id: 101,
          set_number: 1,
          weight: 100,
          reps: 5,
          rir: 2,
          failed: false,
        },
      ],
      exercises: [{ id: 101, name: "Barbell Bench Press" }],
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          current_session_index: 3,
          total_sessions: 12,
          current_microcycle_index: 1,
        },
      ],
      engine_cycle_sessions: [
        {
          id: 17,
          user_id: userId,
          plan_id: 7,
          session_index: 2,
          microcycle_index: 1,
          completed_at: "2026-02-13T11:10:00.000Z",
        },
        {
          id: 18,
          user_id: userId,
          plan_id: 7,
          session_index: 3,
          microcycle_index: 1,
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 31,
          user_id: userId,
          plan_id: 7,
          xp: 155,
          level: 3,
          adherence_streak: 7,
          completed_session_count: 13,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_compromised",
          last_awarded_at: "2026-02-13T11:10:00.000Z",
        },
      ],
      engine_progression_states: [
        {
          id: 61,
          user_id: userId,
          plan_id: 7,
          exercise_id: "bench-press",
          current_action: "maintain",
          trend: "improving",
          consecutive_successful_completions: 2,
          consecutive_stall_or_regression_count: 0,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_compromised",
          last_completed_at: "2026-02-13T11:10:00.000Z",
        },
      ],
      engine_session_traces: [
        {
          id: 91,
          user_id: userId,
          operation: "complete_session",
          cycle_plan_id: 7,
          cycle_session_id: 17,
          workout_log_id: 42,
          decision_log: [
            {
              stepType: "classify",
              ruleId: "completion_quality",
              outcome: "complete_compromised",
              inputsUsed: [{ path: "request.session.overallRpe" }],
              details: {
                sessionOutcomeClassification: "complete_compromised",
                primaryExerciseId: "bench-press",
              },
            },
            {
              stepType: "state_update",
              ruleId: "state_update",
              outcome: "applied",
              inputsUsed: [{ path: "stateSnapshot.progressionState.records", stableId: "bench-press" }],
              candidateId: "bench-press",
              details: {
                touchedBuckets: ["progressionState", "readinessState", "gamificationState"],
              },
            },
            {
              stepType: "award_xp",
              ruleId: "completion_reward",
              outcome: "applied",
              computedValue: 15,
              details: {
                streakDelta: 1,
                levelUp: false,
              },
            },
          ],
          replay_receipt: {
            inputHash: "sha256:input",
            outputHash: "sha256:output",
            seedUsed: "seed-plan-session-baseline",
            effectiveAt: "2026-02-13T10:00:00.000Z",
            implementationVersion: "engine-rs-mvp-0",
            policyVersion: "policy-2026-02",
            referenceHash: "sha256:reference",
          },
          engine_result: {
            sessionOutcomeClassification: "complete_compromised",
            updatedProgressionActionSummary: [
              {
                exerciseId: "bench-press",
                action: "maintain",
                trend: "improving",
              },
            ],
            awardedXpSummary: {
              xpDelta: 15,
              streakDelta: 1,
              reason: "completed_recommended_session",
            },
            levelUpIndicator: false,
            warnings: ["future_choices_tightened"],
          },
        },
      ],
    });

    const result = (await getWorkoutDetail(userId, 42)) as any;

    expect(result.status).toBe("success");
    expect(result.workout.explanation).toMatchObject({
      sessionOutcomeClassification: "complete_compromised",
      warnings: ["future_choices_tightened"],
      progressionChanges: [
        {
          exerciseId: "bench-press",
          action: "maintain",
          trend: "improving",
        },
      ],
      xp: {
        xpDelta: 15,
        streakDelta: 1,
        reason: "completed_recommended_session",
      },
    });
    expect(result.workout.reporting).toMatchObject({
      adherence: {
        adherenceStreak: 7,
        completedSessionCount: 13,
        missedSessionCount: 0,
      },
      cycleProgress: {
        completedSessions: 1,
        totalSessions: 12,
        remainingSessions: 11,
      },
    });
    expect(result.workout.replayReference).toMatchObject({
      traceId: "91",
      seedUsed: "seed-plan-session-baseline",
      inputHash: "sha256:input",
      outputHash: "sha256:output",
    });
  });

  it("returns null explanation and reporting sections when a workout has no persisted engine trace", async () => {
    const userId = "22222222-2222-2222-2222-222222222222";

    mockSupabase = createMockSupabase({
      workout_logs: [
        {
          id: 77,
          user_id: userId,
          program_id: 2002,
          program_day_id: 3002,
          completed_at: "2026-02-15T09:30:00.000Z",
          duration_seconds: 1800,
          total_volume: 2400,
          metadata: {
            programName: "Legacy Program",
            programDayName: "Legacy Day",
          },
        },
      ],
      set_logs: [],
      engine_session_traces: [],
      exercises: [],
    });

    const result = (await getWorkoutDetail(userId, 77)) as any;

    expect(result.status).toBe("success");
    expect(result.workout.explanation).toBeNull();
    expect(result.workout.reporting).toBeNull();
    expect(result.workout.replayReference).toBeNull();
  });

  it("filters invalid normalized progression rows before attaching reporting to workout detail", async () => {
    const userId = "33333333-3333-3333-3333-333333333333";

    mockSupabase = createMockSupabase({
      workout_logs: [
        {
          id: 55,
          user_id: userId,
          program_id: 2001,
          program_day_id: 3001,
          completed_at: "2026-02-14T11:10:00.000Z",
          duration_seconds: 2800,
          total_volume: 6100,
          metadata: {
            programName: "Upper Lower",
            programDayName: "Upper B",
          },
        },
      ],
      set_logs: [],
      exercises: [],
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          current_session_index: 3,
          total_sessions: 12,
          current_microcycle_index: 1,
        },
      ],
      engine_cycle_sessions: [
        {
          id: 17,
          user_id: userId,
          plan_id: 7,
          session_index: 2,
          microcycle_index: 1,
          completed_at: "2026-02-14T11:10:00.000Z",
        },
      ],
      engine_gamification_states: [
        {
          id: 31,
          user_id: userId,
          plan_id: 7,
          xp: 155,
          level: 3,
          adherence_streak: 7,
          completed_session_count: 13,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_compromised",
          last_awarded_at: "2026-02-14T11:10:00.000Z",
        },
      ],
      engine_progression_states: [
        {
          id: 61,
          user_id: userId,
          plan_id: 7,
          exercise_id: "bench-press",
          current_action: "maintain",
          trend: "improving",
          consecutive_successful_completions: 2,
          consecutive_stall_or_regression_count: 0,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_compromised",
          last_completed_at: "2026-02-14T11:10:00.000Z",
        },
        {
          id: 62,
          user_id: userId,
          plan_id: 7,
          exercise_id: "bad-row",
          current_action: "invented_action",
          trend: "improving",
          consecutive_successful_completions: 2,
          consecutive_stall_or_regression_count: 0,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_compromised",
          last_completed_at: "2026-02-14T11:10:00.000Z",
        },
      ],
      engine_session_traces: [
        {
          id: 91,
          user_id: userId,
          operation: "complete_session",
          cycle_plan_id: 7,
          cycle_session_id: 17,
          workout_log_id: 55,
          decision_log: [
            {
              stepType: "classify",
              ruleId: "completion_quality",
              outcome: "complete_compromised",
            },
          ],
          replay_receipt: {
            inputHash: "sha256:input",
            outputHash: "sha256:output",
            seedUsed: "seed-plan-session-baseline",
            effectiveAt: "2026-02-14T10:00:00.000Z",
            implementationVersion: "engine-rs-mvp-0",
            policyVersion: "policy-2026-02",
            referenceHash: "sha256:reference",
          },
          engine_result: {
            sessionOutcomeClassification: "complete_compromised",
            updatedProgressionActionSummary: [],
            awardedXpSummary: {
              xpDelta: 15,
              streakDelta: 1,
              reason: "completed_recommended_session",
            },
            warnings: [],
          },
        },
      ],
    });

    const result = (await getWorkoutDetail(userId, 55)) as any;

    expect(result.status).toBe("success");
    expect(result.workout.reporting).toMatchObject({
      progression: {
        totalExercises: 1,
        exercises: [{ exerciseId: "bench-press", currentAction: "maintain" }],
      },
    });
  });
});
