import { describe, expect, it } from "vitest";
import {
  derivePlanSessionExplanation,
  deriveAdvanceCycleReplayDebugBundle,
  derivePlanSessionReplayDebugBundle,
  deriveWorkoutCompletionExplanation,
  deriveWorkoutCompletionReplayDebugBundle,
  getDeterministicAnalyticsReadModel,
  getActiveCycleReporting,
  getWorkoutCompletionReadModels,
} from "../src/modules/reporting/service";
import { createMockSupabase } from "./helpers/mockSupabase";

const userId = "11111111-1111-1111-1111-111111111111";

describe("reporting service", () => {
  it("derives a canonical plan-session explanation from a persisted trace", () => {
    const explanation = derivePlanSessionExplanation({
      id: 91,
      user_id: userId,
      operation: "plan_session",
      cycle_plan_id: 7,
      cycle_session_id: 17,
      workout_log_id: null,
      decision_log: [
        {
          stepType: "scope",
          ruleId: "session_scope",
          outcome: "widened",
          details: {
            resolvedFocus: "upper_push",
            preferredScopeBucket: "push_only",
            survivingScopeBucket: "upper_body",
            wideningApplied: true,
          },
        },
        {
          stepType: "filter",
          ruleId: "hard_constraints",
          outcome: "survivors_found",
          details: {
            evaluatedCandidateIds: ["bench", "incline"],
            survivingCandidateIds: ["bench"],
            blocked: [{ candidateId: "incline", reason: "fatigue" }],
          },
        },
        {
          stepType: "tie_break",
          ruleId: "seeded_tie_break",
          outcome: "selected",
          details: {
            selectedCandidateId: "bench",
            eligibleCandidateIds: ["bench"],
            topScore: 0.92,
            bandWidth: 0.05,
          },
        },
      ],
      replay_receipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed-1",
        effectiveAt: "2026-04-20T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:reference",
      },
      engine_result: {
        sessionRationale: "Bench is the best fit today.",
        recommendedMovementFamily: "upper_push",
        selectedExerciseIds: ["bench-press"],
        progressionActionSummary: [
          {
            exerciseId: "bench-press",
            action: "overload",
            trend: "improving",
          },
        ],
      },
    });

    expect(explanation).toMatchObject({
      sessionRationale: "Bench is the best fit today.",
      recommendedMovementFamily: "upper_push",
      selectedExerciseIds: ["bench-press"],
      scope: {
        resolvedFocus: "upper_push",
        wideningApplied: true,
      },
      filter: {
        evaluatedCandidateIds: ["bench", "incline"],
        survivingCandidateIds: ["bench"],
        blockedCandidateIds: ["incline"],
      },
      tieBreak: {
        selectedCandidateId: "bench",
        topScore: 0.92,
        bandWidth: 0.05,
      },
      replayReference: {
        traceId: "91",
        seedUsed: "seed-1",
      },
    });
  });

  it("keeps optional plan decision-log sections nullable instead of failing derivation", () => {
    const explanation = derivePlanSessionExplanation({
      id: 92,
      user_id: userId,
      operation: "plan_session",
      cycle_plan_id: 7,
      cycle_session_id: 18,
      workout_log_id: null,
      decision_log: [],
      replay_receipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed-2",
        effectiveAt: "2026-04-20T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:reference",
      },
      engine_result: {
        sessionRationale: "No tie-break was needed.",
        recommendedMovementFamily: "upper_push",
        selectedExerciseIds: ["bench-press"],
        progressionActionSummary: [],
      },
    });

    expect(explanation).toMatchObject({
      sessionRationale: "No tie-break was needed.",
      scope: null,
      filter: null,
      tieBreak: null,
    });
  });

  it("returns null for plan explanations that do not satisfy the reporting schema", () => {
    const explanation = derivePlanSessionExplanation({
      id: 93,
      user_id: userId,
      operation: "plan_session",
      cycle_plan_id: 7,
      cycle_session_id: 19,
      workout_log_id: null,
      decision_log: [],
      replay_receipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed-3",
        effectiveAt: "2026-04-20T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:reference",
      },
      engine_result: {
        sessionRationale: "This should be rejected.",
        recommendedMovementFamily: "upper_push",
        selectedExerciseIds: ["bench-press"],
        progressionActionSummary: [
          {
            exerciseId: "bench-press",
            action: "invented_action",
            trend: "improving",
          },
        ],
      },
    });

    expect(explanation).toBeNull();
  });

  it("derives an available replay debug bundle for a plan-session trace", () => {
    const bundle = derivePlanSessionReplayDebugBundle({
      id: 101,
      user_id: userId,
      operation: "plan_session",
      cycle_plan_id: 9,
      cycle_session_id: 18,
      workout_log_id: null,
      input_material: {
        schemaVersion: "engine.v1",
        operation: "plan_session",
        determinism: {
          ruleVersion: "rules-2026-03",
          canonicalizationVersion: "canon-replay-v1",
        },
        metadata: {
          correlationId: "plan-corr",
        },
      },
      decision_log: [
        {
          stepType: "scope",
          ruleId: "session_scope",
          outcome: "selected",
          details: {
            requestId: "plan-request",
            setNotes: "internal",
            notes: "do not include",
            preferredScopeBucket: "core",
          },
        },
      ],
      replay_receipt: {
        inputHash: "sha256:plan-input",
        outputHash: "sha256:plan-output",
        seedUsed: "seed-plan",
        effectiveAt: "2026-04-20T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:plan-reference",
      },
      engine_result: {
        sessionRationale: "Plan with redacted metadata.",
        recommendedMovementFamily: "upper_push",
        selectedExerciseIds: ["bench-press"],
        progressionActionSummary: [],
        request_metadata: {
          requestId: "from-result",
          correlationId: "corr-1",
        },
      },
    });

    expect(bundle.availability).toBe("available");
    if (bundle.availability === "available") {
      expect(bundle.operation).toBe("plan_session");
      expect(bundle.traceId).toBe("101");
      const scopeDetails = bundle.decisionLog[0].details as Record<string, unknown>;
      expect(scopeDetails.notes).toBe("[REDACTED]");
      expect(scopeDetails.setNotes).toBe("[REDACTED]");
      expect(scopeDetails.requestId).toBe("[REDACTED]");
      expect((bundle.engineResult.request_metadata as Record<string, unknown>).requestId).toBe(
        "[REDACTED]"
      );
      expect(bundle.inputMaterial.availability).toBe("available");
      if (bundle.inputMaterial.availability === "available") {
        expect(bundle.inputMaterial.material.metadata).toMatchObject({
          correlationId: "[REDACTED]",
        });
      }
    }
  });

  it("derives an available replay debug bundle for a completion trace", () => {
    const bundle = deriveWorkoutCompletionReplayDebugBundle({
      id: 103,
      user_id: userId,
      operation: "complete_session",
      cycle_plan_id: 11,
      cycle_session_id: 21,
      workout_log_id: 82,
      input_material: {
        schemaVersion: "engine.v1",
        operation: "complete_session",
        determinism: {
          ruleVersion: "rules-2026-03",
          canonicalizationVersion: "canon-replay-v1",
        },
        request: {
          session: {
            notes: "do not include",
          },
        },
        metadata: {
          correlationId: "completion-corr-input",
        },
      },
      decision_log: [
        {
          stepType: "classify",
          ruleId: "completion_quality",
          outcome: "complete_clean",
          details: {
            requestMetadata: {
              requestId: "completion-request",
              correlationId: "completion-corr",
            },
          },
        },
      ],
      replay_receipt: {
        inputHash: "sha256:completion-input",
        outputHash: "sha256:completion-output",
        seedUsed: "seed-completion",
        effectiveAt: "2026-04-20T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:completion-reference",
      },
      engine_result: {
        sessionOutcomeClassification: "complete_clean",
        updatedProgressionActionSummary: [
          {
            exerciseId: "deadlift",
            action: "maintain",
            trend: "improving",
          },
        ],
        awardedXpSummary: {
          xpDelta: 20,
          streakDelta: 2,
          reason: "completed_recommended_session",
        },
        warnings: [],
        request_metadata: {
          requestId: "from-completion-result",
          correlationId: "corr-completion",
        },
      },
    });

    expect(bundle.availability).toBe("available");
    if (bundle.availability === "available") {
      expect(bundle.operation).toBe("complete_session");
      expect(bundle.traceId).toBe("103");
      expect(bundle.cyclePlanId).toBe("11");
      expect(bundle.cycleSessionId).toBe("21");
      expect(bundle.workoutLogId).toBe("82");
      expect(bundle.inputMaterial.availability).toBe("available");
      if (bundle.inputMaterial.availability === "available") {
        expect(bundle.inputMaterial.material.metadata).toMatchObject({
          correlationId: "[REDACTED]",
        });
        expect(bundle.inputMaterial.material.request).toMatchObject({
          session: {
            notes: "[REDACTED]",
          },
        });
      }
      expect((bundle.engineResult.request_metadata as Record<string, unknown>).requestId).toBe(
        "[REDACTED]"
      );
      const classify = bundle.decisionLog[0].details as Record<string, unknown>;
      const metadata = classify.requestMetadata as Record<string, unknown>;
      expect(metadata.requestId).toBe("[REDACTED]");
      expect(metadata.correlationId).toBe("[REDACTED]");
      expect((bundle.engineResult.request_metadata as Record<string, unknown>).correlationId).toBe(
        "[REDACTED]"
      );
    }
  });

  it("derives a canonical completion explanation and replay reference", () => {
    const { explanation, replayReference } = deriveWorkoutCompletionExplanation({
      id: 94,
      user_id: userId,
      operation: "complete_session",
      cycle_plan_id: 7,
      cycle_session_id: 17,
      workout_log_id: 42,
      input_material: {
        schemaVersion: "engine.v1",
        operation: "complete_session",
        determinism: {
          ruleVersion: "rules-2026-03",
          canonicalizationVersion: "canon-replay-v1",
        },
        metadata: {
          correlationId: "missing-receipt-correlation",
        },
      },
      decision_log: [
        {
          stepType: "classify",
          ruleId: "completion_quality",
          outcome: "complete_compromised",
          details: {
            primaryExerciseId: "bench-press",
          },
        },
        {
          stepType: "state_update",
          ruleId: "state_update",
          outcome: "applied",
          details: {
            touchedBuckets: ["progressionState", "gamificationState"],
          },
        },
      ],
      replay_receipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed-4",
        effectiveAt: "2026-04-20T10:00:00.000Z",
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
          xpDelta: 12,
          streakDelta: 1,
          reason: "completed_recommended_session",
        },
        warnings: ["future_choices_tightened"],
      },
    });

    expect(explanation).toMatchObject({
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
        xpDelta: 12,
        streakDelta: 1,
        reason: "completed_recommended_session",
      },
      primaryExerciseId: "bench-press",
      touchedBuckets: ["progressionState", "gamificationState"],
    });
    expect(replayReference).toMatchObject({
      traceId: "94",
      seedUsed: "seed-4",
    });
  });

  it("returns null completion models when replay metadata is incomplete", () => {
    const { explanation, replayReference } = deriveWorkoutCompletionExplanation({
      id: 95,
      user_id: userId,
      operation: "complete_session",
      cycle_plan_id: 7,
      cycle_session_id: 17,
      workout_log_id: 42,
      input_material: {
        schemaVersion: "engine.v1",
        operation: "complete_session",
        determinism: {
          ruleVersion: "rules-2026-03",
          canonicalizationVersion: "canon-replay-v1",
        },
        metadata: {
          correlationId: "missing-receipt-correlation",
        },
      },
      decision_log: [
        {
          stepType: "classify",
          ruleId: "completion_quality",
          outcome: "complete_clean",
        },
      ],
      replay_receipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed-5",
      },
      engine_result: {
        sessionOutcomeClassification: "complete_clean",
        updatedProgressionActionSummary: [],
        awardedXpSummary: {
          xpDelta: 10,
          streakDelta: 1,
          reason: "completed_recommended_session",
        },
        warnings: [],
        request_metadata: {
          requestId: "missing-receipt-request",
          correlationId: "missing-receipt-correlation",
        },
      },
    });

    expect(explanation).toBeNull();
    expect(replayReference).toBeNull();
  });

  it("marks completion replay debug bundles unavailable when required trace material is missing", () => {
    const bundle = deriveWorkoutCompletionReplayDebugBundle({
      id: 96,
      user_id: userId,
      operation: "complete_session",
      cycle_plan_id: 7,
      cycle_session_id: 17,
      workout_log_id: 42,
      input_material: {
        schemaVersion: "engine.v1",
        operation: "complete_session",
        determinism: {
          ruleVersion: "rules-2026-03",
          canonicalizationVersion: "canon-replay-v1",
        },
        metadata: {
          correlationId: "missing-receipt-correlation",
        },
      },
      decision_log: [
        {
          stepType: "classify",
          ruleId: "completion_quality",
          outcome: "complete_clean",
          details: {
            requestMetadata: {
              requestId: "missing-receipt",
            },
          },
        },
      ],
      replay_receipt: null,
      engine_result: {
        sessionOutcomeClassification: "complete_clean",
        updatedProgressionActionSummary: [],
        awardedXpSummary: {
          xpDelta: 0,
          streakDelta: 0,
          reason: "completed_recommended_session",
        },
        warnings: [],
        request_metadata: {
          requestId: "missing-receipt-request",
          correlationId: "missing-receipt-correlation",
        },
      },
    });

    expect(bundle).toMatchObject({
      availability: "unavailable",
      reason: "missing_replay_receipt",
      operation: "complete_session",
      traceId: "96",
      inputMaterial: {
        availability: "available",
      },
    });
    if (bundle.availability === "unavailable") {
      expect(bundle.decisionLog).toHaveLength(1);
      expect(bundle.engineResult).toMatchObject({
        sessionOutcomeClassification: "complete_clean",
        request_metadata: {
          requestId: "[REDACTED]",
          correlationId: "[REDACTED]",
        },
      });
      expect(bundle.replayReceipt).toBeNull();
      expect(bundle.schemaVersion).toBe("engine.v1");
      expect(bundle.canonicalizationVersion).toBe("canon-replay-v1");
      expect(bundle.ruleVersion).toBe("rules-2026-03");
      expect(bundle.referenceHash).toBeNull();
      expect(bundle.policyVersion).toBeNull();
    }
  });

  it("marks replay debug bundles unavailable when app input material is missing", () => {
    const bundle = deriveWorkoutCompletionReplayDebugBundle({
      id: 97,
      user_id: userId,
      operation: "complete_session",
      cycle_plan_id: 7,
      cycle_session_id: 17,
      workout_log_id: 42,
      decision_log: [],
      replay_receipt: {
        inputHash: "sha256:input",
        outputHash: "sha256:output",
        seedUsed: "seed",
        effectiveAt: "2026-04-20T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:reference",
      },
      engine_result: {
        sessionOutcomeClassification: "complete_clean",
        updatedProgressionActionSummary: [],
        awardedXpSummary: {
          xpDelta: 0,
          streakDelta: 0,
          reason: "completed_recommended_session",
        },
        warnings: [],
      },
    });

    expect(bundle).toMatchObject({
      availability: "unavailable",
      reason: "missing_input_material",
      operation: "complete_session",
      traceId: "97",
      inputMaterial: {
        availability: "unavailable",
        reason: "not_app_persisted",
      },
      replayReceipt: {
        seedUsed: "seed",
      },
    });
  });

  it("derives active-cycle reporting from normalized tables and ignores invalid progression rows", async () => {
    const supabase = createMockSupabase({
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 3,
          current_microcycle_index: 1,
          total_sessions: 12,
          resolved_class_archetype: "hybrid",
          class_preset_id: "classless",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 17,
          plan_id: 7,
          session_index: 2,
          completed_at: "2026-04-20T10:00:00.000Z",
          projected_fatigue_cost: {
            chest: 12,
            back: 4,
          },
        },
        {
          id: 18,
          plan_id: 7,
          session_index: 3,
          completed_at: "2026-04-21T10:00:00.000Z",
          projected_fatigue_cost: {
            chest: 8,
            legs: 16,
          },
        },
      ],
      engine_gamification_states: [
        {
          id: 31,
          plan_id: 7,
          xp: 155,
          level: 3,
          adherence_streak: 7,
          completed_session_count: 13,
          missed_session_count: 0,
          last_adherence_outcome_classification: "complete_compromised",
          last_awarded_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      engine_progression_states: [
        {
          id: 61,
          plan_id: 7,
          exercise_id: "bench-press",
          current_action: "maintain",
          trend: "improving",
          last_successful_load_weight: 100,
          last_successful_load_reps: 5,
          consecutive_successful_completions: 2,
          consecutive_stall_or_regression_count: 0,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_compromised",
          last_completed_at: "2026-04-20T10:00:00.000Z",
        },
        {
          id: 62,
          plan_id: 7,
          exercise_id: "bad-row",
          current_action: "invented_action",
          trend: "improving",
          last_successful_load_weight: 100,
          last_successful_load_reps: 5,
          consecutive_successful_completions: 2,
          consecutive_stall_or_regression_count: 0,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_compromised",
          last_completed_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      workout_logs: [
        {
          id: 41,
          user_id: userId,
          program_id: 11,
          program_day_id: 301,
          completed_at: "2026-04-14T10:00:00.000Z",
          duration_seconds: 1200,
          total_volume: 1800,
          seed: "seed-41",
          metadata: {
            programDayName: "Upper A",
          },
        },
        {
          id: 42,
          user_id: userId,
          program_id: 11,
          program_day_id: 302,
          completed_at: "2026-04-20T10:00:00.000Z",
          duration_seconds: 1800,
          total_volume: 4200,
          seed: "seed-42",
          metadata: {
            programDayName: "Lower B",
          },
        },
        {
          id: 43,
          user_id: userId,
          program_id: 11,
          program_day_id: null,
          completed_at: "2026-04-23T10:00:00.000Z",
          duration_seconds: 1500,
          total_volume: 2400,
          seed: "seed-43",
          metadata: {
            programDayName: "Upper C",
          },
        },
      ],
      set_logs: [
        {
          id: 1,
          workout_log_id: 41,
          exercise_id: 101,
          set_number: 1,
          weight: 75,
          reps: 6,
          failed: false,
        },
        {
          id: 2,
          workout_log_id: 41,
          exercise_id: 101,
          set_number: 2,
          weight: 90,
          reps: 5,
          failed: false,
        },
        {
          id: 3,
          workout_log_id: 42,
          exercise_id: 101,
          set_number: 1,
          weight: 110,
          reps: 3,
          failed: false,
        },
        {
          id: 4,
          workout_log_id: 42,
          exercise_id: 202,
          set_number: 1,
          weight: 150,
          reps: 6,
          failed: false,
        },
        {
          id: 5,
          workout_log_id: 43,
          exercise_id: 202,
          set_number: 1,
          weight: 120,
          reps: 10,
          failed: false,
        },
        {
          id: 6,
          workout_log_id: 43,
          exercise_id: 303,
          set_number: 1,
          weight: 90,
          reps: 6,
          failed: false,
        },
      ],
      exercise_muscle_map: [
        {
          exercise_id: 101,
          contribution: 1,
          muscle_groups: { slug: "chest" },
        },
        {
          exercise_id: 101,
          contribution: 0.5,
          muscle_groups: { slug: "triceps" },
        },
        {
          exercise_id: 202,
          contribution: 1,
          muscle_groups: { slug: "back" },
        },
        {
          exercise_id: 303,
          contribution: 1,
          muscle_groups: { slug: "legs" },
        },
      ],
      muscle_groups: [
        { id: 1, slug: "chest", name: "Chest" },
        { id: 2, slug: "triceps", name: "Triceps" },
        { id: 3, slug: "back", name: "Back" },
        { id: 4, slug: "legs", name: "Legs" },
      ],
    });

    const reporting = await getActiveCycleReporting(supabase as never, userId);

    expect(reporting).toMatchObject({
      cyclePlanId: "7",
      adherence: {
        adherenceStreak: 7,
        completedSessionCount: 13,
      },
      cycleProgress: {
        completedSessions: 2,
        totalSessions: 12,
        remainingSessions: 10,
      },
      progression: {
        totalExercises: 1,
        improvingCount: 1,
        exercises: [
          {
            exerciseId: "bench-press",
            currentAction: "maintain",
          },
        ],
      },
    });

    const analytics = await getDeterministicAnalyticsReadModel(supabase as never, userId, {
      recentSessionLimit: 2,
    });

    expect(analytics).toMatchObject({
      fatigueSummary: {
        items: [
          { muscle: "chest", current: 20, severity: "low" },
          { muscle: "legs", current: 16, severity: "low" },
          { muscle: "back", current: 4, severity: "low" },
        ],
      },
      capacityTimeline: {
        series: [
          {
            exerciseId: "202",
            exerciseLabel: "Exercise 202",
            points: [
              { date: "2026-04-20T10:00:00.000Z", estimated1RM: 180 },
              { date: "2026-04-23T10:00:00.000Z", estimated1RM: 160 },
            ],
          },
          {
            exerciseId: "303",
            exerciseLabel: "Exercise 303",
            points: [{ date: "2026-04-23T10:00:00.000Z", estimated1RM: 108 }],
          },
          {
            exerciseId: "101",
            exerciseLabel: "Exercise 101",
            points: [
              { date: "2026-04-14T10:00:00.000Z", estimated1RM: 105 },
              { date: "2026-04-20T10:00:00.000Z", estimated1RM: 121 },
            ],
          },
        ],
      },
      weeklyVolume: {
        windowStartedAt: "2026-04-17T10:00:00.000Z",
        windowEndedAt: "2026-04-23T10:00:00.000Z",
        items: [
          { muscle: "back", sets: 2 },
          { muscle: "chest", sets: 1 },
          { muscle: "legs", sets: 1 },
          { muscle: "triceps", sets: 0.5 },
        ],
      },
    });
  });

  it("returns null reporting when the normalized gamification state is missing", async () => {
    const supabase = createMockSupabase({
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 3,
          total_sessions: 12,
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [],
      engine_progression_states: [],
    });

    const reporting = await getActiveCycleReporting(supabase as never, userId);

    expect(reporting).toBeNull();
  });

  it("derives deterministic analytics from normalized cycle state and recent workout history", async () => {
    const supabase = createMockSupabase({
      users: [
        {
          id: userId,
          stats_json: {
            progression: {
              totalWorkouts: 99,
              recentWorkouts: [{ completedAt: "2026-01-01T00:00:00.000Z" }],
            },
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 1,
          current_microcycle_index: 0,
          total_sessions: 3,
          resolved_class_archetype: "hybrid",
          class_preset_id: "classless",
        },
      ],
      engine_cycle_sessions: [
        {
          id: 17,
          plan_id: 7,
          session_index: 0,
          completed_at: "2026-04-20T10:00:00.000Z",
        },
        {
          id: 18,
          plan_id: 7,
          session_index: 1,
          completed_at: null,
        },
        {
          id: 19,
          plan_id: 7,
          session_index: 2,
          completed_at: null,
        },
      ],
      engine_gamification_states: [
        {
          id: 31,
          plan_id: 7,
          xp: 180,
          level: 3,
          adherence_streak: 4,
          completed_session_count: 9,
          missed_session_count: 1,
          last_adherence_outcome_classification: "complete_clean",
          last_awarded_at: "2026-04-20T10:00:00.000Z",
        },
      ],
      engine_progression_states: [
        {
          id: 61,
          plan_id: 7,
          exercise_id: "bench-press",
          current_action: "overload",
          trend: "improving",
          last_successful_load_weight: 100,
          last_successful_load_reps: 5,
          consecutive_successful_completions: 2,
          consecutive_stall_or_regression_count: 0,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_clean",
          last_completed_at: "2026-04-20T10:00:00.000Z",
        },
        {
          id: 62,
          plan_id: 7,
          exercise_id: "deadlift",
          current_action: "maintain",
          trend: "stalled",
          last_successful_load_weight: 180,
          last_successful_load_reps: 3,
          consecutive_successful_completions: 0,
          consecutive_stall_or_regression_count: 2,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "partial",
          last_completed_at: "2026-04-19T10:00:00.000Z",
        },
        {
          id: 63,
          plan_id: 7,
          exercise_id: "squat",
          current_action: "regress",
          trend: "regressing",
          last_successful_load_weight: 140,
          last_successful_load_reps: 5,
          consecutive_successful_completions: 0,
          consecutive_stall_or_regression_count: 3,
          swap_recommendation_count: 0,
          last_session_outcome_classification: "complete_compromised",
          last_completed_at: "2026-04-18T10:00:00.000Z",
        },
        {
          id: 64,
          plan_id: 7,
          exercise_id: "row",
          current_action: "swap",
          trend: "blocked",
          last_successful_load_weight: 80,
          last_successful_load_reps: 8,
          consecutive_successful_completions: 0,
          consecutive_stall_or_regression_count: 4,
          swap_recommendation_count: 2,
          last_session_outcome_classification: "missed",
          last_completed_at: "2026-04-17T10:00:00.000Z",
        },
      ],
      workout_logs: [
        {
          id: 41,
          user_id: userId,
          program_day_id: 301,
          completed_at: "2026-04-19T10:00:00.000Z",
          duration_seconds: 1700,
          total_volume: 3000,
          seed: "older-seed",
          metadata: {},
        },
        {
          id: 42,
          user_id: userId,
          program_day_id: 302,
          completed_at: "2026-04-20T10:00:00.000Z",
          duration_seconds: 1800,
          total_volume: 4200,
          seed: "same-time-lower-id",
          metadata: {},
        },
        {
          id: 43,
          user_id: userId,
          program_day_id: null,
          completed_at: "2026-04-20T10:00:00.000Z",
          duration_seconds: null,
          total_volume: null,
          seed: "same-time-higher-id",
          metadata: { programDayName: "Metadata Day" },
        },
      ],
      program_days: [
        { id: 301, name: "Lower B" },
        { id: 302, name: "Upper A" },
      ],
      set_logs: [
        { id: 1, workout_log_id: 43, exercise_id: 101, set_number: 1, weight: 100, reps: 5 },
        { id: 2, workout_log_id: 42, exercise_id: 101, set_number: 1, weight: 100, reps: 5 },
        { id: 3, workout_log_id: 42, exercise_id: 101, set_number: 2, weight: 100, reps: 5 },
        { id: -4, workout_log_id: 42, exercise_id: 101, set_number: 3, weight: 100, reps: 5 },
      ],
    });

    const analytics = await getDeterministicAnalyticsReadModel(
      supabase as never,
      userId,
      { recentSessionLimit: 2 }
    );

    expect(analytics).toMatchObject({
      cyclePlanId: "7",
      cycleCompletion: {
        currentSessionIndex: 1,
        currentMicrocycleIndex: 0,
        totalSessions: 3,
        completedSessions: 1,
        remainingSessions: 2,
        nextSessionIndex: 2,
        completionPercentage: 33.33,
      },
      adherence: {
        streak: 4,
        completedCount: 9,
        missedCount: 1,
        lastOutcome: "complete_clean",
        xp: 180,
        level: 3,
      },
      progression: {
        totalExercises: 4,
        trendCounts: {
          improving: 1,
          stalled: 1,
          regressing: 1,
          blocked: 1,
        },
        actionCounts: {
          overload: 1,
          maintain: 1,
          regress: 1,
          swap: 1,
        },
        swapPressure: {
          affectedExerciseCount: 1,
          recommendationCount: 2,
          exerciseIds: ["row"],
        },
      },
      recentSessions: [
        {
          workoutLogId: 43,
          completedAt: "2026-04-20T10:00:00.000Z",
          dayName: "Metadata Day",
          durationSeconds: null,
          totalVolume: null,
          setCount: 1,
          seed: "same-time-higher-id",
        },
        {
          workoutLogId: 42,
          completedAt: "2026-04-20T10:00:00.000Z",
          dayName: "Upper A",
          durationSeconds: 1800,
          totalVolume: 4200,
          setCount: 2,
          seed: "same-time-lower-id",
        },
      ],
    });
  });

  it("falls back recent-session analytics day names to Workout Session", async () => {
    const supabase = createMockSupabase({
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 0,
          total_sessions: 1,
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [
        {
          id: 31,
          plan_id: 7,
          xp: 0,
          level: 1,
          adherence_streak: 0,
          completed_session_count: 0,
          missed_session_count: 0,
          last_adherence_outcome_classification: null,
          last_awarded_at: null,
        },
      ],
      engine_progression_states: [],
      workout_logs: [
        {
          id: 44,
          user_id: userId,
          program_day_id: null,
          completed_at: "2026-04-21T10:00:00.000Z",
          metadata: {},
        },
      ],
      set_logs: [],
    });

    const analytics = await getDeterministicAnalyticsReadModel(supabase as never, userId);

    expect(analytics?.recentSessions).toEqual([
      {
        workoutLogId: 44,
        completedAt: "2026-04-21T10:00:00.000Z",
        dayName: "Workout Session",
        durationSeconds: null,
        totalVolume: null,
        setCount: 0,
        seed: null,
      },
    ]);
  });

  it("returns null analytics when normalized active-cycle reporting is unavailable", async () => {
    const supabase = createMockSupabase({
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 0,
          total_sessions: 0,
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [],
      engine_progression_states: [],
      workout_logs: [
        {
          id: 42,
          user_id: userId,
          completed_at: "2026-04-20T10:00:00.000Z",
          metadata: {},
        },
      ],
      set_logs: [],
    });

    const analytics = await getDeterministicAnalyticsReadModel(supabase as never, userId);

    expect(analytics).toBeNull();
  });

  it("returns empty recent-session analytics when workout history rows are invalid", async () => {
    const supabase = createMockSupabase({
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 0,
          total_sessions: 0,
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [
        {
          id: 31,
          plan_id: 7,
          xp: 0,
          level: 1,
          adherence_streak: 0,
          completed_session_count: 0,
          missed_session_count: 0,
          last_adherence_outcome_classification: null,
          last_awarded_at: null,
        },
      ],
      engine_progression_states: [],
      workout_logs: [
        {
          id: -42,
          user_id: userId,
          completed_at: "2026-04-20T10:00:00.000Z",
          metadata: {},
        },
      ],
      set_logs: [],
    });

    const analytics = await getDeterministicAnalyticsReadModel(supabase as never, userId);

    expect(analytics).toMatchObject({
      cycleCompletion: {
        totalSessions: 0,
        completedSessions: 0,
        completionPercentage: 0,
      },
      recentSessions: [],
    });
  });

  it("returns null workout completion read models when no complete-session trace exists", async () => {
    const supabase = createMockSupabase({
      engine_session_traces: [],
      engine_cycle_plans: [],
      engine_cycle_sessions: [],
      engine_gamification_states: [],
      engine_progression_states: [],
    });

    const readModels = await getWorkoutCompletionReadModels(
      supabase as never,
      userId,
      42
    );

    expect(readModels).toMatchObject({
      explanation: null,
      reporting: null,
      replayReference: null,
      replayDebugBundle: {
        availability: "unavailable",
        reason: "trace_not_found",
      },
    });
  });

  it("builds DB-backed replay debug bundles from persisted input material", async () => {
    const supabase = createMockSupabase({
      engine_session_traces: [
        {
          id: 1881,
          user_id: userId,
          operation: "complete_session",
          cycle_plan_id: 7,
          cycle_session_id: 21,
          workout_log_id: 88,
          input_material: {
            schemaVersion: "engine.v1",
            operation: "complete_session",
            determinism: {
              seed: "seed-debug",
              effectiveAt: "2026-04-20T10:00:00.000Z",
              ruleVersion: "rules-2026-03",
              referenceHash: "sha256:debug-reference",
              canonicalizationVersion: "canon-replay-v1",
            },
            request: {
              session: {
                notes: "private note",
              },
            },
            metadata: {
              correlationId: "debug-correlation",
            },
          },
          decision_log: [
            {
              stepType: "classify",
              ruleId: "completion_quality",
              outcome: "complete_clean",
              details: {
                requestId: "debug-request",
              },
            },
          ],
          replay_receipt: {
            inputHash: "sha256:debug-input",
            outputHash: "sha256:debug-output",
            seedUsed: "seed-debug",
            effectiveAt: "2026-04-20T10:00:00.000Z",
            implementationVersion: "engine-rs-mvp-0",
            policyVersion: "policy-2026-02",
            referenceHash: "sha256:debug-reference",
          },
          engine_result: {
            sessionOutcomeClassification: "complete_clean",
            updatedProgressionActionSummary: [],
            awardedXpSummary: {
              xpDelta: 10,
              streakDelta: 1,
              reason: "completed_recommended_session",
            },
            warnings: [],
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 0,
          total_sessions: 0,
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [],
      engine_progression_states: [],
    });

    const readModels = await getWorkoutCompletionReadModels(
      supabase as never,
      userId,
      88
    );

    expect(readModels.replayDebugBundle.availability).toBe("available");
    if (readModels.replayDebugBundle.availability === "available") {
      expect(readModels.replayDebugBundle.schemaVersion).toBe("engine.v1");
      expect(readModels.replayDebugBundle.canonicalizationVersion).toBe("canon-replay-v1");
      expect(readModels.replayDebugBundle.ruleVersion).toBe("rules-2026-03");
      expect(readModels.replayDebugBundle.inputMaterial.availability).toBe("available");
      if (readModels.replayDebugBundle.inputMaterial.availability === "available") {
        expect(readModels.replayDebugBundle.inputMaterial.material.metadata).toMatchObject({
          correlationId: "[REDACTED]",
        });
        expect(readModels.replayDebugBundle.inputMaterial.material.request).toMatchObject({
          session: {
            notes: "[REDACTED]",
          },
        });
      }
      const classify = readModels.replayDebugBundle.decisionLog[0]
        .details as Record<string, unknown>;
      expect(classify.requestId).toBe("[REDACTED]");
    }
  });

  it("resolves duplicate completion traces deterministically by trace id", async () => {
    const supabase = createMockSupabase({
      engine_session_traces: [
        {
          id: 2002,
          user_id: userId,
          operation: "complete_session",
          cycle_plan_id: 7,
          cycle_session_id: 21,
          workout_log_id: 88,
          input_material: {
            schemaVersion: "engine.v1",
            operation: "complete_session",
            determinism: {
              ruleVersion: "rules-2026-03",
              canonicalizationVersion: "canon-replay-v1",
            },
          },
          decision_log: [
            {
              stepType: "classify",
              ruleId: "completion_quality",
              outcome: "complete_clean",
              details: {
                requestId: "duplicate-late",
              },
            },
          ],
          replay_receipt: {
            inputHash: "sha256:dup-input-late",
            outputHash: "sha256:dup-output-late",
            seedUsed: "seed-dup-late",
            effectiveAt: "2026-04-20T10:00:00.000Z",
            implementationVersion: "engine-rs-mvp-0",
            policyVersion: "policy-2026-02",
            referenceHash: "sha256:dup-reference-late",
          },
          engine_result: {
            sessionOutcomeClassification: "complete_clean",
            updatedProgressionActionSummary: [
              {
                exerciseId: "squat",
                action: "maintain",
                trend: "improving",
              },
            ],
            awardedXpSummary: {
              xpDelta: 15,
              streakDelta: 1,
              reason: "completed_recommended_session",
            },
            warnings: [],
          },
        },
        {
          id: 1999,
          user_id: userId,
          operation: "complete_session",
          cycle_plan_id: 7,
          cycle_session_id: 21,
          workout_log_id: 88,
          input_material: {
            schemaVersion: "engine.v1",
            operation: "complete_session",
            determinism: {
              ruleVersion: "rules-2026-03",
              canonicalizationVersion: "canon-replay-v1",
            },
          },
          decision_log: [
            {
              stepType: "classify",
              ruleId: "completion_quality",
              outcome: "complete_compromised",
              details: {
                requestId: "duplicate-earliest",
              },
            },
          ],
          replay_receipt: {
            inputHash: "sha256:dup-input-early",
            outputHash: "sha256:dup-output-early",
            seedUsed: "seed-dup-early",
            effectiveAt: "2026-04-20T10:00:00.000Z",
            implementationVersion: "engine-rs-mvp-0",
            policyVersion: "policy-2026-02",
            referenceHash: "sha256:dup-reference-early",
          },
          engine_result: {
            sessionOutcomeClassification: "complete_compromised",
            updatedProgressionActionSummary: [
              {
                exerciseId: "squat",
                action: "maintain",
                trend: "improving",
              },
            ],
            awardedXpSummary: {
              xpDelta: 10,
              streakDelta: 0,
              reason: "completed_recommended_session",
            },
            warnings: ["duplicate_trace_detected"],
          },
        },
      ],
      engine_cycle_plans: [
        {
          id: 7,
          user_id: userId,
          is_active: true,
          current_session_index: 0,
          total_sessions: 0,
        },
      ],
      engine_cycle_sessions: [],
      engine_gamification_states: [
        {
          id: 901,
          plan_id: 7,
          xp: 0,
          level: 1,
          adherence_streak: 0,
          completed_session_count: 0,
          missed_session_count: 0,
          last_adherence_outcome_classification: null,
          last_awarded_at: null,
        },
      ],
      engine_progression_states: [],
    });

    const readModels = await getWorkoutCompletionReadModels(
      supabase as never,
      userId,
      88
    );

    expect(readModels.replayDebugBundle.availability).toBe("available");
    if (readModels.replayDebugBundle.availability === "available") {
      expect(readModels.replayDebugBundle.traceId).toBe("1999");
      expect(readModels.replayDebugBundle.replayReceipt.seedUsed).toBe("seed-dup-early");
      expect(readModels.replayDebugBundle.operation).toBe("complete_session");
    }

    expect(readModels.explanation?.sessionOutcomeClassification).toBe("complete_compromised");
  });
  it("returns available replay debug bundle for advance_cycle traces", () => {
    const bundle = deriveAdvanceCycleReplayDebugBundle({
      id: 901,
      user_id: "user-1",
      operation: "advance_cycle",
      cycle_plan_id: 11,
      cycle_session_id: null,
      workout_log_id: null,
      input_material: { seed: "seed" },
      decision_log: [{ stepType: "state_update", ruleId: "advance", outcome: "ok" }],
      replay_receipt: {
        inputHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        outputHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        seedUsed: "seed",
        effectiveAt: "2026-02-13T10:00:00.000Z",
        implementationVersion: "engine-rs-mvp-0",
        policyVersion: "policy-2026-02",
        referenceHash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
      },
      engine_result: { seasonIndex: 1, rankTier: "silver", awardedXp: 300, nextCycleRequest: {} },
    });

    expect(bundle.operation).toBe("advance_cycle");
    expect(bundle.availability).toBe("available");
  });

});
