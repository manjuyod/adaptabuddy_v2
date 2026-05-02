#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::plan_session;
use serde_json::{json, Value};
use std::collections::BTreeSet;

fn output_json<T: serde::Serialize>(value: &T) -> Value {
    serde_json::to_value(value).expect("serializing engine output")
}

fn decision_step_types(output: &Value) -> Vec<String> {
    output["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .map(|entry| {
            entry["stepType"]
                .as_str()
                .expect("stepType should be a string")
                .to_string()
        })
        .collect()
}

#[test]
fn plan_session_selected_ids_are_unique_and_reference_backed() {
    let input = fixtures::plan_session_baseline_input();
    let output = output_json(&plan_session(&input).expect("baseline plan_session should succeed"));

    let selected = output["result"]["selectedExerciseIds"]
        .as_array()
        .expect("selectedExerciseIds should be an array")
        .iter()
        .map(|value| {
            value
                .as_str()
                .expect("selected exercise ID should be a string")
        })
        .collect::<Vec<_>>();
    let unique = selected.iter().copied().collect::<BTreeSet<_>>();
    let reference_ids = fixtures::reference_exercise_ids(&input)
        .into_iter()
        .collect::<BTreeSet<_>>();

    assert_eq!(
        unique.len(),
        selected.len(),
        "selected exercise IDs must be unique"
    );
    assert!(
        selected.iter().all(|id| reference_ids.contains(*id)),
        "selected exercise IDs must come from the reference snapshot"
    );
}

#[test]
fn plan_session_named_no_solution_fixture_returns_deterministic_rejection() {
    let input = fixtures::plan_session_no_solution_input();
    let output = output_json(
        &plan_session(&input).expect("no-solution plan_session should return a rejection envelope"),
    );

    assert_eq!(
        output["result"]["status"],
        Value::String("deterministic_rejection".to_string())
    );
    assert_eq!(
        output["result"]["rejectionCode"],
        Value::String("injury_blocked".to_string())
    );
}

#[test]
fn plan_session_named_injury_blocked_fixture_widens_to_cross_family_survivors() {
    let input = fixtures::plan_session_injury_blocked_input();
    let output = output_json(
        &plan_session(&input).expect("injury-blocked plan_session should succeed after widening"),
    );

    assert_eq!(
        output["result"]["selectedExerciseIds"][0],
        json!("barbell-row")
    );
    assert_eq!(
        output["result"]["recommendedMovementFamily"],
        json!("upper_pull")
    );
}

#[test]
fn plan_session_universally_injury_blocked_permitted_scope_collapses_to_injury_blocked() {
    let input = fixtures::plan_session_input_with(|input| {
        input.reference_snapshot["exercises"] = json!([
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
            }
        ]);
        fixtures::refresh_reference_hash(input);
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push"]);
        input.state_snapshot["injuryState"]["activeLimitations"] = json!(["shoulder"]);
    });
    let output = output_json(
        &plan_session(&input)
            .expect("universally blocked plan_session should reject after widening"),
    );

    assert_eq!(output["result"]["status"], json!("deterministic_rejection"));
    assert_eq!(output["result"]["rejectionCode"], json!("injury_blocked"));
    assert_eq!(
        output["result"]["blockedCandidateIds"],
        json!(["bench-press", "incline-dumbbell-press"])
    );
}

#[test]
fn plan_session_decision_log_step_order_is_stable() {
    let input = fixtures::plan_session_baseline_input();
    let output = output_json(&plan_session(&input).expect("baseline plan_session should succeed"));

    assert_eq!(
        decision_step_types(&output),
        [
            "scope",
            "filter",
            "score",
            "score",
            "tie_break",
            "final_selection"
        ]
    );
}

#[test]
fn plan_session_irrelevant_metadata_changes_do_not_change_output() {
    let baseline = fixtures::plan_session_baseline_input();
    let metadata_variant = fixtures::plan_session_metadata_variant_input();

    let baseline_output =
        output_json(&plan_session(&baseline).expect("baseline plan_session should succeed"));
    let metadata_output = output_json(
        &plan_session(&metadata_variant).expect("metadata variant plan_session should succeed"),
    );

    assert_eq!(baseline_output, metadata_output);
}

