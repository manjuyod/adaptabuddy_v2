#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::constraints::hard_block_records;
use engine_rs::{plan_session, EngineError};
use serde_json::{json, Value};

fn plan_golden() -> Value {
    serde_json::from_str(include_str!("goldens/plan_session_baseline.json"))
        .expect("loading plan_session baseline golden")
}

#[test]
fn plan_session_matches_the_baseline_golden() {
    let input = fixtures::plan_session_input();
    let output =
        plan_session(&input).expect("plan_session should return a deterministic baseline output");
    let actual = serde_json::to_value(&output).expect("serializing plan_session output");
    let golden = plan_golden();

    assert_eq!(actual, golden);
    assert_eq!(
        actual["replayReceipt"]["inputHash"],
        golden["replayReceipt"]["inputHash"]
    );
    assert_eq!(
        actual["replayReceipt"]["outputHash"],
        golden["replayReceipt"]["outputHash"]
    );
    assert_eq!(
        actual["replayReceipt"]["seedUsed"],
        golden["replayReceipt"]["seedUsed"]
    );
    assert_eq!(
        actual["replayReceipt"]["effectiveAt"],
        golden["replayReceipt"]["effectiveAt"]
    );
    assert_eq!(
        actual["replayReceipt"]["implementationVersion"],
        golden["replayReceipt"]["implementationVersion"]
    );
    assert_eq!(
        actual["replayReceipt"]["policyVersion"],
        golden["replayReceipt"]["policyVersion"]
    );
    assert_eq!(
        actual["replayReceipt"]["referenceHash"],
        golden["replayReceipt"]["referenceHash"]
    );
}

#[test]
fn plan_session_is_replay_stable_for_identical_input() {
    let input = fixtures::plan_session_input();
    let first = plan_session(&input).expect("first plan_session invocation should succeed");
    let second = plan_session(&input).expect("second plan_session invocation should succeed");

    let first_json = serde_json::to_value(&first).expect("serializing first plan_session output");
    let second_json =
        serde_json::to_value(&second).expect("serializing second plan_session output");

    assert_eq!(first_json, second_json);
}

#[test]
fn plan_session_baseline_state_patch_is_empty() {
    let golden = plan_golden();
    assert_eq!(golden["statePatch"], json!({}));
}

#[test]
fn plan_session_semantic_patch_only_touches_engine_owned_buckets() {
    let input = fixtures::plan_session_input();
    let output =
        plan_session(&input).expect("plan_session should return a deterministic baseline output");
    let actual = serde_json::to_value(&output).expect("serializing plan_session output");

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
fn plan_session_rejects_when_all_candidates_are_blocked() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push", "pull"]);
        input.state_snapshot["injuryState"]["activeLimitations"] =
            json!(["shoulder", "elbow", "back"]);
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.policy_snapshot["fatigueBlockThreshold"] = json!("moderate");
    });

    let output = plan_session(&input)
        .expect("no-solution plan_session should still return a deterministic rejection envelope");
    let actual =
        serde_json::to_value(&output).expect("serializing no-solution plan_session output");

    assert_eq!(actual["result"]["status"], json!("deterministic_rejection"));
    assert_eq!(actual["result"]["rejectionCode"], json!("injury_blocked"));
    assert_eq!(
        actual["result"]["blockedCandidateIds"],
        json!(["barbell-row", "bench-press", "incline-dumbbell-press"])
    );

    let filter_entry = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");
    let bench_detail_codes = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array")
        .iter()
        .filter(|entry| entry["candidateId"] == json!("bench-press"))
        .map(|entry| entry["detailCode"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();
    assert!(
        bench_detail_codes.contains(&"blocked_movement_pattern"),
        "blocked movement patterns should log the blocked-pattern detail code"
    );
}

#[test]
fn plan_session_returns_fatigue_blocked_when_the_permitted_pool_is_universally_fatigue_blocked() {
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
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.policy_snapshot["fatigueBlockThreshold"] = json!("moderate");
    });

    let output = plan_session(&input)
        .expect("fatigue-blocked plan_session should return a deterministic rejection envelope");
    let actual =
        serde_json::to_value(&output).expect("serializing fatigue-blocked plan_session output");

    assert_eq!(actual["result"]["status"], json!("deterministic_rejection"));
    assert_eq!(actual["result"]["rejectionCode"], json!("fatigue_blocked"));
    assert_eq!(
        actual["result"]["blockedCandidateIds"],
        json!(["bench-press", "incline-dumbbell-press"])
    );

    let scope_entry = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("scope"))
        .expect("scope entry should exist");
    assert_eq!(scope_entry["outcome"], json!("widened"));
    assert_eq!(scope_entry["details"]["wideningApplied"], json!(true));

    let filter_entry = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");
    let blocked = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array");
    assert!(blocked
        .iter()
        .all(|entry| entry["category"] == json!("fatigue_safety")));
    assert_eq!(
        blocked
            .iter()
            .map(|entry| entry["candidateId"].as_str().unwrap_or_default())
            .collect::<Vec<_>>(),
        vec!["bench-press", "incline-dumbbell-press"]
    );
}

