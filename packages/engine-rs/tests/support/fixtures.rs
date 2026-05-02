#![allow(dead_code)]

use engine_rs::domain::{
    progression::PreviousPerformanceReference, AthleteStateSnapshot, LoadRepsReference,
    ProgressionRecord, StatePatch,
};
use engine_rs::{Determinism, EngineInputV1, EngineOutputV1, Operation, SCHEMA_VERSION};
use serde_json::{json, Value};

pub const PLAN_SESSION_TEST_NAME: &str = "plan_session_baseline";
pub const COMPLETE_SESSION_TEST_NAME: &str = "complete_session_baseline";
pub const FIXTURE_SEED: &str = "seed-plan-session-baseline";
pub const EFFECTIVE_AT: &str = "2026-02-13T10:00:00.000Z";
pub const REFERENCE_HASH: &str =
    "sha256:ba49fccccc6a22098b9cdd5dd9b26eb51617a0e52ab69183e4e64609dfe21fb4";
pub const INPUT_HASH: &str =
    "sha256:89835c5ffdb90842bfca664abc9b18bba00867442563e0e47e7cdefccd85adc1";
pub const OUTPUT_HASH_PLAN: &str =
    "sha256:2c83284194f6d37c8f4a323d1b5095d022d1162c621ee505810b01c5200442f3";
pub const OUTPUT_HASH_COMPLETE: &str =
    "sha256:2493ec3ca4747a934aff17eed0efa33df49bc04ff77375344da94fdbd861bc24";
pub const IMPLEMENTATION_VERSION: &str = "engine-rs-mvp-0";
pub const POLICY_VERSION: &str = "policy-2026-02";

pub fn reference_snapshot() -> Value {
    json!({
        "referenceVersion": "2026-02",
        "exercises": [
            {
                "id": "bench-press",
                "slug": "bench-press",
                "name": "Bench Press",
                "movementPattern": "push",
                "equipment": ["barbell", "bench"],
                "tags": ["compound"]
            },
            {
                "id": "incline-dumbbell-press",
                "slug": "incline-dumbbell-press",
                "name": "Incline Dumbbell Press",
                "movementPattern": "push",
                "equipment": ["dumbbells", "bench"],
                "tags": ["compound"]
            },
            {
                "id": "barbell-row",
                "slug": "barbell-row",
                "name": "Barbell Row",
                "movementPattern": "pull",
                "equipment": ["barbell"],
                "tags": ["compound"]
            }
        ],
        "programs": [
            {
                "id": "program-upper-1",
                "slug": "upper-strength",
                "name": "Upper Strength",
                "daysPerWeek": 3
            }
        ]
    })
}

pub fn state_snapshot() -> Value {
    json!({
        "athleteProfile": {
            "height": 178,
            "weight": 82.5,
            "trainingAge": 3,
            "goalBias": "strength",
            "availableDaysPerWeek": 3,
            "classArchetype": "hybrid"
        },
        "readinessState": {
            "systemicFatigue": "moderate",
            "muscleFatigue": {
                "chest": 20,
                "back": 12
            }
        },
        "injuryState": {
            "activeLimitations": [],
            "blockedMovementPatterns": []
        },
        "performanceState": {
            "knownLifts": {
                "bench-press": {
                    "estimated1RM": 112.5,
                    "lastWeight": 100,
                    "lastReps": 5
                }
            }
        },
        "progressionState": {
            "records": [
                {
                    "exerciseId": "bench-press",
                    "previousPerformanceReference": {
                        "weight": 100,
                        "reps": 5
                    },
                    "trend": "improving",
                    "currentAction": "maintain",
                    "consecutiveSuccessfulCompletions": 1,
                    "consecutiveStallOrRegressionCount": 0,
                    "swapRecommendationCount": 0,
                    "lastSessionOutcomeClassification": "complete_clean",
                    "lastCompletedAt": "2026-02-10T10:00:00.000Z"
                }
            ]
        },
        "gamificationState": {
            "xp": 140,
            "level": 3,
            "adherenceStreak": 6,
            "completedSessionCount": 12,
            "missedSessionCount": 0,
            "lastAdherenceOutcomeClassification": "complete_clean",
            "lastAwardedAt": "2026-02-10T10:00:00.000Z"
        },
        "activeProgramState": {
            "programId": "program-upper-1",
            "currentDayIndex": 1,
            "currentMicrocycle": 2
        },
        "recentCompletions": [
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-10T10:00:00.000Z",
                "quality": "complete_clean"
            }
        ]
    })
}

