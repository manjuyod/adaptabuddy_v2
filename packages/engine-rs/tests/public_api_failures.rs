#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::{complete_session, plan_session, EngineError};
use serde_json::json;

fn initialize_cycle_input() -> engine_rs::EngineInputV1 {
    let mut input = fixtures::plan_session_input();
    input.operation = engine_rs::Operation::InitializeCycle;
    input.request = json!({
        "profile": {
            "classChoice": "hybrid",
            "goalBias": "strength",
            "availableDaysPerWeek": 1,
            "fatiguePreference": "moderate",
            "injuryMuscleGroupSlugs": ["shoulders"]
        },
        "macrocycleWeeks": 8,
        "selectedPrograms": [
            {
                "programId": "program-upper-1",
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
                                    "chest": 1.0
                                },
                                "tagsRequired": ["compound"]
                            }
                        ]
                    }
                ]
            }
        ]
    });
    input
}

fn expect_invalid_input(
    result: Result<engine_rs::EngineOutputV1, EngineError>,
    expected_fragments: &[&str],
) {
    let error = result.expect_err("public API call should reject malformed input");
    let message = match error {
        EngineError::InvalidInput { message } => message,
        other => panic!("expected invalid input error, got {other:?}"),
    };

    for fragment in expected_fragments {
        assert!(
            message.contains(fragment),
            "expected error message to contain {fragment:?}, got {message:?}"
        );
    }
}

#[test]
fn plan_session_rejects_complete_session_request_shape_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.request = fixtures::complete_session_request();

    expect_invalid_input(
        plan_session(&input),
        &["request", "plan_session", "session"],
    );
}

#[test]
fn complete_session_rejects_plan_session_request_shape_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request = fixtures::plan_session_request();

    expect_invalid_input(
        complete_session(&input),
        &["request", "complete_session", "session"],
    );
}

#[test]
fn plan_session_rejects_non_numeric_microcycle_index_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.request["microcycleIndex"] = json!("three");

    expect_invalid_input(
        plan_session(&input),
        &["request", "microcycleIndex", "integer"],
    );
}

#[test]
fn plan_session_rejects_negative_microcycle_index_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.request["microcycleIndex"] = json!(-1);

    expect_invalid_input(
        plan_session(&input),
        &["request", "microcycleIndex", ">= 0"],
    );
}

#[test]
fn plan_session_rejects_empty_program_id_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.request["programId"] = json!("");

    expect_invalid_input(plan_session(&input), &["request", "programId", "non-empty"]);
}

#[test]
fn plan_session_rejects_empty_session_focus_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.request["sessionFocus"] = json!("");

    expect_invalid_input(
        plan_session(&input),
        &["request", "sessionFocus", "non-empty"],
    );
}

#[test]
fn initialize_cycle_rejects_empty_selected_programs_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"] = json!([]);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "selectedPrograms", "at least one"],
    );
}

#[test]
fn initialize_cycle_rejects_invalid_fatigue_preference_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["profile"]["fatiguePreference"] = json!("maximal");

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "fatiguePreference", "low, moderate, or high"],
    );
}

#[test]
fn initialize_cycle_rejects_legacy_class_choice_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["profile"]["classChoice"] = json!("powerlifter");

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "classChoice", "strength|hybrid"],
    );
}

#[test]
fn initialize_cycle_rejects_arbitrary_class_choice_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["profile"]["classChoice"] = json!("speed");

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "classChoice", "strength|hybrid"],
    );
}

#[test]
fn initialize_cycle_rejects_empty_nested_days_list_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"] = json!([]);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "selectedPrograms[0].days", "at least one day"],
    );
}

#[test]
fn initialize_cycle_rejects_empty_slot_lists_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]["slots"] = json!([]);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &[
            "request",
            "selectedPrograms[0].days[0].slots",
            "at least one",
        ],
    );
}

#[test]
fn initialize_cycle_rejects_selected_program_ids_missing_from_reference_snapshot() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["programId"] = json!("program-missing");

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &[
            "request",
            "selectedPrograms[0].programId",
            "referenceSnapshot.programs",
        ],
    );
}

