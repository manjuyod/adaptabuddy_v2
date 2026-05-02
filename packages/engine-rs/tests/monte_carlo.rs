#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::{complete_session, plan_session, EngineError, EngineInputV1, EngineOutputV1};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::panic::{self, AssertUnwindSafe};
use std::path::PathBuf;

const PLAN_VALID_RUNS: usize = 24;
const COMPLETE_VALID_RUNS: usize = 24;

const ENGINE_PATCH_KEYS: [&str; 3] = ["progressionState", "readinessState", "gamificationState"];
const COMPLETE_OUTCOME_CLASSES: [&str; 4] = [
    "complete_clean",
    "complete_compromised",
    "partial",
    "missed",
];

#[derive(Clone, Debug)]
struct Lcg {
    state: u64,
}

impl Lcg {
    fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    fn next(&mut self) -> u64 {
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1);
        self.state
    }

    fn index(&mut self, len: usize) -> usize {
        (self.next() % len as u64) as usize
    }
}

#[derive(Debug)]
enum InvocationOutcome {
    Output(EngineOutputV1),
    InvalidInput(String),
    InvalidOutput(String),
    Panic(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OutcomeObservation {
    kind: String,
    message: Option<String>,
    output: Option<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScenarioFailure {
    label: String,
    phase: String,
    detail: String,
    input: Value,
    comparison_input: Option<Value>,
    first_observation: Option<OutcomeObservation>,
    second_observation: Option<OutcomeObservation>,
}

#[test]
#[ignore = "explicit Monte Carlo lane"]
fn monte_carlo_catalog_holds_engine_invariants() {
    let mut failures = Vec::new();

    let plan_valid_cases = sampled_plan_valid_cases();
    let plan_invalid_cases = invalid_plan_cases();
    let complete_valid_cases = sampled_complete_valid_cases();
    let complete_invalid_cases = invalid_complete_cases();
    let replay_chain_cases = replay_chain_cases();

    for (label, input) in &plan_valid_cases {
        if let Some(failure) = run_plan_valid_case(label, input) {
            failures.push(failure);
        }
    }

    for (label, input) in &plan_invalid_cases {
        if let Some(failure) = run_invalid_plan_case(label, input) {
            failures.push(failure);
        }
    }

    for (label, input) in &complete_valid_cases {
        if let Some(failure) = run_complete_valid_case(label, input) {
            failures.push(failure);
        }
    }

    for (label, input) in &complete_invalid_cases {
        if let Some(failure) = run_invalid_complete_case(label, input) {
            failures.push(failure);
        }
    }

    for (label, complete_input, check_reordered_recent_completions) in &replay_chain_cases {
        if let Some(failure) = run_replay_chain_case(
            label,
            &fixtures::plan_session_baseline_input(),
            complete_input,
            *check_reordered_recent_completions,
        ) {
            failures.push(failure);
        }
    }

    if !failures.is_empty() {
        let artifact_path = write_failure_artifact(&failures)
            .expect("monte carlo failures should write a diagnostic artifact");
        panic!(
            "monte carlo found {} failure(s); see {}",
            failures.len(),
            artifact_path.display()
        );
    }

    println!(
        "monte carlo passed: {} valid plan, {} invalid plan, {} valid complete, {} invalid complete, {} replay chain",
        plan_valid_cases.len(),
        plan_invalid_cases.len(),
        complete_valid_cases.len(),
        complete_invalid_cases.len(),
        replay_chain_cases.len()
    );
}

fn sampled_plan_valid_cases() -> Vec<(String, EngineInputV1)> {
    let mut rng = Lcg::new(0xADA7A01);
    let microcycles = [0, 1, 2, 3, 5];
    let seeded_tie_break_bands = [0.0, 0.0001, 0.05, 0.5, 1.0];
    let class_biases = [0.0, 0.05, 0.1, 0.15];
    let fatigue_levels = ["mild", "moderate", "severe"];
    let chest_fatigue = [0, 20, 50, 90];
    let fatigue_thresholds = ["moderate", "severe"];
    let movement_blocks = [
        (json!([]), json!([])),
        (json!(["push"]), json!(["shoulder"])),
        (json!(["pull"]), json!(["back"])),
        (json!(["push", "pull"]), json!(["shoulder", "back"])),
    ];

    let mut cases = Vec::new();
    for index in 0..PLAN_VALID_RUNS {
        let mut input = fixtures::plan_session_input();
        input.determinism.seed = format!("mc-plan-{index:03}");
        input.request["microcycleIndex"] = json!(microcycles[rng.index(microcycles.len())]);
        input.policy_snapshot["seededTieBreakBand"] =
            json!(seeded_tie_break_bands[rng.index(seeded_tie_break_bands.len())]);
        input.policy_snapshot["classArchetypeBias"] =
            json!(class_biases[rng.index(class_biases.len())]);
        input.policy_snapshot["fatigueBlockThreshold"] =
            json!(fatigue_thresholds[rng.index(fatigue_thresholds.len())]);
        input.state_snapshot["readinessState"]["systemicFatigue"] =
            json!(fatigue_levels[rng.index(fatigue_levels.len())]);
        input.state_snapshot["readinessState"]["muscleFatigue"]["chest"] =
            json!(chest_fatigue[rng.index(chest_fatigue.len())]);

        let (blocked_patterns, active_limitations) =
            &movement_blocks[rng.index(movement_blocks.len())];
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = blocked_patterns.clone();
        input.state_snapshot["injuryState"]["activeLimitations"] = active_limitations.clone();

        if rng.next() % 2 == 0 {
            let exercises = input.reference_snapshot["exercises"]
                .as_array_mut()
                .expect("reference exercises should be an array");
            exercises.reverse();
            fixtures::refresh_reference_hash(&mut input);
        }

        input.metadata["sampleId"] = json!(format!("mc-plan-meta-{index:03}"));
        cases.push((format!("plan_valid_{index:03}"), input));
    }

    cases
}

fn invalid_plan_cases() -> Vec<(String, EngineInputV1)> {
    vec![
        (
            "plan_invalid_negative_microcycle".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.request["microcycleIndex"] = json!(-1);
            }),
        ),
        (
            "plan_invalid_string_microcycle".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.request["microcycleIndex"] = json!("three");
            }),
        ),
        (
            "plan_invalid_negative_tie_break_band".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.policy_snapshot["seededTieBreakBand"] = json!(-0.01);
            }),
        ),
        (
            "plan_invalid_high_tie_break_band".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.policy_snapshot["seededTieBreakBand"] = json!(1.01);
            }),
        ),
        (
            "plan_invalid_high_class_bias".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.policy_snapshot["classArchetypeBias"] = json!(0.2);
            }),
        ),
        (
            "plan_invalid_unknown_policy_field".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.policy_snapshot["transportOnlyField"] = json!(true);
            }),
        ),
        (
            "plan_invalid_empty_program_id".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.request["programId"] = json!("");
            }),
        ),
        (
            "plan_invalid_missing_program_id".to_string(),
            fixtures::plan_session_input_with(|input| {
                input
                    .request
                    .as_object_mut()
                    .expect("request should be an object")
                    .remove("programId");
            }),
        ),
        (
            "plan_invalid_unknown_request_field".to_string(),
            fixtures::plan_session_input_with(|input| {
                input.request["transportOnlyField"] = json!("debug");
            }),
        ),
    ]
}

