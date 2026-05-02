#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::complete_session;
use serde_json::{json, Value};

fn typed_input_from_public(
    input: &engine_rs::EngineInputV1,
) -> engine_rs::boundary::TypedEngineInput {
    engine_rs::boundary::TypedEngineInput::from_public(input)
        .expect("typed input should parse from public envelope")
}

fn typed_input_from_public_unchecked(
    input: &engine_rs::EngineInputV1,
) -> engine_rs::boundary::TypedEngineInput {
    engine_rs::boundary::TypedEngineInput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        determinism: input.determinism.clone(),
        reference_snapshot: engine_rs::boundary::parse_reference_snapshot(
            &input.reference_snapshot,
        )
        .expect("reference snapshot should parse"),
        state_snapshot: engine_rs::boundary::parse_state_snapshot(&input.state_snapshot)
            .expect("state snapshot should parse"),
        policy_snapshot: engine_rs::boundary::parse_policy_snapshot(&input.policy_snapshot)
            .expect("policy snapshot should parse"),
        initialize_cycle_class_choice: None,
        request: input.request.clone(),
        metadata: input.metadata.clone(),
    }
}

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
fn complete_session_decision_log_step_order_is_stable() {
    let input = fixtures::complete_session_baseline_input();
    let output =
        output_json(&complete_session(&input).expect("baseline complete_session should succeed"));

    assert_eq!(
        decision_step_types(&output),
        ["classify", "state_update", "award_xp"]
    );
}

#[test]
fn complete_session_irrelevant_metadata_changes_do_not_change_output() {
    let baseline = fixtures::complete_session_baseline_input();
    let metadata_variant = fixtures::complete_session_metadata_variant_input();

    let baseline_output = output_json(
        &complete_session(&baseline).expect("baseline complete_session should succeed"),
    );
    let metadata_output = output_json(
        &complete_session(&metadata_variant)
            .expect("metadata variant complete_session should succeed"),
    );

    assert_eq!(baseline_output, metadata_output);
}

