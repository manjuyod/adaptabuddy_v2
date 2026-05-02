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
fn initialize_cycle_respects_low_fatigue_preference_by_skipping_secondary_accessories() {
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
        1
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
fn initialize_cycle_orders_program_blend_roles_and_only_keeps_secondary_accessories() {
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
            "slot-beta-accessory".to_string(),
            "slot-gamma-accessory".to_string(),
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