fn sampled_complete_valid_cases() -> Vec<(String, EngineInputV1)> {
    let mut rng = Lcg::new(0xC0FFEE);
    let overall_rpes = [
        Value::Null,
        json!(1),
        json!(4),
        json!(7),
        json!(8),
        json!(9),
        json!(10),
    ];
    let second_set_reps = [4, 5, 6];
    let xp_values = [140, 198, 220];
    let systemic_fatigue = ["mild", "moderate", "severe"];
    let current_actions = ["maintain", "swap"];
    let trends = ["stalled", "improving"];

    let mut cases = Vec::new();
    for index in 0..COMPLETE_VALID_RUNS {
        let mode = rng.index(3);
        let mut input = match mode {
            0 => fixtures::complete_session_input(),
            1 => fixtures::complete_session_recent_completion_window_input(),
            _ => fixtures::complete_session_recent_completion_window_without_completed_at_input(),
        };

        input.determinism.seed = format!("mc-complete-{index:03}");
        input.request["session"]["overallRpe"] =
            overall_rpes[rng.index(overall_rpes.len())].clone();
        input.request["session"]["exercises"][0]["sets"][1]["reps"] =
            json!(second_set_reps[rng.index(second_set_reps.len())]);
        input.request["session"]["notes"] = json!(format!("mc-session-note-{index:03}"));
        input.request["session"]["exercises"][0]["sets"][0]["notes"] =
            json!(format!("mc-set-note-{index:03}"));
        input.state_snapshot["gamificationState"]["xp"] =
            json!(xp_values[rng.index(xp_values.len())]);
        input.state_snapshot["readinessState"]["systemicFatigue"] =
            json!(systemic_fatigue[rng.index(systemic_fatigue.len())]);
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] =
            json!(current_actions[rng.index(current_actions.len())]);
        input.state_snapshot["progressionState"]["records"][0]["trend"] =
            json!(trends[rng.index(trends.len())]);
        input.metadata["sampleId"] = json!(format!("mc-complete-meta-{index:03}"));

        cases.push((format!("complete_valid_{index:03}"), input));
    }

    cases
}

