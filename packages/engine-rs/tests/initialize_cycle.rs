use engine_rs::{initialize_cycle, Determinism, EngineInputV1, Operation, SCHEMA_VERSION};
use serde_json::{json, Value};
use std::collections::HashSet;

fn base_input() -> EngineInputV1 {
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
        reference_snapshot: json!({
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
        }),
        state_snapshot: json!({
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
        }),
        policy_snapshot: json!({
            "noveltyBudget": 1,
            "classArchetypeBias": 0.1,
            "fatigueBlockThreshold": "severe",
            "seededTieBreakBand": 0.05
        }),
        request: json!({
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
                                        "chest": 1.0,
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
                                        "back": 1.0
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
                                        "shoulders": 1.0
                                    },
                                    "tagsRequired": ["hypertrophy"]
                                }
                            ]
                        }
                    ]
                }
            ]
        }),
        metadata: json!({
            "correlationId": "trace-initialize-cycle"
        }),
    };
    refresh_reference_hash(&mut input);
    input
}

fn refresh_reference_hash(input: &mut EngineInputV1) {
    input.determinism.reference_hash =
        engine_rs::replay::hash_value(&input.reference_snapshot).expect("reference hash");
}

fn output_json(output: &engine_rs::EngineOutputV1) -> Value {
    serde_json::to_value(output).expect("serializing initialize_cycle output")
}

fn blended_programs_input() -> EngineInputV1 {
    let mut input = base_input();
    input.request["profile"]["fatiguePreference"] = json!("high");
    input.request["profile"]["injuryMuscleGroupSlugs"] = json!([]);
    input.reference_snapshot["programs"] = json!([
        {
            "id": "program-gamma",
            "slug": "gamma",
            "name": "Gamma Builder",
            "daysPerWeek": 1
        },
        {
            "id": "program-alpha",
            "slug": "alpha",
            "name": "Alpha Builder",
            "daysPerWeek": 1
        },
        {
            "id": "program-beta",
            "slug": "beta",
            "name": "Beta Builder",
            "daysPerWeek": 1
        }
    ]);
    refresh_reference_hash(&mut input);
    input.request["selectedPrograms"] = json!([
        {
            "programId": "program-gamma",
            "weight": 0.2,
            "days": [
                {
                    "programDayId": "day-gamma-1",
                    "dayIndex": 0,
                    "name": "Gamma Day 1",
                    "slots": [
                        {
                            "slotId": "slot-gamma-main",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "pull",
                            "setsMin": 3,
                            "setsMax": 4,
                            "repsMin": 6,
                            "repsMax": 8,
                            "muscleTargets": { "back": 1.0 },
                            "tagsRequired": ["compound"]
                        },
                        {
                            "slotId": "slot-gamma-accessory",
                            "slotIndex": 1,
                            "slotType": "accessory",
                            "movementPattern": "pull",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 10,
                            "repsMax": 15,
                            "muscleTargets": { "rear_delts": 1.0 },
                            "tagsRequired": ["hypertrophy"]
                        }
                    ]
                }
            ]
        },
        {
            "programId": "program-alpha",
            "weight": 0.6,
            "days": [
                {
                    "programDayId": "day-alpha-1",
                    "dayIndex": 0,
                    "name": "Alpha Day 1",
                    "slots": [
                        {
                            "slotId": "slot-alpha-main",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "push",
                            "setsMin": 4,
                            "setsMax": 5,
                            "repsMin": 3,
                            "repsMax": 5,
                            "muscleTargets": { "chest": 1.0 },
                            "tagsRequired": ["compound"]
                        }
                    ]
                }
            ]
        },
        {
            "programId": "program-beta",
            "weight": 0.4,
            "days": [
                {
                    "programDayId": "day-beta-1",
                    "dayIndex": 0,
                    "name": "Beta Day 1",
                    "slots": [
                        {
                            "slotId": "slot-beta-main",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "legs",
                            "setsMin": 3,
                            "setsMax": 4,
                            "repsMin": 5,
                            "repsMax": 8,
                            "muscleTargets": { "quads": 1.0 },
                            "tagsRequired": ["compound"]
                        },
                        {
                            "slotId": "slot-beta-accessory",
                            "slotIndex": 1,
                            "slotType": "accessory",
                            "movementPattern": "legs",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 10,
                            "repsMax": 15,
                            "muscleTargets": { "glutes": 1.0 },
                            "tagsRequired": ["hypertrophy"]
                        }
                    ]
                }
            ]
        }
    ]);
    input
}