pub fn policy_snapshot() -> Value {
    json!({
        "noveltyBudget": 1,
        "classArchetypeBias": 0.1,
        "fatigueBlockThreshold": "severe",
        "seededTieBreakBand": 0.05
    })
}

pub fn plan_session_request() -> Value {
    json!({
        "programId": "program-upper-1",
        "sessionFocus": "upper_push",
        "microcycleIndex": 2
    })
}

pub fn complete_session_request() -> Value {
    json!({
        "session": {
            "programDayId": "program-day-upper-1",
            "seed": FIXTURE_SEED,
            "startedAt": EFFECTIVE_AT,
            "completedAt": "2026-02-13T11:10:00.000Z",
            "exercises": [
                {
                    "slotId": "slot-bench-1",
                    "exerciseId": "bench-press",
                    "sets": [
                        { "setIndex": 0, "weight": 100, "reps": 5, "rir": 2, "notes": "Top set" },
                        { "setIndex": 1, "weight": 100, "reps": 5, "rir": 1 }
                    ]
                }
            ],
            "overallRpe": 8,
            "notes": "Felt solid"
        }
    })
}

pub fn metadata() -> Value {
    json!({
        "correlationId": "trace-plan-session-baseline"
    })
}

pub fn refresh_reference_hash(input: &mut EngineInputV1) {
    input.determinism.reference_hash =
        engine_rs::replay::hash_value(&input.reference_snapshot).expect("reference hash");
}

pub fn plan_session_input() -> EngineInputV1 {
    EngineInputV1 {
        schema_version: SCHEMA_VERSION.to_string(),
        operation: Operation::PlanSession,
        determinism: Determinism {
            seed: FIXTURE_SEED.to_string(),
            effective_at: EFFECTIVE_AT.to_string(),
            rule_version: "rules-2026-02".to_string(),
            reference_hash: REFERENCE_HASH.to_string(),
            canonicalization_version: "canon-replay-v1".to_string(),
        },
        reference_snapshot: reference_snapshot(),
        state_snapshot: state_snapshot(),
        policy_snapshot: policy_snapshot(),
        request: plan_session_request(),
        metadata: metadata(),
    }
}

pub fn plan_session_input_with(mutator: impl FnOnce(&mut EngineInputV1)) -> EngineInputV1 {
    let mut input = plan_session_input();
    mutator(&mut input);
    input
}

pub fn plan_session_baseline_input() -> EngineInputV1 {
    plan_session_input()
}

pub fn plan_session_no_solution_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push", "pull"]);
        input.state_snapshot["injuryState"]["activeLimitations"] =
            json!(["shoulder", "elbow", "back"]);
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.policy_snapshot["fatigueBlockThreshold"] = json!("moderate");
    })
}

pub fn plan_session_injury_blocked_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push"]);
        input.state_snapshot["injuryState"]["activeLimitations"] = json!(["shoulder"]);
        input.policy_snapshot["classArchetypeBias"] = json!(0.15);
    })
}

pub fn plan_session_severe_fatigue_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.state_snapshot["readinessState"]["muscleFatigue"]["chest"] = json!(90);
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] = json!("maintain");
    })
}

pub fn plan_session_metadata_variant_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.metadata["correlationId"] = json!("trace-plan-session-metadata-variant");
        input.metadata["uiHint"] = json!("coach-panel-open");
    })
}