#[test]
fn complete_session_named_compromised_fixture_maintains_action_and_warns() {
    let input = fixtures::complete_session_compromised_input();
    let output = output_json(
        &complete_session(&input).expect("compromised complete_session should succeed"),
    );

    assert_eq!(
        output["result"]["sessionOutcomeClassification"],
        json!("complete_compromised")
    );
    assert_eq!(
        output["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        json!("maintain")
    );
    assert_eq!(
        output["result"]["warnings"],
        json!(["future_choices_tightened"])
    );
}

#[test]
fn complete_session_named_partial_fixture_regresses_and_warns() {
    let input = fixtures::complete_session_partial_input();
    let output =
        output_json(&complete_session(&input).expect("partial complete_session should succeed"));

    assert_eq!(
        output["result"]["sessionOutcomeClassification"],
        json!("partial")
    );
    assert_eq!(
        output["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        json!("regress")
    );
    assert_eq!(
        output["result"]["warnings"],
        json!(["future_choices_tightened"])
    );
}

#[test]
fn complete_session_named_missed_fixture_swaps_resets_streak_and_tracks_counters() {
    let input = fixtures::complete_session_missed_input();
    let output =
        output_json(&complete_session(&input).expect("missed complete_session should succeed"));

    assert_eq!(
        output["result"]["sessionOutcomeClassification"],
        json!("missed")
    );
    assert_eq!(
        output["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        json!("swap")
    );
    assert_eq!(
        output["result"]["awardedXpSummary"]["streakDelta"],
        json!(0)
    );
    assert_eq!(
        output["statePatch"]["gamificationState"]["adherenceStreak"],
        json!(0)
    );
    assert_eq!(
        output["statePatch"]["gamificationState"]["missedSessionCount"],
        json!(1)
    );
    assert_eq!(
        output["statePatch"]["gamificationState"]["lastAdherenceOutcomeClassification"],
        json!("missed")
    );
    assert_eq!(
        output["statePatch"]["gamificationState"]["lastAwardedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
    assert_eq!(
        output["statePatch"]["progressionState"]["bench-press"]["swapRecommendationCount"],
        json!(1)
    );
    assert_eq!(
        output["statePatch"]["progressionState"]["bench-press"]["lastSessionOutcomeClassification"],
        json!("missed")
    );
    assert_eq!(
        output["statePatch"]["progressionState"]["bench-press"]["lastCompletedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
}

#[test]
fn complete_session_public_level_up_threshold_sets_indicator_and_patch_level() {
    let input = fixtures::complete_session_level_up_threshold_input();
    let output =
        output_json(&complete_session(&input).expect("level-up threshold complete_session"));

    assert_eq!(output["result"]["levelUpIndicator"], json!(true));
    assert_eq!(output["result"]["awardedXpSummary"]["xpDelta"], json!(25));
    assert_eq!(output["statePatch"]["gamificationState"]["xp"], json!(223));
    assert_eq!(output["statePatch"]["gamificationState"]["level"], json!(4));
}

#[test]
fn complete_session_state_update_traces_recent_completion_window_in_canonical_order() {
    let input = fixtures::complete_session_recent_completion_window_input();
    let output =
        output_json(&complete_session(&input).expect("recent-completions window complete_session"));

    assert_eq!(output["statePatch"]["recentCompletions"], Value::Null);

    assert_eq!(
        output["decisionLog"][1]["details"]["recentCompletionUpdate"]["retainedCompletions"],
        json!([
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
                "completedAt": "2026-02-12T10:00:00.000Z",
                "quality": "complete_clean"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-13T11:10:00.000Z",
                "quality": "complete_compromised"
            }
        ])
    );
}

#[test]
fn complete_session_uses_effective_at_when_completed_at_is_absent() {
    let base_input =
        fixtures::complete_session_recent_completion_window_without_completed_at_input();
    let variant_input =
        fixtures::complete_session_recent_completion_window_without_completed_at_input_with(
            |input| {
                input.determinism.effective_at = "2026-02-14T10:00:00.000Z".to_string();
            },
        );

    let base_typed = typed_input_from_public(&base_input);
    let variant_typed = typed_input_from_public(&variant_input);

    let base_output = output_json(
        &engine_rs::adaptation::complete_session::complete_session(&base_typed)
            .to_public()
            .expect("baseline complete_session should serialize"),
    );
    let variant_output = output_json(
        &engine_rs::adaptation::complete_session::complete_session(&variant_typed)
            .to_public()
            .expect("variant complete_session should serialize"),
    );

    assert_ne!(
        base_output["replayReceipt"]["inputHash"],
        variant_output["replayReceipt"]["inputHash"]
    );
    assert_ne!(
        base_output["replayReceipt"]["outputHash"],
        variant_output["replayReceipt"]["outputHash"]
    );
    assert_eq!(base_output["statePatch"]["recentCompletions"], Value::Null);
    assert_eq!(
        variant_output["statePatch"]["recentCompletions"],
        Value::Null
    );

    let base_retained = base_output["decisionLog"][1]["details"]["recentCompletionUpdate"]
        ["retainedCompletions"]
        .as_array()
        .expect("retained completions should be an array");
    let variant_retained = variant_output["decisionLog"][1]["details"]["recentCompletionUpdate"]
        ["retainedCompletions"]
        .as_array()
        .expect("retained completions should be an array");

    assert!(base_retained.iter().any(|entry| {
        entry["exerciseId"] == json!("bench-press")
            && entry["completedAt"] == json!("2026-02-13T10:00:00.000Z")
    }));
    assert!(variant_retained.iter().any(|entry| {
        entry["exerciseId"] == json!("bench-press")
            && entry["completedAt"] == json!("2026-02-14T10:00:00.000Z")
    }));

    assert_eq!(
        base_output["statePatch"]["gamificationState"]["lastAwardedAt"],
        json!("2026-02-13T10:00:00.000Z")
    );
    assert_eq!(
        variant_output["statePatch"]["gamificationState"]["lastAwardedAt"],
        json!("2026-02-14T10:00:00.000Z")
    );
    assert_eq!(
        base_output["statePatch"]["progressionState"]["bench-press"]["lastCompletedAt"],
        json!("2026-02-13T10:00:00.000Z")
    );
    assert_eq!(
        variant_output["statePatch"]["progressionState"]["bench-press"]["lastCompletedAt"],
        json!("2026-02-14T10:00:00.000Z")
    );
}

#[test]
fn complete_session_internal_malformed_input_panics_instead_of_defaulting_to_bench_press() {
    let input = fixtures::complete_session_input_with(|input| {
        input.request["session"]["exercises"] = json!([]);
        input.state_snapshot["progressionState"]["records"] = json!([]);
    });
    let typed = typed_input_from_public_unchecked(&input);

    let result = std::panic::catch_unwind(|| {
        engine_rs::adaptation::complete_session::complete_session(&typed)
    });

    let panic = result.expect_err("malformed typed input should panic explicitly");
    let message = if let Some(message) = panic.downcast_ref::<String>() {
        message.clone()
    } else if let Some(message) = panic.downcast_ref::<&str>() {
        message.to_string()
    } else {
        String::new()
    };

    assert!(message.contains("complete_session requires a primary exercise"));
}
