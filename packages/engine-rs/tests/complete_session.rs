#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::complete_session;
use serde_json::{json, Value};

fn complete_golden() -> Value {
    serde_json::from_str(include_str!("goldens/complete_session_baseline.json"))
        .expect("loading complete_session baseline golden")
}

fn assert_replay_receipt_fields(actual: &Value, expected: &Value) {
    let actual_receipt = actual["replayReceipt"]
        .as_object()
        .expect("replayReceipt should be an object");
    let expected_receipt = expected["replayReceipt"]
        .as_object()
        .expect("expected replayReceipt should be an object");

    for field in [
        "inputHash",
        "outputHash",
        "seedUsed",
        "effectiveAt",
        "implementationVersion",
        "policyVersion",
        "referenceHash",
    ] {
        assert_eq!(
            actual_receipt.get(field),
            expected_receipt.get(field),
            "unexpected replayReceipt field: {field}"
        );
    }
}

#[test]
fn complete_session_matches_the_baseline_golden() {
    let input = fixtures::complete_session_input();
    let output = complete_session(&input)
        .expect("complete_session should return a deterministic baseline output");
    let actual = serde_json::to_value(&output).expect("serializing complete_session output");
    let golden = complete_golden();

    assert_eq!(actual, golden);
    assert_replay_receipt_fields(&actual, &golden);
}

#[test]
fn complete_session_is_replay_stable_for_identical_input() {
    let input = fixtures::complete_session_input();
    let first = complete_session(&input).expect("first complete_session invocation should succeed");
    let second =
        complete_session(&input).expect("second complete_session invocation should succeed");

    let first_json =
        serde_json::to_value(&first).expect("serializing first complete_session output");
    let second_json =
        serde_json::to_value(&second).expect("serializing second complete_session output");

    assert_eq!(first_json, second_json);
}

#[test]
fn complete_session_semantic_patch_only_touches_engine_owned_buckets() {
    let input = fixtures::complete_session_input();
    let output = complete_session(&input)
        .expect("complete_session should return a deterministic baseline output");
    let actual = serde_json::to_value(&output).expect("serializing complete_session output");

    let state_patch = actual["statePatch"]
        .as_object()
        .expect("statePatch should be an object");
    let allowed_keys = ["progressionState", "readinessState", "gamificationState"];
    for key in state_patch.keys() {
        assert!(
            allowed_keys.contains(&key.as_str()),
            "unexpected state patch key: {key}"
        );
    }
}

#[test]
fn complete_session_updates_progression_xp_and_level() {
    let input = fixtures::complete_session_input_with(|input| {
        input.request["session"]["exercises"][0]["sets"][1]["reps"] = json!(6);
        input.request["session"]["overallRpe"] = json!(7);
    });

    let output =
        complete_session(&input).expect("complete_session should return a deterministic output");
    let actual = serde_json::to_value(&output).expect("serializing complete_session output");

    assert_eq!(
        actual["result"]["sessionOutcomeClassification"],
        json!("complete_clean")
    );
    assert_eq!(actual["result"]["awardedXpSummary"]["xpDelta"], json!(25));
    assert_eq!(actual["result"]["levelUpIndicator"], json!(false));
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        json!("overload")
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["consecutiveSuccessfulCompletions"],
        json!(2)
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]
            ["consecutiveStallOrRegressionCount"],
        json!(0)
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["swapRecommendationCount"],
        json!(0)
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["lastSessionOutcomeClassification"],
        json!("complete_clean")
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["lastCompletedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["lastSuccessfulLoad"],
        json!({
            "weight": 100,
            "reps": 5
        })
    );
    assert_eq!(
        actual["statePatch"]["gamificationState"]["completedSessionCount"],
        json!(13)
    );
    assert_eq!(
        actual["statePatch"]["gamificationState"]["missedSessionCount"],
        json!(0)
    );
    assert_eq!(
        actual["statePatch"]["gamificationState"]["lastAdherenceOutcomeClassification"],
        json!("complete_clean")
    );
    assert_eq!(
        actual["statePatch"]["gamificationState"]["lastAwardedAt"],
        json!("2026-02-13T11:10:00.000Z")
    );
}

#[test]
fn complete_session_triggers_regress_or_deload_behavior_on_poor_recovery() {
    let input = fixtures::complete_session_input_with(|input| {
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.state_snapshot["progressionState"]["records"][0]["trend"] = json!("regressing");
        input.request["session"]["overallRpe"] = json!(10);
    });

    let output = complete_session(&input)
        .expect("poor-recovery completion should return a deterministic output");
    let actual =
        serde_json::to_value(&output).expect("serializing poor-recovery complete_session output");

    assert_eq!(
        actual["result"]["sessionOutcomeClassification"],
        json!("partial")
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        json!("regress")
    );
    assert_eq!(
        actual["result"]["warnings"][0],
        json!("future_choices_tightened")
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]["consecutiveSuccessfulCompletions"],
        json!(0)
    );
    assert_eq!(
        actual["statePatch"]["progressionState"]["bench-press"]
            ["consecutiveStallOrRegressionCount"],
        json!(1)
    );
}

