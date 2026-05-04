use crate::{Determinism, EngineInputV1, Operation, SCHEMA_VERSION};
use serde_json::{json, Value};

pub const FIXTURE_SEED: &str = "seed-plan-session-baseline";
pub const EFFECTIVE_AT: &str = "2026-02-13T10:00:00.000Z";
pub const REFERENCE_HASH: &str =
    "sha256:ba49fccccc6a22098b9cdd5dd9b26eb51617a0e52ab69183e4e64609dfe21fb4";

const FIXTURE_NAMES: [&str; 11] = [
    "initialize-cycle-baseline",
    "plan-baseline",
    "plan-no-solution",
    "plan-injury-blocked",
    "plan-severe-fatigue",
    "complete-baseline",
    "complete-note-only-variant",
    "complete-compromised",
    "complete-partial",
    "complete-missed",
    "advance-baseline",
];

pub fn fixture_names() -> &'static [&'static str] {
    &FIXTURE_NAMES
}

pub fn named_fixture(name: &str) -> Option<EngineInputV1> {
    match name {
        "initialize-cycle-baseline" => Some(initialize_cycle_baseline_input()),
        "plan-baseline" => Some(plan_session_input()),
        "plan-no-solution" => Some(plan_session_no_solution_input()),
        "plan-injury-blocked" => Some(plan_session_injury_blocked_input()),
        "plan-severe-fatigue" => Some(plan_session_severe_fatigue_input()),
        "complete-baseline" => Some(complete_session_input()),
        "complete-note-only-variant" => Some(complete_session_note_only_variant_input()),
        "complete-compromised" => Some(complete_session_compromised_input()),
        "complete-partial" => Some(complete_session_partial_input()),
        "complete-missed" => Some(complete_session_missed_input()),
        "advance-baseline" => Some(advance_cycle_input()),
        _ => None,
    }
}

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

pub fn initialize_cycle_request() -> Value {
    json!({
        "profile": {
            "classChoice": "hybrid",
            "goalBias": "strength",
            "availableDaysPerWeek": 3,
            "fatiguePreference": "moderate",
            "injuryMuscleGroupSlugs": ["shoulders"]
        },
        "macrocycleWeeks": 8,
        "selectedPrograms": [
            {
                "programId": "program-strength",
                "weight": 0.7,
                "days": [
                    {
                        "programDayId": "day-strength-1",
                        "dayIndex": 0,
                        "name": "Strength Day 1",
                        "slots": [
                            {
                                "slotId": "slot-strength-main",
                                "slotIndex": 0,
                                "slotType": "main",
                                "movementPattern": "push",
                                "setsMin": 4,
                                "setsMax": 5,
                                "repsMin": 3,
                                "repsMax": 5,
                                "muscleTargets": {
                                    "chest": 0.6,
                                    "shoulders": 0.4
                                },
                                "tagsRequired": ["compound"]
                            }
                        ]
                    }
                ]
            },
            {
                "programId": "program-hypertrophy",
                "weight": 0.3,
                "days": [
                    {
                        "programDayId": "day-hypertrophy-1",
                        "dayIndex": 0,
                        "name": "Hypertrophy Day 1",
                        "slots": [
                            {
                                "slotId": "slot-hypertrophy-main",
                                "slotIndex": 0,
                                "slotType": "main",
                                "movementPattern": "pull",
                                "setsMin": 3,
                                "setsMax": 4,
                                "repsMin": 8,
                                "repsMax": 12,
                                "muscleTargets": {
                                    "back": 0.8
                                },
                                "tagsRequired": ["compound"]
                            },
                            {
                                "slotId": "slot-hypertrophy-accessory",
                                "slotIndex": 1,
                                "slotType": "accessory",
                                "movementPattern": "push",
                                "setsMin": 2,
                                "setsMax": 3,
                                "repsMin": 10,
                                "repsMax": 15,
                                "muscleTargets": {
                                    "shoulders": 0.6
                                },
                                "tagsRequired": ["hypertrophy"]
                            }
                        ]
                    }
                ]
            }
        ]
    })
}

pub fn initialize_cycle_reference_snapshot() -> Value {
    json!( {
        "referenceVersion": "2026-03",
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
                "id": "program-strength",
                "slug": "strength",
                "name": "Strength Builder",
                "daysPerWeek": 3
            },
            {
                "id": "program-hypertrophy",
                "slug": "hypertrophy",
                "name": "Hypertrophy Builder",
                "daysPerWeek": 3
            }
        ]
    })
}