pub fn plan_session_effective_at_variant_input(effective_at: &str) -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.determinism.effective_at = effective_at.to_string();
    })
}

pub fn plan_session_rule_version_variant_input(rule_version: &str) -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.determinism.rule_version = rule_version.to_string();
    })
}

pub fn plan_session_reordered_reference_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        let exercises = input.reference_snapshot["exercises"]
            .as_array_mut()
            .expect("reference exercises should be an array");
        exercises.reverse();
        refresh_reference_hash(input);
    })
}

pub fn plan_session_competing_blockers_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["pull"]);
        input.state_snapshot["injuryState"]["activeLimitations"] = json!(["shoulder"]);
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.policy_snapshot["fatigueBlockThreshold"] = json!("moderate");
    })
}

pub fn plan_session_widening_required_input() -> EngineInputV1 {
    plan_session_input_with(|input| {
        input.reference_snapshot["exercises"] = json!([
            {
                "id": "bench-press",
                "slug": "bench-press",
                "name": "Bench Press",
                "movementPattern": "pull",
                "equipment": ["barbell", "bench"],
                "tags": ["compound"]
            },
            {
                "id": "incline-dumbbell-press",
                "slug": "incline-dumbbell-press",
                "name": "Incline Dumbbell Press",
                "movementPattern": "pull",
                "equipment": ["dumbbells", "bench"],
                "tags": ["compound"]
            },
            {
                "id": "barbell-row",
                "slug": "barbell-row",
                "name": "Barbell Row",
                "movementPattern": "pull",
                "equipment": ["barbell"],
                "tags": ["compound"]
            }
        ]);
        refresh_reference_hash(input);
    })
}

pub fn complete_session_input() -> EngineInputV1 {
    EngineInputV1 {
        schema_version: SCHEMA_VERSION.to_string(),
        operation: Operation::CompleteSession,
        determinism: Determinism {
            seed: FIXTURE_SEED.to_string(),
            effective_at: EFFECTIVE_AT.to_string(),
            rule_version: "rules-2026-02".to_string(),
            reference_hash: REFERENCE_HASH.to_string(),
            canonicalization_version: "canon-replay-v1".to_string(),
        },
        reference_snapshot: reference_snapshot(),
        state_snapshot: state_snapshot(),
        policy_snapshot: policy_snapshot(),
        request: complete_session_request(),
        metadata: metadata(),
    }
}

pub fn complete_session_input_with(mutator: impl FnOnce(&mut EngineInputV1)) -> EngineInputV1 {
    let mut input = complete_session_input();
    mutator(&mut input);
    input
}

pub fn complete_session_baseline_input() -> EngineInputV1 {
    complete_session_input()
}

pub fn complete_session_compromised_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-compromised".to_string();
        input.request["session"]["overallRpe"] = json!(8);
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] = json!("swap");
    })
}

pub fn complete_session_partial_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-partial".to_string();
        input.request["session"]["overallRpe"] = json!(9);
    })
}

pub fn complete_session_missed_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-missed".to_string();
        input.request["session"]["overallRpe"] = json!(10);
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("moderate");
        input.state_snapshot["progressionState"]["records"][0]["trend"] = json!("improving");
    })
}

pub fn complete_session_metadata_variant_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.metadata["correlationId"] = json!("trace-complete-session-metadata-variant");
        input.metadata["surface"] = json!("dashboard");
    })
}

pub fn complete_session_rule_version_variant_input(rule_version: &str) -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.determinism.rule_version = rule_version.to_string();
    })
}

pub fn complete_session_effective_at_variant_input(effective_at: &str) -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.determinism.effective_at = effective_at.to_string();
    })
}

pub fn complete_session_session_note_variant_input(notes: &str) -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.request["session"]["notes"] = json!(notes);
    })
}

pub fn complete_session_set_note_variant_input(notes: &str) -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.request["session"]["exercises"][0]["sets"][0]["notes"] = json!(notes);
    })
}

