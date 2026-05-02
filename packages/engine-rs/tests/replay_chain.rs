#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::{complete_session, plan_session};
use serde_json::{json, Value};

fn output_json<T: serde::Serialize>(value: &T) -> Value {
    serde_json::to_value(value).expect("serializing engine output")
}

#[test]
fn completion_patch_feeds_the_next_plan_deterministically() {
    let baseline_plan = fixtures::plan_session_baseline_input();
    let complete_input = fixtures::complete_session_baseline_input();

    let complete_output =
        complete_session(&complete_input).expect("baseline complete_session should succeed");
    let next_plan_input = fixtures::next_plan_input_from_completion(
        &baseline_plan,
        &complete_input,
        &complete_output,
    );

    let first = output_json(&plan_session(&next_plan_input).expect("first next plan should pass"));
    let second =
        output_json(&plan_session(&next_plan_input).expect("second next plan should pass"));

    assert_eq!(first, second);
    assert_eq!(
        first["result"]["selectedExerciseIds"][0],
        json!("bench-press")
    );
}

#[test]
fn next_plan_hashes_only_change_for_material_deterministic_input_changes() {
    let baseline_plan = fixtures::plan_session_baseline_input();
    let complete_input = fixtures::complete_session_baseline_input();
    let complete_output =
        complete_session(&complete_input).expect("baseline complete_session should succeed");

    let next_plan_input = fixtures::next_plan_input_from_completion(
        &baseline_plan,
        &complete_input,
        &complete_output,
    );
    let metadata_variant = fixtures::next_plan_metadata_variant_input(&next_plan_input);
    let seed_variant = fixtures::next_plan_seed_variant_input(&next_plan_input);

    let baseline_output =
        output_json(&plan_session(&next_plan_input).expect("baseline next plan should pass"));
    let metadata_output =
        output_json(&plan_session(&metadata_variant).expect("metadata variant should pass"));
    let seed_output = output_json(&plan_session(&seed_variant).expect("seed variant should pass"));

    assert_eq!(baseline_output, metadata_output);
    assert_ne!(
        baseline_output["replayReceipt"]["inputHash"],
        seed_output["replayReceipt"]["inputHash"]
    );
}

#[test]
fn next_plan_state_is_built_from_the_completion_input_snapshot() {
    let baseline_plan = fixtures::plan_session_baseline_input();
    let complete_input = fixtures::complete_session_input_with(|input| {
        input.state_snapshot["readinessState"]["muscleFatigue"]["legs"] = json!(99);
    });
    let complete_output =
        complete_session(&complete_input).expect("baseline complete_session should succeed");

    let next_plan_input = fixtures::next_plan_input_from_completion(
        &baseline_plan,
        &complete_input,
        &complete_output,
    );

    assert_eq!(
        next_plan_input.state_snapshot["readinessState"]["muscleFatigue"]["legs"],
        json!(99)
    );
}

#[test]
fn next_plan_is_stable_for_canonically_equivalent_recent_completion_ordering() {
    let baseline_plan = fixtures::plan_session_baseline_input();
    let complete_input = fixtures::complete_session_recent_completion_window_input();
    let complete_output =
        complete_session(&complete_input).expect("recent-completions complete_session");

    let next_plan_input = fixtures::next_plan_input_from_completion(
        &baseline_plan,
        &complete_input,
        &complete_output,
    );
    let reordered = fixtures::next_plan_reordered_recent_completions_input(&next_plan_input);

    let baseline_output =
        output_json(&plan_session(&next_plan_input).expect("baseline next plan should pass"));
    let reordered_output =
        output_json(&plan_session(&reordered).expect("reordered next plan should pass"));

    assert_eq!(baseline_output, reordered_output);
}