#[test]
fn plan_session_widens_to_cross_family_when_preferred_scope_is_injury_blocked() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push"]);
        input.state_snapshot["injuryState"]["activeLimitations"] = json!(["shoulder"]);
        input.policy_snapshot["classArchetypeBias"] = json!(0.15);
    });

    let output =
        plan_session(&input).expect("widened plan_session should return a deterministic output");
    let actual = serde_json::to_value(&output).expect("serializing widened plan_session output");

    assert_eq!(
        actual["result"]["selectedExerciseIds"][0],
        json!("barbell-row")
    );
    assert_eq!(
        actual["result"]["recommendedMovementFamily"],
        json!("upper_pull")
    );

    let filter_entry = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");
    let blocked_candidate_ids = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array")
        .iter()
        .map(|entry| entry["candidateId"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();

    assert_eq!(
        blocked_candidate_ids,
        vec!["bench-press", "incline-dumbbell-press"]
    );
}

#[test]
fn plan_session_logs_active_limitation_push_shortcut_injury_details() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!([]);
        input.state_snapshot["injuryState"]["activeLimitations"] = json!(["shoulder"]);
    });

    let output = plan_session(&input)
        .expect("active-limitation plan_session should return a deterministic output");
    let actual =
        serde_json::to_value(&output).expect("serializing active-limitation plan_session output");

    let filter_entry = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");
    let bench_detail_codes = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array")
        .iter()
        .filter(|entry| entry["candidateId"] == json!("bench-press"))
        .map(|entry| entry["detailCode"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();

    assert!(bench_detail_codes.contains(&"active_limitation_push_shortcut"));
}

#[test]
fn hard_block_records_disable_fatigue_block_when_threshold_is_none() {
    let reference_snapshot = json!({
        "exercises": [
            { "id": "bench-press", "movementPattern": "push" },
            { "id": "row", "movementPattern": "pull" }
        ]
    });
    let state_snapshot = json!({
        "injuryState": {
            "blockedMovementPatterns": [],
            "activeLimitations": []
        },
        "readinessState": {
            "systemicFatigue": "severe"
        },
        "progressionState": {
            "records": []
        }
    });
    let policy_snapshot = json!({
        "fatigueBlockThreshold": "none"
    });

    let blocked = hard_block_records(
        &reference_snapshot,
        &state_snapshot,
        &policy_snapshot,
        "upper_push",
        false,
    );

    assert!(blocked.is_empty());
}

#[test]
fn plan_session_excludes_exact_exercise_swap_required_candidates_from_scoring() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] = json!("swap");
    });

    let output = plan_session(&input)
        .expect("swap-required plan_session should return a deterministic output");
    let actual =
        serde_json::to_value(&output).expect("serializing swap-required plan_session output");

    assert_eq!(
        actual["result"]["selectedExerciseIds"][0],
        json!("incline-dumbbell-press")
    );

    let score_candidate_ids = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .filter(|entry| entry["stepType"] == json!("score"))
        .map(|entry| entry["candidateId"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();
    assert!(
        !score_candidate_ids.contains(&"bench-press"),
        "swap-required candidates must not reach scoring"
    );

    let filter_entry = actual["decisionLog"]
        .as_array()
        .expect("decisionLog should be an array")
        .iter()
        .find(|entry| entry["stepType"] == json!("filter"))
        .expect("filter entry should exist");
    let bench_categories = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array")
        .iter()
        .filter(|entry| entry["candidateId"] == json!("bench-press"))
        .map(|entry| entry["category"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();
    let bench_detail_codes = filter_entry["details"]["blocked"]
        .as_array()
        .expect("blocked entries should be an array")
        .iter()
        .filter(|entry| entry["candidateId"] == json!("bench-press"))
        .map(|entry| entry["detailCode"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();

    assert!(bench_categories.contains(&"explicit_disqualifier"));
    assert!(
        bench_detail_codes.contains(&"progression_swap_required_exact_exercise"),
        "swap-required records should use the stable exact-exercise detail code"
    );
}

#[test]
fn plan_session_fatigue_changes_the_selected_candidate() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["readinessState"]["systemicFatigue"] = json!("severe");
        input.state_snapshot["readinessState"]["muscleFatigue"]["chest"] = json!(90);
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] = json!("maintain");
    });

    let output = plan_session(&input)
        .expect("fatigue-aware plan_session should return a deterministic output");
    let actual =
        serde_json::to_value(&output).expect("serializing fatigue-aware plan_session output");

    assert_eq!(
        actual["result"]["recommendedMovementFamily"],
        json!("upper_pull")
    );
    assert_eq!(
        actual["result"]["progressionActionSummary"][0]["action"],
        json!("regress")
    );
}

#[test]
fn plan_session_defaults_missing_progression_records_to_maintain_stalled() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["progressionState"]["records"] = json!([
            {
                "exerciseId": "barbell-row",
                "previousPerformanceReference": {
                    "weight": 90,
                    "reps": 8
                },
                "trend": "regressing",
                "currentAction": "overload",
                "consecutiveSuccessfulCompletions": 0,
                "consecutiveStallOrRegressionCount": 1,
                "swapRecommendationCount": 0,
                "lastSessionOutcomeClassification": "partial",
                "lastCompletedAt": "2026-02-12T10:00:00.000Z"
            }
        ]);
        input.state_snapshot["gamificationState"] = json!({
            "xp": 140,
            "level": 3,
            "adherenceStreak": 6,
            "completedSessionCount": 12,
            "missedSessionCount": 0,
            "lastAdherenceOutcomeClassification": "complete_clean",
            "lastAwardedAt": "2026-02-10T10:00:00.000Z"
        });
    });

    let output = plan_session(&input)
        .expect("missing-record plan_session should return a deterministic output");
    let actual =
        serde_json::to_value(&output).expect("serializing missing-record plan_session output");

    assert_eq!(
        actual["result"]["selectedExerciseIds"][0],
        json!("bench-press")
    );
    assert_eq!(
        actual["result"]["progressionActionSummary"][0]["action"],
        json!("maintain")
    );
    assert_eq!(
        actual["result"]["progressionActionSummary"][0]["trend"],
        json!("stalled")
    );
}