pub fn complete_session_level_up_threshold_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.state_snapshot["gamificationState"]["xp"] = json!(198);
        input.request["session"]["overallRpe"] = json!(7);
        input.request["session"]["exercises"][0]["sets"][1]["reps"] = json!(6);
    })
}

pub fn complete_session_recent_completion_window_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.state_snapshot["recentCompletions"] = json!([
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-10T10:00:00.000Z",
                "quality": "complete_clean"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-11T10:00:00.000Z",
                "quality": "partial"
            },
            {
                "exerciseId": "barbell-row",
                "completedAt": "2026-02-12T09:00:00.000Z",
                "quality": "complete_compromised"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-12T10:00:00.000Z",
                "quality": "complete_clean"
            }
        ]);
    })
}

pub fn complete_session_recent_completion_window_without_completed_at_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-derived-path".to_string();
        if let Some(session) = input.request["session"].as_object_mut() {
            session.remove("completedAt");
        }
        input.state_snapshot["recentCompletions"] = json!([
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-10T10:00:00.000Z",
                "quality": "complete_clean"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-11T10:00:00.000Z",
                "quality": "partial"
            },
            {
                "exerciseId": "barbell-row",
                "completedAt": "2026-02-12T09:00:00.000Z",
                "quality": "complete_compromised"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-12T10:00:00.000Z",
                "quality": "complete_clean"
            }
        ]);
    })
}

pub fn complete_session_recent_completion_window_without_completed_at_input_with(
    mutator: impl FnOnce(&mut EngineInputV1),
) -> EngineInputV1 {
    let mut input = complete_session_recent_completion_window_without_completed_at_input();
    mutator(&mut input);
    input
}

pub fn reference_exercise_ids(input: &EngineInputV1) -> Vec<String> {
    input.reference_snapshot["exercises"]
        .as_array()
        .expect("reference exercises should be an array")
        .iter()
        .map(|exercise| {
            exercise["id"]
                .as_str()
                .expect("reference exercise ID should be a string")
                .to_string()
        })
        .collect()
}

fn apply_public_completion_state_patch(state_snapshot: &Value, state_patch: &Value) -> Value {
    let mut next_state = AthleteStateSnapshot::from_value(state_snapshot)
        .expect("state snapshot should deserialize");
    let patch = StatePatch::from_value(state_patch).expect("state patch should deserialize");
    let preserve_gamification_extras = patch.gamification_state.is_some();

    if let Some(readiness_patch) = patch.readiness_state {
        next_state.readiness_state.systemic_fatigue = readiness_patch.systemic_fatigue;
    }

    if let Some(gamification_patch) = patch.gamification_state {
        next_state.gamification_state.xp = gamification_patch.xp;
        next_state.gamification_state.level = gamification_patch.level;
        next_state.gamification_state.adherence_streak = gamification_patch.adherence_streak;
        next_state.gamification_state.completed_session_count =
            gamification_patch.completed_session_count;
        next_state.gamification_state.missed_session_count =
            gamification_patch.missed_session_count;
        next_state
            .gamification_state
            .last_adherence_outcome_classification =
            gamification_patch.last_adherence_outcome_classification;
        next_state.gamification_state.last_awarded_at = gamification_patch.last_awarded_at;
    }

    if let Some(progression_patch) = patch.progression_state {
        for (exercise_id, patch_entry) in progression_patch.0 {
            if let Some(existing_record) = next_state
                .progression_state
                .records
                .iter_mut()
                .find(|record| record.exercise_id == exercise_id)
            {
                existing_record.current_action = patch_entry.current_action;
                existing_record.trend = patch_entry.trend;
                existing_record.consecutive_successful_completions =
                    patch_entry.consecutive_successful_completions;
                existing_record.consecutive_stall_or_regression_count =
                    patch_entry.consecutive_stall_or_regression_count;
                existing_record.swap_recommendation_count = patch_entry.swap_recommendation_count;
                existing_record.last_session_outcome_classification =
                    patch_entry.last_session_outcome_classification;
                existing_record.last_completed_at = patch_entry.last_completed_at;
                if let Some(load) = patch_entry.last_successful_load {
                    existing_record.previous_performance_reference =
                        previous_performance_reference(load);
                }
                continue;
            }

            next_state
                .progression_state
                .records
                .push(ProgressionRecord {
                    exercise_id,
                    previous_performance_reference: patch_entry
                        .last_successful_load
                        .map(previous_performance_reference)
                        .unwrap_or_else(default_previous_performance_reference),
                    trend: patch_entry.trend,
                    current_action: patch_entry.current_action,
                    consecutive_successful_completions: patch_entry
                        .consecutive_successful_completions,
                    consecutive_stall_or_regression_count: patch_entry
                        .consecutive_stall_or_regression_count,
                    swap_recommendation_count: patch_entry.swap_recommendation_count,
                    last_session_outcome_classification: patch_entry
                        .last_session_outcome_classification,
                    last_completed_at: patch_entry.last_completed_at,
                });
        }
    }

    let mut patched_state = next_state
        .to_value()
        .expect("patched state snapshot should serialize");

    if preserve_gamification_extras {
        if let (Some(source), Some(target)) = (
            state_snapshot["gamificationState"].as_object(),
            patched_state["gamificationState"].as_object_mut(),
        ) {
            for (key, value) in source {
                if !matches!(
                    key.as_str(),
                    "xp" | "level"
                        | "adherenceStreak"
                        | "completedSessionCount"
                        | "missedSessionCount"
                        | "lastAdherenceOutcomeClassification"
                        | "lastAwardedAt"
                ) {
                    target.insert(key.clone(), value.clone());
                }
            }
        }
    }

    patched_state
}