fn invalid_complete_cases() -> Vec<(String, EngineInputV1)> {
    vec![
        (
            "complete_invalid_empty_exercises".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["exercises"] = json!([]);
            }),
        ),
        (
            "complete_invalid_empty_sets".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["exercises"][0]["sets"] = json!([]);
            }),
        ),
        (
            "complete_invalid_negative_weight".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["exercises"][0]["sets"][0]["weight"] = json!(-10);
            }),
        ),
        (
            "complete_invalid_negative_reps".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["exercises"][0]["sets"][0]["reps"] = json!(-1);
            }),
        ),
        (
            "complete_invalid_rir".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["exercises"][0]["sets"][0]["rir"] = json!(11);
            }),
        ),
        (
            "complete_invalid_started_at".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["startedAt"] = json!("not-a-datetime");
            }),
        ),
        (
            "complete_invalid_completed_at".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["completedAt"] = json!("2026-02-31T10:00:00.000Z");
            }),
        ),
        (
            "complete_invalid_empty_seed".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["seed"] = json!("");
            }),
        ),
        (
            "complete_invalid_missing_program_day_id".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]
                    .as_object_mut()
                    .expect("session request should be an object")
                    .remove("programDayId");
            }),
        ),
        (
            "complete_invalid_out_of_range_overall_rpe".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["overallRpe"] = json!(0);
            }),
        ),
        (
            "complete_invalid_unknown_state_field".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.state_snapshot["transportOnlyField"] = json!(true);
            }),
        ),
        (
            "complete_invalid_unknown_request_field".to_string(),
            fixtures::complete_session_input_with(|input| {
                input.request["session"]["transportOnlyField"] = json!("debug");
            }),
        ),
    ]
}

fn replay_chain_cases() -> Vec<(String, EngineInputV1, bool)> {
    vec![
        (
            "replay_chain_baseline".to_string(),
            fixtures::complete_session_baseline_input(),
            false,
        ),
        (
            "replay_chain_partial".to_string(),
            fixtures::complete_session_partial_input(),
            false,
        ),
        (
            "replay_chain_missed".to_string(),
            fixtures::complete_session_missed_input(),
            false,
        ),
        (
            "replay_chain_recent_completion_window".to_string(),
            fixtures::complete_session_recent_completion_window_input(),
            true,
        ),
        (
            "replay_chain_missing_completed_at".to_string(),
            fixtures::complete_session_recent_completion_window_without_completed_at_input(),
            true,
        ),
    ]
}

fn run_plan_valid_case(label: &str, input: &EngineInputV1) -> Option<ScenarioFailure> {
    let first = invoke_engine_call(|| plan_session(input));
    let second = invoke_engine_call(|| plan_session(input));

    let first_output = match &first {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "plan_valid",
                "valid plan input did not return a public output",
                input,
                None,
                Some(&first),
                Some(&second),
            ))
        }
    };
    let second_output = match &second {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "plan_valid",
                "repeated plan invocation did not return a public output",
                input,
                None,
                Some(&first),
                Some(&second),
            ))
        }
    };

    let first_json = output_json(first_output);
    let second_json = output_json(second_output);
    if first_json != second_json {
        return Some(failure_with_outcomes(
            label,
            "plan_valid",
            "plan output changed across identical repeated runs",
            input,
            None,
            Some(&first),
            Some(&second),
        ));
    }

    if let Err(detail) = assert_sha256_replay_receipt(&first_json) {
        return Some(failure_with_outputs(
            label,
            "plan_valid",
            &detail,
            input,
            None,
            &first_json,
            &second_json,
        ));
    }
    if let Err(detail) = assert_patch_keys(&first_json, &ENGINE_PATCH_KEYS) {
        return Some(failure_with_outputs(
            label,
            "plan_valid",
            &detail,
            input,
            None,
            &first_json,
            &second_json,
        ));
    }

    if first_json["result"]["status"] == json!("deterministic_rejection") {
        if !first_json["result"]["rejectionCode"].is_string() {
            return Some(failure_with_outputs(
                label,
                "plan_valid",
                "deterministic rejection output omitted rejectionCode",
                input,
                None,
                &first_json,
                &second_json,
            ));
        }
        return None;
    }

    if let Err(detail) = assert_reference_backed_selected_ids(input, &first_json) {
        return Some(failure_with_outputs(
            label,
            "plan_valid",
            &detail,
            input,
            None,
            &first_json,
            &second_json,
        ));
    }

    None
}