#[test]
fn complete_session_branches_overload_maintain_regress_and_swap() {
    let scenarios = [
        ("complete_clean", "maintain", "overload"),
        ("complete_compromised", "swap", "maintain"),
        ("partial", "overload", "regress"),
        ("missed", "maintain", "swap"),
    ];

    for (outcome, starting_action, expected_action) in scenarios {
        let input = fixtures::complete_session_input_with(|input| {
            input.determinism.seed = format!("branch-{outcome}");
            input.request["session"]["overallRpe"] = match outcome {
                "complete_clean" => json!(7),
                "complete_compromised" => json!(8),
                "partial" => json!(9),
                _ => json!(10),
            };
            input.state_snapshot["progressionState"]["records"][0]["currentAction"] =
                json!(starting_action);
        });

        let output = complete_session(&input)
            .expect("completion branching should return a deterministic output");
        let actual =
            serde_json::to_value(&output).expect("serializing branching complete_session output");

        assert_eq!(
            actual["result"]["sessionOutcomeClassification"],
            json!(outcome)
        );
        assert_eq!(
            actual["statePatch"]["progressionState"]["bench-press"]["currentAction"],
            json!(expected_action)
        );
    }
}

#[test]
fn complete_session_state_update_loop_feeds_next_plan() {
    let completed = complete_session(&fixtures::complete_session_input())
        .expect("complete_session should return a deterministic baseline output");
    let actual = serde_json::to_value(&completed).expect("serializing complete_session output");

    assert_eq!(
        actual["statePatch"]["gamificationState"]["adherenceStreak"],
        json!(7)
    );
    assert_eq!(
        actual["result"]["awardedXpSummary"]["reason"],
        json!("completed_recommended_session")
    );
}

#[test]
fn complete_session_changes_with_seed_and_cycle_variation() {
    let base_input = fixtures::complete_session_input();
    let seed_variant = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-variant".to_string();
    });
    let cycle_variant = fixtures::complete_session_input_with(|input| {
        input.state_snapshot["activeProgramState"]["currentMicrocycle"] = json!(4);
        input.request["session"]["overallRpe"] = json!(7);
        input.request["session"]["exercises"][0]["sets"][1]["reps"] = json!(6);
    });

    let base_output =
        complete_session(&base_input).expect("baseline complete_session should succeed");
    let seed_output =
        complete_session(&seed_variant).expect("seed-variant complete_session should succeed");
    let cycle_output =
        complete_session(&cycle_variant).expect("cycle-variant complete_session should succeed");

    let base_json =
        serde_json::to_value(base_output).expect("serializing baseline complete_session output");
    let seed_json = serde_json::to_value(seed_output)
        .expect("serializing seed-variant complete_session output");
    let cycle_json = serde_json::to_value(cycle_output)
        .expect("serializing cycle-variant complete_session output");

    assert_ne!(
        base_json["replayReceipt"]["seedUsed"],
        seed_json["replayReceipt"]["seedUsed"]
    );
    assert_ne!(
        base_json["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        cycle_json["statePatch"]["progressionState"]["bench-press"]["currentAction"]
    );
}

#[test]
fn complete_session_does_not_change_action_for_a_fixture_seed_shortcut() {
    let baseline_seed_input = fixtures::complete_session_input_with(|input| {
        input.state_snapshot["activeProgramState"]["currentMicrocycle"] = json!(3);
        input.request["session"]["overallRpe"] = json!(9);
    });
    let generic_seed_input = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-generic".to_string();
        input.state_snapshot["activeProgramState"]["currentMicrocycle"] = json!(3);
        input.request["session"]["overallRpe"] = json!(9);
    });

    let baseline_seed_output = complete_session(&baseline_seed_input)
        .expect("baseline-seed partial complete_session should succeed");
    let generic_seed_output =
        complete_session(&generic_seed_input).expect("generic-seed partial complete_session");

    let baseline_json = serde_json::to_value(baseline_seed_output)
        .expect("serializing baseline-seed complete_session output");
    let generic_json = serde_json::to_value(generic_seed_output)
        .expect("serializing generic-seed complete_session output");

    assert_eq!(
        baseline_json["result"]["sessionOutcomeClassification"],
        json!("partial")
    );
    assert_eq!(
        generic_json["result"]["sessionOutcomeClassification"],
        json!("partial")
    );
    assert_eq!(
        baseline_json["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        generic_json["statePatch"]["progressionState"]["bench-press"]["currentAction"]
    );
    assert_eq!(
        baseline_json["statePatch"]["progressionState"]["bench-press"]["currentAction"],
        json!("regress")
    );
}