fn canonicalization_input() -> EngineInputV1 {
    let mut input = base_input();
    input.request["profile"]["availableDaysPerWeek"] = json!(2);
    input.request["macrocycleWeeks"] = json!(2);
    input.request["profile"]["fatiguePreference"] = json!("high");
    input.request["profile"]["injuryMuscleGroupSlugs"] = json!([]);
    input.request["selectedPrograms"] = json!([
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
                            "slotId": "slot-strength-main-a",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "push",
                            "setsMin": 4,
                            "setsMax": 5,
                            "repsMin": 3,
                            "repsMax": 5,
                            "muscleTargets": { "chest": 1.0 },
                            "tagsRequired": ["compound"]
                        },
                        {
                            "slotId": "slot-strength-main-b",
                            "slotIndex": 1,
                            "slotType": "main",
                            "movementPattern": "pull",
                            "setsMin": 3,
                            "setsMax": 4,
                            "repsMin": 6,
                            "repsMax": 8,
                            "muscleTargets": { "back": 1.0 },
                            "tagsRequired": ["compound"]
                        }
                    ]
                },
                {
                    "programDayId": "day-strength-2",
                    "dayIndex": 1,
                    "name": "Strength Day 2",
                    "slots": [
                        {
                            "slotId": "slot-strength-secondary-a",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "legs",
                            "setsMin": 3,
                            "setsMax": 4,
                            "repsMin": 5,
                            "repsMax": 7,
                            "muscleTargets": { "quads": 1.0 },
                            "tagsRequired": ["compound"]
                        },
                        {
                            "slotId": "slot-strength-secondary-b",
                            "slotIndex": 1,
                            "slotType": "main",
                            "movementPattern": "hinge",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 6,
                            "repsMax": 8,
                            "muscleTargets": { "glutes": 1.0 },
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
                            "slotId": "slot-hypertrophy-accessory-a",
                            "slotIndex": 0,
                            "slotType": "accessory",
                            "movementPattern": "arms",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 10,
                            "repsMax": 15,
                            "muscleTargets": { "biceps": 1.0 },
                            "tagsRequired": ["hypertrophy"]
                        },
                        {
                            "slotId": "slot-hypertrophy-accessory-b",
                            "slotIndex": 1,
                            "slotType": "accessory",
                            "movementPattern": "arms",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 12,
                            "repsMax": 15,
                            "muscleTargets": { "triceps": 1.0 },
                            "tagsRequired": ["hypertrophy"]
                        }
                    ]
                },
                {
                    "programDayId": "day-hypertrophy-2",
                    "dayIndex": 1,
                    "name": "Hypertrophy Day 2",
                    "slots": [
                        {
                            "slotId": "slot-hypertrophy-accessory-c",
                            "slotIndex": 0,
                            "slotType": "accessory",
                            "movementPattern": "shoulders",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 10,
                            "repsMax": 15,
                            "muscleTargets": { "lateral_delts": 1.0 },
                            "tagsRequired": ["hypertrophy"]
                        },
                        {
                            "slotId": "slot-hypertrophy-accessory-d",
                            "slotIndex": 1,
                            "slotType": "accessory",
                            "movementPattern": "core",
                            "setsMin": 2,
                            "setsMax": 3,
                            "repsMin": 12,
                            "repsMax": 16,
                            "muscleTargets": { "abs": 1.0 },
                            "tagsRequired": ["hypertrophy"]
                        }
                    ]
                }
            ]
        }
    ]);
    input
}