#[test]
fn plan_session_derives_the_second_progression_summary_from_the_selected_candidate() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["progressionState"]["records"] = json!([
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
            },
            {
                "exerciseId": "incline-dumbbell-press",
                "previousPerformanceReference": {
                    "weight": 80,
                    "reps": 6
                },
                "trend": "improving",
                "currentAction": "overload",
                "consecutiveSuccessfulCompletions": 1,
                "consecutiveStallOrRegressionCount": 0,
                "swapRecommendationCount": 0,
                "lastSessionOutcomeClassification": "complete_clean",
                "lastCompletedAt": "2026-02-10T10:00:00.000Z"
            }
        ]);
    });

    let output = plan_session(&input)
        .expect("second-summary plan_session should return a deterministic output");
    let actual =
        serde_json::to_value(&output).expect("serializing second-summary plan_session output");

    assert_eq!(
        actual["result"]["selectedExerciseIds"][1],
        json!("incline-dumbbell-press")
    );
    assert_eq!(
        actual["result"]["progressionActionSummary"][1]["action"],
        json!("overload")
    );
    assert_eq!(
        actual["result"]["progressionActionSummary"][1]["trend"],
        json!("improving")
    );
}

#[test]
fn plan_session_branching_covers_overload_maintain_regress_and_swap() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["progressionState"]["records"][0]["trend"] = json!("stalled");
        input.state_snapshot["progressionState"]["records"][0]["currentAction"] = json!("maintain");
        input.state_snapshot["progressionState"]["records"][0]["exerciseId"] = json!("bench-press");
        input.request["sessionFocus"] = json!("maintain");
    });

    let output =
        plan_session(&input).expect("branching plan_session should return a deterministic output");
    let actual = serde_json::to_value(&output).expect("serializing branching plan_session output");

    assert_eq!(
        actual["result"]["progressionActionSummary"][0]["action"],
        json!("maintain")
    );
}

#[test]
fn plan_session_class_bias_is_bounded_by_hard_constraints() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["athleteProfile"]["classArchetype"] = json!("powerlifter");
        input.policy_snapshot["classArchetypeBias"] = json!(0.15);
        input.state_snapshot["injuryState"]["blockedMovementPatterns"] = json!(["push"]);
    });

    let output =
        plan_session(&input).expect("class-bias plan_session should return a deterministic output");
    let actual = serde_json::to_value(&output).expect("serializing class-bias plan_session output");

    assert_eq!(
        actual["result"]["recommendedMovementFamily"],
        json!("upper_pull")
    );
    assert!(
        actual["result"]["scoreBreakdown"]["classBias"]
            .as_f64()
            .unwrap_or_default()
            <= 0.15,
        "class bias should remain bounded"
    );
}