#[test]
fn plan_session_reference_order_is_reflected_in_scope_and_filter_logs() {
    let reordered = fixtures::plan_session_reordered_reference_input();
    let reordered_reference_ids = fixtures::reference_exercise_ids(&reordered);

    let reordered_output =
        output_json(&plan_session(&reordered).expect("reordered plan_session should succeed"));

    assert_eq!(
        reordered_output["decisionLog"][0]["details"]["enumeratedCandidateIds"],
        json!(reordered_reference_ids)
    );
    assert_eq!(
        reordered_output["decisionLog"][1]["details"]["evaluatedCandidateIds"],
        json!(["barbell-row", "incline-dumbbell-press", "bench-press"])
    );
    assert_eq!(
        reordered_output["decisionLog"][1]["details"]["survivingCandidateIds"],
        json!(["incline-dumbbell-press", "bench-press"])
    );
}

#[test]
fn plan_session_named_severe_fatigue_fixture_still_routes_to_pull() {
    let input = fixtures::plan_session_severe_fatigue_input();
    let output =
        output_json(&plan_session(&input).expect("severe-fatigue plan_session should succeed"));

    assert_eq!(output["result"]["recommendedMovementFamily"], "upper_pull");
    assert_eq!(
        output["result"]["progressionActionSummary"][0]["action"],
        "regress"
    );
}

#[test]
fn plan_session_competing_blocker_families_collapse_to_injury_blocked() {
    let input = fixtures::plan_session_competing_blockers_input();
    let output =
        output_json(&plan_session(&input).expect("competing-blocker plan_session should reject"));

    assert_eq!(output["result"]["status"], json!("deterministic_rejection"));
    assert_eq!(output["result"]["rejectionCode"], json!("injury_blocked"));
    assert_eq!(
        output["result"]["blockedCandidateIds"],
        json!(["barbell-row", "bench-press", "incline-dumbbell-press"])
    );
}

#[test]
fn plan_session_filter_log_records_candidate_level_rejections_for_rejection_fixture() {
    let input = fixtures::plan_session_injury_blocked_input();
    let output =
        output_json(&plan_session(&input).expect("injury-blocked plan_session should reject"));

    let filter_entry = output["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");

    let blocked = filter_entry["details"]["blocked"]
        .as_array()
        .expect("filter details.blocked should be an array");
    assert!(
        blocked
            .iter()
            .any(|entry| entry["candidateId"] == json!("bench-press")),
        "filter details should retain candidate-level rejection records"
    );
}

#[test]
fn plan_session_filter_log_records_widening_transition_when_cross_family_fallback_occurs() {
    let input = fixtures::plan_session_widening_required_input();
    let output =
        output_json(&plan_session(&input).expect("widening-required plan_session should succeed"));

    let scope_entry = output["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("scope"))
        .expect("scope entry should exist");

    assert_eq!(scope_entry["details"]["wideningApplied"], json!(true));
    assert_eq!(
        scope_entry["details"]["enumeratedCandidateIds"],
        json!(["bench-press", "incline-dumbbell-press", "barbell-row"])
    );
    assert_eq!(
        scope_entry["details"]["survivingScopeBucket"],
        json!("pull")
    );
}

#[test]
fn plan_session_filter_log_preserves_multiple_block_reasons_for_a_candidate() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push"]);
        input.state_snapshot["injuryState"]["activeLimitations"] = json!(["shoulder"]);
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.policy_snapshot["fatigueBlockThreshold"] = json!("moderate");
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] = json!("swap");
    });
    let output =
        output_json(&plan_session(&input).expect("multi-block plan_session should reject"));

    let filter_entry = output["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");

    let bench_reasons = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array")
        .iter()
        .filter(|entry| entry["candidateId"] == json!("bench-press"))
        .map(|entry| entry["category"].as_str().unwrap_or_default().to_string())
        .collect::<Vec<_>>();

    assert!(bench_reasons.contains(&"fatigue_safety".to_string()));
    assert!(bench_reasons.contains(&"injury_safety".to_string()));
    assert!(bench_reasons.contains(&"explicit_disqualifier".to_string()));
    assert!(bench_reasons.len() >= 3);
}

#[test]
fn plan_session_tie_break_omits_selected_index_when_band_has_one_candidate() {
    let input = fixtures::plan_session_input_with(|input| {
        input.policy_snapshot["seededTieBreakBand"] = json!(0);
    });
    let output =
        output_json(&plan_session(&input).expect("single-band plan_session should succeed"));

    let tie_break_entry = output["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("tie_break"))
        .expect("tie_break entry should exist");

    assert_eq!(tie_break_entry["outcome"], json!("not_needed"));
    assert!(tie_break_entry["details"].get("selectedIndex").is_none());
}