fn reverse_day_and_slot_order(input: &mut EngineInputV1) {
    let selected_programs = input.request["selectedPrograms"]
        .as_array_mut()
        .expect("selectedPrograms should be an array");

    for program in selected_programs.iter_mut() {
        let days = program["days"]
            .as_array_mut()
            .expect("days should be an array");
        days.reverse();

        for day in days.iter_mut() {
            let slots = day["slots"]
                .as_array_mut()
                .expect("slots should be an array");
            slots.reverse();
        }
    }
}

fn session_ids(output: &Value) -> Vec<String> {
    output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array")
        .iter()
        .map(|session| {
            session["sessionId"]
                .as_str()
                .expect("sessionId should be a string")
                .to_string()
        })
        .collect()
}

fn session_order(output: &Value) -> Vec<(String, String)> {
    output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array")
        .iter()
        .map(|session| {
            (
                session["sessionId"]
                    .as_str()
                    .expect("sessionId should be a string")
                    .to_string(),
                session["programDayId"]
                    .as_str()
                    .expect("programDayId should be a string")
                    .to_string(),
            )
        })
        .collect()
}

fn slot_payload_ids(output: &Value) -> Vec<Vec<String>> {
    output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array")
        .iter()
        .map(|session| {
            session["slotPayload"]
                .as_array()
                .expect("slotPayload should be an array")
                .iter()
                .map(|slot| {
                    slot["slotId"]
                        .as_str()
                        .expect("slotId should be a string")
                        .to_string()
                })
                .collect()
        })
        .collect()
}