fn previous_performance_reference(load: LoadRepsReference) -> PreviousPerformanceReference {
    PreviousPerformanceReference {
        weight: load.weight,
        reps: load.reps,
    }
}

fn default_previous_performance_reference() -> PreviousPerformanceReference {
    PreviousPerformanceReference {
        weight: serde_json::Number::from(0),
        reps: 0,
    }
}

pub fn next_plan_input_from_completion(
    baseline_plan_input: &EngineInputV1,
    completion_input: &EngineInputV1,
    complete_output: &EngineOutputV1,
) -> EngineInputV1 {
    let mut next_input = baseline_plan_input.clone();
    next_input.state_snapshot = apply_public_completion_state_patch(
        &completion_input.state_snapshot,
        &complete_output.state_patch,
    );
    next_input
}

pub fn next_plan_metadata_variant_input(input: &EngineInputV1) -> EngineInputV1 {
    let mut variant = input.clone();
    variant.metadata["correlationId"] = json!("trace-next-plan-metadata-variant");
    variant.metadata["screen"] = json!("history");
    variant
}

pub fn next_plan_seed_variant_input(input: &EngineInputV1) -> EngineInputV1 {
    let mut variant = input.clone();
    variant.determinism.seed = "seed-next-plan-variant".to_string();
    variant
}

pub fn next_plan_reordered_recent_completions_input(input: &EngineInputV1) -> EngineInputV1 {
    let mut variant = input.clone();
    variant.state_snapshot["recentCompletions"] = json!([
        {
            "exerciseId": "bench-press",
            "completedAt": "2026-02-12T10:00:00.000Z",
            "quality": "complete_clean"
        },
        {
            "exerciseId": "barbell-row",
            "completedAt": "2026-02-12T09:00:00.000Z",
            "quality": "complete_compromised"
        },
        {
            "exerciseId": "bench-press",
            "completedAt": "2026-02-11T10:00:00.000Z",
            "quality": "partial"
        },
        {
            "exerciseId": "bench-press",
            "completedAt": "2026-02-10T10:00:00.000Z",
            "quality": "complete_clean"
        }
    ]);
    variant
}