pub fn initialize_cycle_state_snapshot() -> Value {
    json!( {
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
            "records": []
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
            "programId": "program-strength",
            "currentDayIndex": 0,
            "currentMicrocycle": 1
        },
        "recentCompletions": []
    })
}

pub fn initialize_cycle_baseline_input() -> EngineInputV1 {
    let mut input = EngineInputV1 {
        schema_version: SCHEMA_VERSION.to_string(),
        operation: Operation::InitializeCycle,
        determinism: Determinism {
            seed: "seed-initialize-cycle".to_string(),
            effective_at: "2026-03-29T10:00:00.000Z".to_string(),
            rule_version: "rules-2026-03".to_string(),
            reference_hash: String::new(),
            canonicalization_version: "canon-replay-v1".to_string(),
        },
        reference_snapshot: initialize_cycle_reference_snapshot(),
        state_snapshot: initialize_cycle_state_snapshot(),
        policy_snapshot: policy_snapshot(),
        request: initialize_cycle_request(),
        metadata: json!({
            "correlationId": "trace-initialize-cycle"
        }),
    };

    input.determinism.reference_hash =
        crate::replay::hash_value(&input.reference_snapshot).expect("reference hash");
    input
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

pub fn complete_session_note_only_variant_input() -> EngineInputV1 {
    complete_session_input_with(|input| {
        input.metadata["correlationId"] = json!("trace-complete-session-note-only-variant");
        input.request["session"]["notes"] = json!("Different non-material session note");
        input.request["session"]["exercises"][0]["sets"][0]["notes"] =
            json!("Different non-material set note");
    })
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

pub fn advance_cycle_input() -> EngineInputV1 {
    let mut input = complete_session_input();
    input.operation = Operation::AdvanceCycle;
    input.request = json!({
        "seasonIndex": 1,
        "completionRate": 0.8,
        "focus": "balanced"
    });
    input
}

pub fn advance_cycle_input_with(mutator: impl FnOnce(&mut EngineInputV1)) -> EngineInputV1 {
    let mut input = advance_cycle_input();
    mutator(&mut input);
    input
}

pub fn advance_cycle_s_rank_input() -> EngineInputV1 {
    advance_cycle_input_with(|input| {
        input.request = json!({
            "seasonIndex": 1,
            "completionRate": 0.98,
            "adherence": 0.96,
            "completionQuality": 0.97,
            "progression": 0.95,
            "recovery": 0.94,
            "consistency": 0.97,
            "focus": "strength"
        });
    })
}

pub fn advance_cycle_a_rank_input() -> EngineInputV1 {
    advance_cycle_input_with(|input| {
        input.request = json!({
            "seasonIndex": 2,
            "completionRate": 0.88,
            "adherence": 0.86,
            "completionQuality": 0.85,
            "progression": 0.82,
            "recovery": 0.84,
            "consistency": 0.83,
            "focus": "strength"
        });
    })
}

pub fn advance_cycle_b_rank_input() -> EngineInputV1 {
    advance_cycle_input_with(|input| {
        input.request = json!({
            "seasonIndex": 3,
            "completionRate": 0.74,
            "adherence": 0.72,
            "completionQuality": 0.71,
            "progression": 0.7,
            "recovery": 0.69,
            "consistency": 0.73,
            "focus": "balanced"
        });
    })
}

pub fn advance_cycle_c_rank_input() -> EngineInputV1 {
    advance_cycle_input_with(|input| {
        input.request = json!({
            "seasonIndex": 4,
            "completionRate": 0.59,
            "adherence": 0.57,
            "completionQuality": 0.55,
            "progression": 0.54,
            "recovery": 0.56,
            "consistency": 0.58,
            "focus": "balanced"
        });
    })
}

pub fn advance_cycle_d_rank_input() -> EngineInputV1 {
    advance_cycle_input_with(|input| {
        input.request = json!({
            "seasonIndex": 5,
            "completionRate": 0.31,
            "adherence": 0.28,
            "completionQuality": 0.25,
            "progression": 0.26,
            "recovery": 0.27,
            "consistency": 0.24,
            "focus": "recovery"
        });
    })
}