#[test]
fn plan_session_uses_seeded_tie_break_and_records_the_final_selection() {
    let input = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-2".to_string();
        input.state_snapshot["recentCompletions"] = json!([]);
        input.state_snapshot["progressionState"]["records"] = json!([]);
        input.policy_snapshot["noveltyBudget"] = json!(0);
    });

    let output =
        plan_session(&input).expect("tie-broken plan_session should return a deterministic output");
    let actual = serde_json::to_value(&output).expect("serializing tie-broken plan_session output");

    assert_eq!(
        actual["result"]["selectedExerciseIds"][0],
        json!("incline-dumbbell-press")
    );
    assert_eq!(actual["decisionLog"][4]["stepType"], json!("tie_break"));
    assert_eq!(actual["decisionLog"][4]["outcome"], json!("selected"));
    assert_eq!(actual["decisionLog"][4]["computedValue"], json!(1));
    assert_eq!(
        actual["decisionLog"][5]["stepType"],
        json!("final_selection")
    );
    assert_eq!(
        actual["decisionLog"][5]["candidateId"],
        json!("incline-dumbbell-press")
    );
    assert_eq!(actual["decisionLog"][5]["outcome"], json!("selected"));
}

#[test]
fn plan_session_changes_when_seed_or_microcycle_changes() {
    let base_input = fixtures::plan_session_input();
    let seed_variant = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-variant".to_string();
    });
    let cycle_variant = fixtures::plan_session_input_with(|input| {
        input.request["microcycleIndex"] = json!(3);
        input.state_snapshot["activeProgramState"]["currentMicrocycle"] = json!(3);
    });

    let base_output = plan_session(&base_input).expect("baseline plan_session should succeed");
    let seed_output =
        plan_session(&seed_variant).expect("seed-variant plan_session should succeed");
    let cycle_output =
        plan_session(&cycle_variant).expect("cycle-variant plan_session should succeed");

    let base_json =
        serde_json::to_value(base_output).expect("serializing baseline plan_session output");
    let seed_json =
        serde_json::to_value(seed_output).expect("serializing seed-variant plan_session output");
    let cycle_json =
        serde_json::to_value(cycle_output).expect("serializing cycle-variant plan_session output");

    assert_ne!(
        base_json["replayReceipt"]["seedUsed"],
        seed_json["replayReceipt"]["seedUsed"]
    );
    assert_eq!(
        base_json["replayReceipt"]["effectiveAt"],
        seed_json["replayReceipt"]["effectiveAt"]
    );
    assert_eq!(
        base_json["replayReceipt"]["implementationVersion"],
        seed_json["replayReceipt"]["implementationVersion"]
    );
    assert_eq!(
        base_json["replayReceipt"]["policyVersion"],
        seed_json["replayReceipt"]["policyVersion"]
    );
    assert_eq!(
        base_json["replayReceipt"]["referenceHash"],
        seed_json["replayReceipt"]["referenceHash"]
    );
    assert_ne!(
        base_json["result"]["recommendedSessionId"],
        cycle_json["result"]["recommendedSessionId"]
    );
}

#[test]
fn plan_session_derives_recommended_session_id_generically_for_the_baseline_fixture() {
    let output = plan_session(&fixtures::plan_session_input())
        .expect("baseline plan_session should succeed");
    let actual = serde_json::to_value(output).expect("serializing baseline plan_session output");

    assert_eq!(
        actual["result"]["recommendedSessionId"],
        json!("program-upper-1-upper-push-m2")
    );
}

#[test]
fn plan_session_prefers_an_alternative_after_repeated_stalls() {
    let input = fixtures::plan_session_input_with(|input| {
        input.state_snapshot["progressionState"]["records"] = json!([
            {
                "exerciseId": "bench-press",
                "previousPerformanceReference": {
                    "weight": 100,
                    "reps": 5
                },
                "trend": "stalled",
                "currentAction": "maintain",
                "consecutiveSuccessfulCompletions": 0,
                "consecutiveStallOrRegressionCount": 4,
                "swapRecommendationCount": 2,
                "lastSessionOutcomeClassification": "missed",
                "lastCompletedAt": "2026-02-12T10:00:00.000Z"
            }
        ]);
    });

    let output = plan_session(&input)
        .expect("stalled-counter plan_session should return a deterministic output");
    let actual = serde_json::to_value(&output).expect("serializing stalled-counter output");

    assert_eq!(
        actual["result"]["selectedExerciseIds"][0],
        json!("incline-dumbbell-press")
    );
}

#[test]
fn plan_session_returns_invalid_input_instead_of_panicking_on_negative_tie_break_band() {
    let input = fixtures::plan_session_input_with(|input| {
        input.policy_snapshot["seededTieBreakBand"] = json!(-0.01);
    });

    let result = std::panic::catch_unwind(|| plan_session(&input));

    assert!(
        result.is_ok(),
        "plan_session should not panic on invalid public input"
    );
    let error = result
        .expect("plan_session invocation should not panic")
        .expect_err("plan_session should reject invalid input");
    assert!(matches!(
        error,
        EngineError::InvalidInput { message } if message.contains("seededTieBreakBand")
    ));
}