fn challenge_progression_input(exercise_slug: &str, max_reps: u64) -> EngineInputV1 {
    let mut input = base_input();
    input.request["profile"]["availableDaysPerWeek"] = json!(3);
    input.request["macrocycleWeeks"] = json!(6);
    input.reference_snapshot["exercises"] = json!([
        {
            "id": exercise_slug,
            "slug": exercise_slug,
            "name": "Challenge Exercise",
            "movementPattern": "push",
            "equipment": ["bodyweight"],
            "tags": ["challenge"]
        }
    ]);
    input.reference_snapshot["programs"] = json!([
        {
            "id": "program-challenge",
            "slug": "challenge",
            "name": "Challenge",
            "daysPerWeek": 3
        }
    ]);
    refresh_reference_hash(&mut input);
    input.request["programAdaptationInputs"] = json!({
        "challengeBaselines": {
            exercise_slug: { "maxReps": max_reps }
        }
    });
    input.request["selectedPrograms"] = json!([
        {
            "programId": "program-challenge",
            "weight": 1.0,
            "templateKind": "challenge_progression",
            "adaptiveTemplate": {
                "challenge": "100_pushups",
                "exercise": { "canonical_name": "Push-Up", "slug": exercise_slug },
                "initial_test_groups": [
                    { "group": "group_1", "min": 0, "max": 10 },
                    { "group": "group_2", "min": 11, "max": 20 },
                    { "group": "group_3", "min": 21, "max": 999 }
                ],
                "groups": {
                    "group_1": {
                        "weeks": [
                            {
                                "week": 1,
                                "days": [
                                    {
                                        "day_index": 1,
                                        "rest_seconds": 60,
                                        "sets": [
                                            { "reps": 2 },
                                            { "reps": 3 },
                                            { "reps": 2 },
                                            { "reps": 2 },
                                            { "reps": 3, "type": "min_plus" }
                                        ]
                                    },
                                    {
                                        "day_index": 2,
                                        "rest_seconds": 90,
                                        "sets": [
                                            { "reps": 3 },
                                            { "reps": 4 },
                                            { "reps": 2 },
                                            { "reps": 3 },
                                            { "reps": 4, "type": "min_plus" }
                                        ]
                                    },
                                    {
                                        "day_index": 3,
                                        "rest_seconds": 120,
                                        "sets": [
                                            { "reps": 4 },
                                            { "reps": 5 },
                                            { "reps": 4 },
                                            { "reps": 4 },
                                            { "reps": 5, "type": "min_plus" }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    "group_2": {
                        "weeks": [
                            {
                                "week": 1,
                                "days": [
                                    {
                                        "day_index": 1,
                                        "rest_seconds": 60,
                                        "sets": [
                                            { "reps": 9 },
                                            { "reps": 11 },
                                            { "reps": 8 },
                                            { "reps": 8 },
                                            { "reps": 11, "type": "min_plus" }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            "days": []
        }
    ]);
    input
}

fn hypertrophy_engine_input() -> EngineInputV1 {
    let mut input = base_input();
    input.request["profile"]["availableDaysPerWeek"] = json!(3);
    input.request["macrocycleWeeks"] = json!(1);
    input.reference_snapshot["programs"] = json!([
        {
            "id": "program-hev1",
            "slug": "hypertrophy-engine-v1",
            "name": "Hypertrophy Engine v1",
            "daysPerWeek": 3
        }
    ]);
    refresh_reference_hash(&mut input);
    input.request["selectedPrograms"] = json!([
        {
            "programId": "program-hev1",
            "weight": 1.0,
            "templateKind": "hypertrophy_engine_v1",
            "adaptiveTemplate": {
                "sessions": [
                    {
                        "session_key": "hev1_full_body_a",
                        "label": "Full Body AWP",
                        "focus": "Full Body A (AWP)",
                        "slots": [
                            {
                                "slot_key": "squat_primary",
                                "movement_pattern": "squat",
                                "sets": 4,
                                "reps": "6-10",
                                "target_muscles": ["quads", "glutes"],
                                "tags": ["compound", "hypertrophy"]
                            },
                            {
                                "slot_key": "press_horizontal",
                                "movement_pattern": "horizontal_press",
                                "sets": 4,
                                "reps": "8-12",
                                "target_muscles": ["chest"],
                                "tags": ["compound", "hypertrophy"]
                            }
                        ]
                    },
                    {
                        "session_key": "hev1_full_body_b",
                        "label": "Full Body Pull",
                        "focus": "Full Body B (Pull + Hinge)",
                        "slots": [
                            {
                                "slot_key": "hinge_main",
                                "movement_pattern": "hinge",
                                "sets": 4,
                                "reps": "8-10",
                                "target_muscles": ["hamstrings", "glutes"],
                                "tags": ["compound", "hypertrophy"]
                            }
                        ]
                    },
                    {
                        "session_key": "hev1_full_body_c",
                        "label": "Full Body Pump",
                        "focus": "Full Body C (Pump)",
                        "slots": [
                            {
                                "slot_key": "row_back",
                                "movement_pattern": "horizontal_pull",
                                "sets": 3,
                                "reps": "10-12",
                                "target_muscles": ["upper-back", "lats"],
                                "tags": ["compound", "hypertrophy"]
                            }
                        ]
                    }
                ]
            },
            "days": []
        }
    ]);
    input
}

fn true_program_blend_input(fatigue_preference: &str, injuries: Vec<&str>) -> EngineInputV1 {
    let mut input = challenge_progression_input("push_up", 20);
    input.request["profile"]["fatiguePreference"] = json!(fatigue_preference);
    input.request["profile"]["injuryMuscleGroupSlugs"] = json!(injuries);
    input.request["macrocycleWeeks"] = json!(1);
    input.reference_snapshot["exercises"] = json!([
        {
            "id": "push_up",
            "slug": "push_up",
            "name": "Push-Up",
            "movementPattern": "push",
            "equipment": ["bodyweight"],
            "tags": ["challenge"]
        },
        {
            "id": "safety-bar-box-squat",
            "slug": "safety-bar-box-squat",
            "name": "Safety Bar Box Squat",
            "movementPattern": "squat",
            "equipment": ["barbell"],
            "tags": ["swap_for:squat", "knee_friendly"]
        },
        {
            "id": "bench-press",
            "slug": "bench-press",
            "name": "Bench Press",
            "movementPattern": "horizontal_press",
            "equipment": ["barbell", "bench"],
            "tags": ["compound"]
        }
    ]);
    input.reference_snapshot["programs"] = json!([
        {
            "id": "program-powerlifting",
            "slug": "powerlifting",
            "name": "Powerlifting",
            "daysPerWeek": 3
        },
        {
            "id": "program-bench",
            "slug": "bench",
            "name": "Bench Program",
            "daysPerWeek": 3
        },
        {
            "id": "program-challenge",
            "slug": "challenge",
            "name": "Challenge",
            "daysPerWeek": 3
        }
    ]);
    refresh_reference_hash(&mut input);
    input.request["programAdaptationInputs"] = json!({
        "challengeBaselines": {
            "push_up": { "maxReps": 20 }
        },
        "strengthBaselines": {
            "squat": { "estimatedOneRepMax": 225, "unit": "lbs", "source": "onboarding" },
            "deadlift": { "estimatedOneRepMax": 225, "unit": "lbs", "source": "onboarding" },
            "bench_press": { "estimatedOneRepMax": 100, "unit": "lbs", "source": "onboarding" }
        }
    });
    input.request["selectedPrograms"] = json!([
        {
            "programId": "program-powerlifting",
            "weight": 0.5,
            "days": [
                {
                    "programDayId": "power-day-1",
                    "dayIndex": 0,
                    "name": "Power Day",
                    "slots": [
                        {
                            "slotId": "power-squat-main",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "squat",
                            "setsMin": 5,
                            "setsMax": 5,
                            "repsMin": 3,
                            "repsMax": 5,
                            "muscleTargets": { "quads": 1.0 },
                            "tagsRequired": ["compound"]
                        },
                        {
                            "slotId": "power-deadlift-main",
                            "slotIndex": 1,
                            "slotType": "main",
                            "movementPattern": "deadlift",
                            "setsMin": 4,
                            "setsMax": 4,
                            "repsMin": 3,
                            "repsMax": 5,
                            "muscleTargets": { "glutes": 1.0, "hamstrings": 0.8 },
                            "tagsRequired": ["compound"]
                        }
                    ]
                }
            ]
        },
        {
            "programId": "program-bench",
            "weight": 0.3,
            "days": [
                {
                    "programDayId": "bench-day-1",
                    "dayIndex": 0,
                    "name": "Bench Day",
                    "slots": [
                        {
                            "slotId": "bench-main",
                            "slotIndex": 0,
                            "slotType": "main",
                            "movementPattern": "horizontal_press",
                            "setsMin": 4,
                            "setsMax": 4,
                            "repsMin": 4,
                            "repsMax": 6,
                            "muscleTargets": { "chest": 1.0 },
                            "tagsRequired": ["compound"]
                        }
                    ]
                }
            ]
        },
        {
            "programId": "program-challenge",
            "weight": 0.2,
            "templateKind": "challenge_progression",
            "adaptiveTemplate": {
                "challenge": "100_pushups",
                "exercise": { "canonical_name": "Push-Up", "slug": "push_up" },
                "initial_test_groups": [
                    { "group": "group_1", "min": 0, "max": 10 },
                    { "group": "group_2", "min": 11, "max": 20 },
                    { "group": "group_3", "min": 21, "max": 999 }
                ],
                "groups": {
                    "group_2": {
                        "weeks": [
                            {
                                "week": 1,
                                "days": [
                                    {
                                        "day_index": 1,
                                        "rest_seconds": 60,
                                        "sets": [
                                            { "reps": 9 },
                                            { "reps": 11 },
                                            { "reps": 8 },
                                            { "reps": 8 },
                                            { "reps": 11, "type": "min_plus" }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            "days": []
        }
    ]);
    input
}

fn weekly_set_count(output: &Value) -> u64 {
    output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array")
        .iter()
        .flat_map(|session| {
            session["slotPayload"]
                .as_array()
                .expect("slot payload should be an array")
        })
        .filter(|slot| {
            slot["tagsRequired"]
                .as_array()
                .is_none_or(|tags| !tags.iter().any(|tag| tag == "challenge"))
        })
        .map(|slot| slot["setsMax"].as_u64().expect("setsMax should be numeric"))
        .sum()
}

#[test]
fn initialize_cycle_is_replay_stable_for_identical_input() {
    let input = base_input();

    let first = output_json(&initialize_cycle(&input).expect("first initialize_cycle"));
    let second = output_json(&initialize_cycle(&input).expect("second initialize_cycle"));

    assert_eq!(first, second);
}

#[test]
fn initialize_cycle_expands_a_full_macrocycle_with_primary_program_blend() {
    let output = output_json(&initialize_cycle(&base_input()).expect("initialize_cycle"));

    assert_eq!(output["result"]["resolvedClassArchetype"], json!("hybrid"));
    assert_eq!(
        output["result"]["primaryProgramId"],
        json!("program-strength")
    );
    assert_eq!(output["result"]["macrocycle"]["totalWeeks"], json!(8));
    assert_eq!(output["result"]["macrocycle"]["mesocycleCount"], json!(2));
    assert_eq!(
        output["result"]["macrocycle"]["sessions"]
            .as_array()
            .expect("sessions should be an array")
            .len(),
        24
    );
}

#[test]
fn initialize_cycle_expands_challenge_progression_from_baseline_group() {
    let output = output_json(
        &initialize_cycle(&challenge_progression_input("push_up", 12))
            .expect("challenge progression should initialize"),
    );
    let sessions = output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array");

    assert_eq!(sessions.len(), 18);
    assert_eq!(
        sessions[0]["programDayId"],
        json!("program-challenge-w1-d1")
    );
    assert_eq!(
        sessions[0]["programDayName"],
        json!("Challenge Week 1 Day 1")
    );
    assert_eq!(
        sessions[0]["slotPayload"][0]["slotId"],
        json!("program-challenge-w1-d1-set-1")
    );
    assert_eq!(sessions[0]["slotPayload"][0]["setsMin"], json!(1));
    assert_eq!(sessions[0]["slotPayload"][0]["repsMin"], json!(9));
    assert_eq!(
        sessions[0]["slotPayload"][4]["prescription"]["challengeGroup"],
        json!("group_2")
    );
    assert_eq!(
        sessions[0]["slotPayload"][4]["prescription"]["setType"],
        json!("min_plus")
    );
}

#[test]
fn initialize_cycle_rejects_challenge_progression_without_required_baseline() {
    let mut input = challenge_progression_input("push_up", 12);
    input.request["programAdaptationInputs"] = json!({ "challengeBaselines": {} });

    let error = initialize_cycle(&input).expect_err("missing challenge baseline should fail");

    assert!(matches!(
        error,
        engine_rs::EngineError::InvalidInput { message }
        if message.contains("challenge baseline") && message.contains("push_up")
    ));
}

#[test]
fn initialize_cycle_expands_hypertrophy_engine_sessions_from_metadata() {
    let output = output_json(
        &initialize_cycle(&hypertrophy_engine_input())
            .expect("hypertrophy engine should initialize"),
    );
    let sessions = output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array");

    assert_eq!(sessions.len(), 3);
    assert_eq!(sessions[0]["programDayId"], json!("hev1_full_body_a"));
    assert_eq!(sessions[0]["programDayName"], json!("Full Body AWP"));
    assert_eq!(
        sessions[0]["slotPayload"][0]["slotId"],
        json!("squat_primary")
    );
    assert_eq!(sessions[0]["slotPayload"][0]["setsMin"], json!(4));
    assert_eq!(sessions[0]["slotPayload"][0]["repsMin"], json!(6));
    assert_eq!(
        sessions[0]["slotPayload"][0]["muscleTargets"]["quads"],
        json!(1.0)
    );
}

#[test]
fn initialize_cycle_aggregates_main_work_from_all_selected_programs() {
    let output = output_json(
        &initialize_cycle(&true_program_blend_input("low", vec![]))
            .expect("initialize_cycle should aggregate selected programs"),
    );
    let first_session_slots = output["result"]["macrocycle"]["sessions"][0]["slotPayload"]
        .as_array()
        .expect("slot payload should be an array");
    let source_programs = first_session_slots
        .iter()
        .map(|slot| slot["sourceProgramId"].as_str().expect("source program"))
        .collect::<HashSet<_>>();

    assert!(source_programs.contains("program-powerlifting"));
    assert!(source_programs.contains("program-bench"));
    assert!(source_programs.contains("program-challenge"));
    assert!(first_session_slots.iter().any(|slot| {
        slot["slotId"] == json!("program-challenge-w1-d1-set-5")
            && slot["prescription"]["challengeGroup"] == json!("group_2")
    }));
}

#[test]
fn initialize_cycle_swaps_knee_constrained_main_work_before_removing_it() {
    let output = output_json(
        &initialize_cycle(&true_program_blend_input("low", vec!["quads"]))
            .expect("initialize_cycle should adapt constrained work"),
    );
    let squat_slot = output["result"]["macrocycle"]["sessions"][0]["slotPayload"]
        .as_array()
        .expect("slot payload should be an array")
        .iter()
        .find(|slot| slot["slotId"] == json!("power-squat-main"))
        .expect("squat intent should be preserved with a safe swap");

    assert_eq!(
        squat_slot["lockedExerciseId"],
        json!("safety-bar-box-squat")
    );
    assert_eq!(
        squat_slot["prescription"]["adaptation"]["action"],
        json!("swap")
    );
    assert_eq!(
        squat_slot["prescription"]["adaptation"]["injuryMuscleGroupSlugs"],
        json!(["quads"])
    );
}

#[test]
fn initialize_cycle_caps_weekly_volume_more_aggressively_for_high_fatigue() {
    let high_output = output_json(
        &initialize_cycle(&true_program_blend_input("high", vec![]))
            .expect("high fatigue initialize_cycle"),
    );
    let low_output = output_json(
        &initialize_cycle(&true_program_blend_input("low", vec![]))
            .expect("low fatigue initialize_cycle"),
    );

    assert!(weekly_set_count(&high_output) < weekly_set_count(&low_output));
    assert!(high_output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array")
        .iter()
        .flat_map(|session| session["slotPayload"].as_array().expect("slot payload"))
        .any(|slot| slot["sourceProgramId"] == json!("program-challenge")));
}

#[test]
fn initialize_cycle_accepts_canonical_strength_class_choice_and_emits_only_strength() {
    let mut input = base_input();
    input.request["profile"]["classChoice"] = json!("strength");
    input.state_snapshot["athleteProfile"]["classArchetype"] = json!("powerlifter");

    let output = output_json(&initialize_cycle(&input).expect("initialize_cycle"));
    let sessions = output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array");

    assert_eq!(
        output["result"]["resolvedClassArchetype"],
        json!("strength")
    );
    assert!(sessions
        .iter()
        .all(|session| session["classArchetype"] == json!("strength")));
}

#[test]
fn initialize_cycle_filters_injury_biased_accessory_slots_from_secondary_programs() {
    let output = output_json(&initialize_cycle(&base_input()).expect("initialize_cycle"));

    let first_session = &output["result"]["macrocycle"]["sessions"][0];
    let slot_payload = first_session["slotPayload"]
        .as_array()
        .expect("slot payload should be an array");

    assert!(slot_payload
        .iter()
        .all(|slot| slot["slotId"] != json!("slot-hypertrophy-accessory")));
}

#[test]
fn initialize_cycle_low_fatigue_allows_aggregate_secondary_work() {
    let mut input = base_input();
    input.request["profile"]["fatiguePreference"] = json!("low");
    input.request["profile"]["injuryMuscleGroupSlugs"] = json!([]);

    let output = output_json(&initialize_cycle(&input).expect("initialize_cycle"));
    let first_session = &output["result"]["macrocycle"]["sessions"][0];

    assert_eq!(
        first_session["slotPayload"]
            .as_array()
            .expect("slot payload should be an array")
            .len(),
        3
    );
}

#[test]
fn initialize_cycle_rejects_an_empty_program_selection_list() {
    let mut input = base_input();
    input.request["selectedPrograms"] = json!([]);

    let error = initialize_cycle(&input).expect_err("empty program list should fail");

    assert!(matches!(
        error,
        engine_rs::EngineError::InvalidInput { message }
        if message.contains("selectedPrograms") && message.contains("at least one")
    ));
}

#[test]
fn initialize_cycle_orders_program_blend_roles_and_aggregates_until_fatigue_cap() {
    let output =
        output_json(&initialize_cycle(&blended_programs_input()).expect("initialize_cycle"));

    assert_eq!(
        output["result"]["programBlend"],
        json!([
            {
                "programId": "program-alpha",
                "weight": 0.6,
                "role": "primary"
            },
            {
                "programId": "program-beta",
                "weight": 0.4,
                "role": "secondary"
            },
            {
                "programId": "program-gamma",
                "weight": 0.2,
                "role": "secondary"
            }
        ])
    );

    let first_session_slots = output["result"]["macrocycle"]["sessions"][0]["slotPayload"]
        .as_array()
        .expect("slot payload should be an array");
    let first_session_slot_ids = first_session_slots
        .iter()
        .map(|slot| {
            slot["slotId"]
                .as_str()
                .expect("slot id should be a string")
                .to_string()
        })
        .collect::<Vec<_>>();

    assert_eq!(
        first_session_slot_ids,
        vec![
            "slot-alpha-main".to_string(),
            "slot-beta-main".to_string(),
            "slot-beta-accessory".to_string(),
            "slot-gamma-main".to_string(),
        ]
    );
}

#[test]
fn initialize_cycle_emits_contiguous_unique_session_indices_in_macrocycle_order() {
    let output = output_json(&initialize_cycle(&base_input()).expect("initialize_cycle"));
    let sessions = output["result"]["macrocycle"]["sessions"]
        .as_array()
        .expect("sessions should be an array");
    let mut seen_indices = HashSet::new();
    let mut seen_session_ids = HashSet::new();

    for (expected_index, session) in sessions.iter().enumerate() {
        let session_index = session["sessionIndex"]
            .as_u64()
            .expect("sessionIndex should be a u64");
        let macro_week = session["macroWeek"]
            .as_u64()
            .expect("macroWeek should be a u64");
        let planned_day = session["plannedDayOfWeek"]
            .as_u64()
            .expect("plannedDayOfWeek should be a u64");
        let session_id = session["sessionId"]
            .as_str()
            .expect("sessionId should be a string");

        assert_eq!(session_index, expected_index as u64);
        assert!(seen_indices.insert(session_index));
        assert!(seen_session_ids.insert(session_id.to_string()));

        let expected_week = (expected_index / 3) as u64 + 1;
        let expected_day = (expected_index % 3) as u64;

        assert_eq!(macro_week, expected_week);
        assert_eq!(planned_day, expected_day);
        assert_eq!(
            session_id,
            format!("program-strength-w{}-d{}", expected_week, expected_day + 1)
        );
    }
}

#[test]
fn initialize_cycle_keeps_session_order_stable_when_program_days_are_reversed() {
    let canonical_output =
        output_json(&initialize_cycle(&canonicalization_input()).expect("initialize_cycle"));
    let mut reversed_input = canonicalization_input();
    reverse_day_and_slot_order(&mut reversed_input);
    let reversed_output =
        output_json(&initialize_cycle(&reversed_input).expect("initialize_cycle"));

    assert_eq!(
        session_ids(&canonical_output),
        session_ids(&reversed_output)
    );
    assert_eq!(
        session_order(&canonical_output),
        session_order(&reversed_output)
    );
}

#[test]
fn initialize_cycle_keeps_slot_payload_order_stable_when_program_slots_are_reversed() {
    let canonical_output =
        output_json(&initialize_cycle(&canonicalization_input()).expect("initialize_cycle"));
    let mut reversed_input = canonicalization_input();
    reverse_day_and_slot_order(&mut reversed_input);
    let reversed_output =
        output_json(&initialize_cycle(&reversed_input).expect("initialize_cycle"));

    assert_eq!(
        slot_payload_ids(&canonical_output),
        slot_payload_ids(&reversed_output)
    );
}