fn run_invalid_plan_case(label: &str, input: &EngineInputV1) -> Option<ScenarioFailure> {
    let outcome = invoke_engine_call(|| plan_session(input));
    match outcome {
        InvocationOutcome::InvalidInput(_) => None,
        _ => Some(failure_with_outcomes(
            label,
            "plan_invalid",
            "invalid plan input should return InvalidInput without panicking",
            input,
            None,
            Some(&outcome),
            None,
        )),
    }
}

fn run_complete_valid_case(label: &str, input: &EngineInputV1) -> Option<ScenarioFailure> {
    let first = invoke_engine_call(|| complete_session(input));
    let second = invoke_engine_call(|| complete_session(input));

    let first_output = match &first {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "complete_valid",
                "valid complete input did not return a public output",
                input,
                None,
                Some(&first),
                Some(&second),
            ))
        }
    };
    let second_output = match &second {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "complete_valid",
                "repeated complete invocation did not return a public output",
                input,
                None,
                Some(&first),
                Some(&second),
            ))
        }
    };

    let first_json = output_json(first_output);
    let second_json = output_json(second_output);
    if first_json != second_json {
        return Some(failure_with_outcomes(
            label,
            "complete_valid",
            "complete output changed across identical repeated runs",
            input,
            None,
            Some(&first),
            Some(&second),
        ));
    }

    if let Err(detail) = assert_sha256_replay_receipt(&first_json) {
        return Some(failure_with_outputs(
            label,
            "complete_valid",
            &detail,
            input,
            None,
            &first_json,
            &second_json,
        ));
    }
    if let Err(detail) = assert_patch_keys(&first_json, &ENGINE_PATCH_KEYS) {
        return Some(failure_with_outputs(
            label,
            "complete_valid",
            &detail,
            input,
            None,
            &first_json,
            &second_json,
        ));
    }

    let classification = first_json["result"]["sessionOutcomeClassification"]
        .as_str()
        .unwrap_or_default();
    if !COMPLETE_OUTCOME_CLASSES.contains(&classification) {
        return Some(failure_with_outputs(
            label,
            "complete_valid",
            "complete output classification was missing or outside the accepted outcome classes",
            input,
            None,
            &first_json,
            &second_json,
        ));
    }

    None
}

fn run_invalid_complete_case(label: &str, input: &EngineInputV1) -> Option<ScenarioFailure> {
    let outcome = invoke_engine_call(|| complete_session(input));
    match outcome {
        InvocationOutcome::InvalidInput(_) => None,
        _ => Some(failure_with_outcomes(
            label,
            "complete_invalid",
            "invalid complete input should return InvalidInput without panicking",
            input,
            None,
            Some(&outcome),
            None,
        )),
    }
}