#[test]
fn initialize_cycle_rejects_unknown_slot_types_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["slotType"] = json!("accessroy");

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &[
            "request",
            "slotType",
            "main, accessory, conditioning, warmup, or cooldown",
        ],
    );
}

#[test]
fn initialize_cycle_rejects_slot_bounds_when_sets_min_exceeds_sets_max_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["setsMin"] = json!(6);
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["setsMax"] = json!(5);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "setsMin", "setsMax"],
    );
}

#[test]
fn initialize_cycle_rejects_slot_bounds_when_reps_min_exceeds_reps_max_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["repsMin"] = json!(6);
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["repsMax"] = json!(5);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "repsMin", "repsMax"],
    );
}

#[test]
fn initialize_cycle_rejects_day_index_larger_than_u32_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]["dayIndex"] = json!(4294967296u64);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "dayIndex", "<=", "4294967295"],
    );
}

#[test]
fn initialize_cycle_rejects_slot_bounds_larger_than_u32_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["slotIndex"] = json!(4294967296u64);
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["setsMin"] = json!(4294967296u64);
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["setsMax"] = json!(4294967296u64);
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["repsMin"] = json!(4294967296u64);
    input.request["selectedPrograms"][0]["days"][0]["slots"][0]["repsMax"] = json!(4294967296u64);

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "slotIndex", "<=", "4294967295"],
    );
}

#[test]
fn initialize_cycle_rejects_missing_nested_program_day_id_through_public_api() {
    let mut input = initialize_cycle_input();
    input.request["selectedPrograms"][0]["days"][0]
        .as_object_mut()
        .expect("day should be an object")
        .remove("programDayId");

    expect_invalid_input(
        engine_rs::initialize_cycle(&input),
        &["request", "missing field", "programDayId"],
    );
}

#[test]
fn complete_session_rejects_non_numeric_overall_rpe_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["overallRpe"] = json!("hard");

    expect_invalid_input(
        complete_session(&input),
        &["request", "overallRpe", "integer"],
    );
}

#[test]
fn complete_session_accepts_canonical_contract_shape_with_nullables_and_notes() {
    let input = fixtures::complete_session_input_with(|input| {
        input.request["session"]["overallRpe"] = serde_json::Value::Null;
        input.request["session"]["notes"] = json!("Session note");
        input.request["session"]["exercises"][0]["sets"][0]["rir"] = serde_json::Value::Null;
        input.request["session"]["exercises"][0]["sets"][0]["notes"] = json!("Top set");
        input.request["session"]["exercises"][0]["slotId"] = json!("slot-bench-1");
    });

    complete_session(&input).expect("canonical complete_session request shape should be accepted");
}

#[test]
fn complete_session_rejects_invalid_datetime_strings_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["startedAt"] = json!("not-a-datetime");

    expect_invalid_input(
        complete_session(&input),
        &["request", "startedAt", "RFC3339"],
    );
}

#[test]
fn complete_session_rejects_impossible_calendar_dates_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["startedAt"] = json!("2026-02-31T10:00:00.000Z");

    expect_invalid_input(
        complete_session(&input),
        &["request", "startedAt", "RFC3339"],
    );
}

#[test]
fn complete_session_rejects_out_of_range_overall_rpe_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["overallRpe"] = json!(11);

    expect_invalid_input(
        complete_session(&input),
        &["request", "overallRpe", "1..=10"],
    );
}

#[test]
fn complete_session_rejects_empty_program_day_id_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["programDayId"] = json!("");

    expect_invalid_input(
        complete_session(&input),
        &["request", "programDayId", "non-empty"],
    );
}

#[test]
fn complete_session_rejects_empty_slot_id_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["slotId"] = json!("");

    expect_invalid_input(
        complete_session(&input),
        &["request", "slotId", "non-empty"],
    );
}

#[test]
fn complete_session_rejects_empty_exercise_id_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["exerciseId"] = json!("");

    expect_invalid_input(
        complete_session(&input),
        &["request", "exerciseId", "non-empty"],
    );
}