fn run_replay_chain_case(
    label: &str,
    baseline_plan_input: &EngineInputV1,
    complete_input: &EngineInputV1,
    check_reordered_recent_completions: bool,
) -> Option<ScenarioFailure> {
    let completion_outcome = invoke_engine_call(|| complete_session(complete_input));
    let complete_output = match &completion_outcome {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "replay_chain",
                "valid complete input did not produce a completion patch",
                complete_input,
                None,
                Some(&completion_outcome),
                None,
            ))
        }
    };

    let next_plan_input = fixtures::next_plan_input_from_completion(
        baseline_plan_input,
        complete_input,
        complete_output,
    );

    let first_next_outcome = invoke_engine_call(|| plan_session(&next_plan_input));
    let second_next_outcome = invoke_engine_call(|| plan_session(&next_plan_input));
    let metadata_variant = fixtures::next_plan_metadata_variant_input(&next_plan_input);
    let metadata_outcome = invoke_engine_call(|| plan_session(&metadata_variant));

    let first_next_output = match &first_next_outcome {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "replay_chain",
                "next plan did not produce a public output",
                complete_input,
                Some(&next_plan_input),
                Some(&first_next_outcome),
                Some(&second_next_outcome),
            ))
        }
    };
    let second_next_output = match &second_next_outcome {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "replay_chain",
                "repeated next plan did not produce a public output",
                complete_input,
                Some(&next_plan_input),
                Some(&first_next_outcome),
                Some(&second_next_outcome),
            ))
        }
    };
    let metadata_output = match &metadata_outcome {
        InvocationOutcome::Output(output) => output,
        _ => {
            return Some(failure_with_outcomes(
                label,
                "replay_chain",
                "metadata-only next plan variant did not produce a public output",
                complete_input,
                Some(&metadata_variant),
                Some(&metadata_outcome),
                None,
            ))
        }
    };

    let first_next_json = output_json(first_next_output);
    let second_next_json = output_json(second_next_output);
    let metadata_json = output_json(metadata_output);

    if first_next_json != second_next_json {
        return Some(failure_with_outputs(
            label,
            "replay_chain",
            "next plan output changed across identical repeated runs",
            complete_input,
            Some(&next_plan_input),
            &first_next_json,
            &second_next_json,
        ));
    }
    if first_next_json != metadata_json {
        return Some(failure_with_outputs(
            label,
            "replay_chain",
            "metadata-only next plan variant changed replay-relevant behavior",
            complete_input,
            Some(&metadata_variant),
            &first_next_json,
            &metadata_json,
        ));
    }
    if let Err(detail) = assert_sha256_replay_receipt(&first_next_json) {
        return Some(failure_with_outputs(
            label,
            "replay_chain",
            &detail,
            complete_input,
            Some(&next_plan_input),
            &first_next_json,
            &second_next_json,
        ));
    }

    if check_reordered_recent_completions {
        let reordered = fixtures::next_plan_reordered_recent_completions_input(&next_plan_input);
        let reordered_outcome = invoke_engine_call(|| plan_session(&reordered));
        let reordered_output = match &reordered_outcome {
            InvocationOutcome::Output(output) => output,
            _ => {
                return Some(failure_with_outcomes(
                    label,
                    "replay_chain",
                    "reordered recent completions variant did not produce a public output",
                    complete_input,
                    Some(&reordered),
                    Some(&reordered_outcome),
                    None,
                ))
            }
        };
        let reordered_json = output_json(reordered_output);
        if first_next_json != reordered_json {
            return Some(failure_with_outputs(
                label,
                "replay_chain",
                "canonically equivalent recent completion ordering changed next plan output",
                complete_input,
                Some(&reordered),
                &first_next_json,
                &reordered_json,
            ));
        }
    }

    None
}

fn invoke_engine_call<F>(invoke: F) -> InvocationOutcome
where
    F: FnOnce() -> Result<EngineOutputV1, EngineError>,
{
    match panic::catch_unwind(AssertUnwindSafe(invoke)) {
        Ok(Ok(output)) => InvocationOutcome::Output(output),
        Ok(Err(EngineError::InvalidInput { message })) => InvocationOutcome::InvalidInput(message),
        Ok(Err(EngineError::InvalidOutput { message })) => {
            InvocationOutcome::InvalidOutput(message)
        }
        Err(panic) => InvocationOutcome::Panic(panic_message(panic)),
    }
}

fn panic_message(panic: Box<dyn std::any::Any + Send>) -> String {
    if let Some(message) = panic.downcast_ref::<String>() {
        message.clone()
    } else if let Some(message) = panic.downcast_ref::<&str>() {
        message.to_string()
    } else {
        "non-string panic payload".to_string()
    }
}

fn output_json<T: Serialize>(value: &T) -> Value {
    serde_json::to_value(value).expect("serializing diagnostic value")
}

fn assert_sha256_replay_receipt(output: &Value) -> Result<(), String> {
    for field in ["inputHash", "outputHash"] {
        let Some(hash) = output["replayReceipt"][field].as_str() else {
            return Err(format!(
                "replay receipt field {field} was missing or non-string"
            ));
        };

        let Some(hex) = hash.strip_prefix("sha256:") else {
            return Err(format!(
                "replay receipt field {field} did not use sha256: prefix"
            ));
        };

        if hex.len() != 64
            || !hex
                .chars()
                .all(|ch| ch.is_ascii_hexdigit() && !ch.is_ascii_uppercase())
        {
            return Err(format!(
                "replay receipt field {field} was not a lowercase 64-byte hex digest"
            ));
        }
    }

    Ok(())
}

fn assert_patch_keys(output: &Value, allowed_keys: &[&str]) -> Result<(), String> {
    let Some(state_patch) = output["statePatch"].as_object() else {
        return Err("statePatch was not an object".to_string());
    };

    for key in state_patch.keys() {
        if !allowed_keys.contains(&key.as_str()) {
            return Err(format!("statePatch contained unexpected key {key}"));
        }
    }

    Ok(())
}

fn assert_reference_backed_selected_ids(
    input: &EngineInputV1,
    output: &Value,
) -> Result<(), String> {
    let Some(selected_ids) = output["result"]["selectedExerciseIds"].as_array() else {
        return Err("successful plan output omitted selectedExerciseIds".to_string());
    };

    let selected_ids = selected_ids
        .iter()
        .map(|value| {
            value
                .as_str()
                .ok_or_else(|| "selectedExerciseIds contained a non-string value".to_string())
        })
        .collect::<Result<Vec<_>, _>>()?;
    let unique_ids = selected_ids.iter().copied().collect::<BTreeSet<_>>();
    if unique_ids.len() != selected_ids.len() {
        return Err("selectedExerciseIds contained duplicates".to_string());
    }

    let reference_ids = fixtures::reference_exercise_ids(input)
        .into_iter()
        .collect::<BTreeSet<_>>();
    if selected_ids
        .iter()
        .any(|selected_id| !reference_ids.contains(*selected_id))
    {
        return Err(
            "selectedExerciseIds contained a value outside the reference snapshot".to_string(),
        );
    }

    Ok(())
}

fn failure_with_outputs(
    label: &str,
    phase: &str,
    detail: &str,
    input: &EngineInputV1,
    comparison_input: Option<&EngineInputV1>,
    first_output: &Value,
    second_output: &Value,
) -> ScenarioFailure {
    ScenarioFailure {
        label: label.to_string(),
        phase: phase.to_string(),
        detail: detail.to_string(),
        input: output_json(input),
        comparison_input: comparison_input.map(output_json),
        first_observation: Some(OutcomeObservation {
            kind: "output".to_string(),
            message: None,
            output: Some(first_output.clone()),
        }),
        second_observation: Some(OutcomeObservation {
            kind: "output".to_string(),
            message: None,
            output: Some(second_output.clone()),
        }),
    }
}

fn failure_with_outcomes(
    label: &str,
    phase: &str,
    detail: &str,
    input: &EngineInputV1,
    comparison_input: Option<&EngineInputV1>,
    first_outcome: Option<&InvocationOutcome>,
    second_outcome: Option<&InvocationOutcome>,
) -> ScenarioFailure {
    ScenarioFailure {
        label: label.to_string(),
        phase: phase.to_string(),
        detail: detail.to_string(),
        input: output_json(input),
        comparison_input: comparison_input.map(output_json),
        first_observation: first_outcome.map(observe_outcome),
        second_observation: second_outcome.map(observe_outcome),
    }
}

fn observe_outcome(outcome: &InvocationOutcome) -> OutcomeObservation {
    match outcome {
        InvocationOutcome::Output(output) => OutcomeObservation {
            kind: "output".to_string(),
            message: None,
            output: Some(output_json(output)),
        },
        InvocationOutcome::InvalidInput(message) => OutcomeObservation {
            kind: "invalid_input".to_string(),
            message: Some(message.clone()),
            output: None,
        },
        InvocationOutcome::InvalidOutput(message) => OutcomeObservation {
            kind: "invalid_output".to_string(),
            message: Some(message.clone()),
            output: None,
        },
        InvocationOutcome::Panic(message) => OutcomeObservation {
            kind: "panic".to_string(),
            message: Some(message.clone()),
            output: None,
        },
    }
}

fn write_failure_artifact(failures: &[ScenarioFailure]) -> Result<PathBuf, std::io::Error> {
    let artifact_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("tmp")
        .join("engine-monte-carlo");
    fs::create_dir_all(&artifact_dir)?;

    let artifact_path = artifact_dir.join("latest-failures.json");
    let artifact_body =
        serde_json::to_string_pretty(failures).expect("serializing monte carlo failure artifact");
    fs::write(&artifact_path, artifact_body)?;

    Ok(artifact_path)
}