#[test]
fn complete_session_rejects_negative_set_index_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["sets"][0]["setIndex"] = json!(-1);

    expect_invalid_input(complete_session(&input), &["request", "setIndex", ">= 0"]);
}

#[test]
fn complete_session_rejects_negative_weight_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["sets"][0]["weight"] = json!(-10);

    expect_invalid_input(complete_session(&input), &["request", "weight", ">= 0"]);
}

#[test]
fn complete_session_rejects_negative_reps_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["sets"][0]["reps"] = json!(-1);

    expect_invalid_input(complete_session(&input), &["request", "reps", ">= 0"]);
}

#[test]
fn complete_session_rejects_out_of_range_rir_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["sets"][0]["rir"] = json!(11);

    expect_invalid_input(complete_session(&input), &["request", "rir", "0..=10"]);
}

#[test]
fn plan_session_reports_unknown_policy_fields_as_invalid_input() {
    let mut input = fixtures::plan_session_input();
    input.policy_snapshot["transportOnlyField"] = json!(true);

    expect_invalid_input(plan_session(&input), &["policy", "unknown field"]);
}

#[test]
fn plan_session_rejects_negative_seeded_tie_break_band_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.policy_snapshot["seededTieBreakBand"] = json!(-0.01);

    expect_invalid_input(
        plan_session(&input),
        &["policy", "seededTieBreakBand", ">= 0"],
    );
}

#[test]
fn plan_session_rejects_out_of_range_class_archetype_bias_through_public_api() {
    let mut input = fixtures::plan_session_input();
    input.policy_snapshot["classArchetypeBias"] = json!(0.2);

    expect_invalid_input(
        plan_session(&input),
        &["policy", "classArchetypeBias", "0..=0.15"],
    );
}

#[test]
fn complete_session_reports_unknown_state_fields_as_invalid_input() {
    let mut input = fixtures::complete_session_input();
    input.state_snapshot["transportOnlyField"] = json!(true);

    expect_invalid_input(complete_session(&input), &["state", "unknown field"]);
}

#[test]
fn plan_session_rejects_unsupported_canonicalization_version() {
    let mut input = fixtures::plan_session_input();
    input.determinism.canonicalization_version = "canon-v99".to_string();

    expect_invalid_input(
        plan_session(&input),
        &["canonicalizationVersion", "unsupported"],
    );
}

#[test]
fn plan_session_rejects_reference_hash_mismatch() {
    let mut input = fixtures::plan_session_input();
    input.determinism.reference_hash =
        "sha256:0000000000000000000000000000000000000000000000000000000000000000".to_string();

    expect_invalid_input(plan_session(&input), &["referenceHash", "mismatch"]);
}

#[test]
fn plan_session_rejects_ratio_inputs_with_excess_precision() {
    let mut input = fixtures::plan_session_input();
    input.policy_snapshot["classArchetypeBias"] = json!(0.10001);

    expect_invalid_input(
        plan_session(&input),
        &["policy", "classArchetypeBias", "ratio-4"],
    );
}

#[test]
fn complete_session_rejects_load_inputs_with_excess_precision() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["sets"][0]["weight"] = json!(100.001);

    expect_invalid_input(complete_session(&input), &["request", "weight", "kg-cent"]);
}

#[test]
fn complete_session_rejects_empty_exercises_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"] = json!([]);

    expect_invalid_input(
        complete_session(&input),
        &["request", "session.exercises", "at least one"],
    );
}

#[test]
fn complete_session_rejects_empty_sets_through_public_api() {
    let mut input = fixtures::complete_session_input();
    input.request["session"]["exercises"][0]["sets"] = json!([]);

    expect_invalid_input(
        complete_session(&input),
        &["request", "session.exercises[0].sets", "at least one"],
    );
}

#[test]
fn complete_session_accepts_missing_completed_at_through_public_api() {
    let input = fixtures::complete_session_input_with(|input| {
        input.request["session"]
            .as_object_mut()
            .expect("session request should be an object")
            .remove("completedAt");
    });

    complete_session(&input).expect("missing completedAt should fall back to effectiveAt");
}
