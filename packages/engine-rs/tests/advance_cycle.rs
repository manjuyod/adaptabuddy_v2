use engine_rs::{advance_cycle, fixtures, initialize_cycle, EngineError, Operation};
use serde_json::json;

fn selected_program_weight(output: &engine_rs::EngineOutputV1, program_id: &str) -> f64 {
    output.result["nextCycleRequest"]["selectedPrograms"]
        .as_array()
        .expect("selectedPrograms should be an array")
        .iter()
        .find(|program| program["programId"] == json!(program_id))
        .and_then(|program| program["weight"].as_f64())
        .expect("program weight should be numeric")
}

#[test]
fn advance_cycle_fixture_rank_outputs_cover_s_a_b_c_d() {
    let cases = [
        ("S", fixtures::advance_cycle_s_rank_input()),
        ("A", fixtures::advance_cycle_a_rank_input()),
        ("B", fixtures::advance_cycle_b_rank_input()),
        ("C", fixtures::advance_cycle_c_rank_input()),
        ("D", fixtures::advance_cycle_d_rank_input()),
    ];

    for (expected_rank, input) in cases {
        let output = advance_cycle(&input).expect("advance_cycle should succeed");
        let result = output.result;

        assert_eq!(result["seasonRank"], json!(expected_rank));
        assert!(
            result["seasonSummary"].is_string(),
            "seasonSummary should be a string"
        );
        assert!(
            result["rankBreakdown"].get("completionRate").is_some(),
            "rankBreakdown should include completionRate"
        );
        assert!(
            result["awards"].as_array().is_some(),
            "awards should be an array"
        );
        assert!(
            result["evolutionPatch"].is_object(),
            "evolutionPatch should be an object"
        );
        assert!(
            result["nextCycleRequest"]["profile"].is_object(),
            "nextCycleRequest should be initialize_cycle-compatible"
        );
        assert!(
            result["nextCyclePreview"]["seasonRank"].is_string(),
            "nextCyclePreview should expose a rank"
        );
    }
}

#[test]
fn advance_cycle_preserves_blended_program_context_and_carry_forward_inputs() {
    let output = advance_cycle(&fixtures::advance_cycle_blended_power_bench_pushup_input())
        .expect("advance_cycle should succeed");

    let request = &output.result["nextCycleRequest"];
    let program_ids = request["selectedPrograms"]
        .as_array()
        .expect("selectedPrograms should be an array")
        .iter()
        .map(|program| {
            program["programId"]
                .as_str()
                .expect("program id should be a string")
        })
        .collect::<Vec<_>>();

    assert_eq!(
        program_ids,
        vec!["program-powerlifting", "program-bench", "program-challenge",]
    );
    assert_eq!(
        request["profile"]["injuryMuscleGroupSlugs"],
        json!(["quads"])
    );
    assert_eq!(request["profile"]["fatiguePreference"], json!("high"));
    assert_eq!(
        request["programAdaptationInputs"]["challengeBaselines"]["push_up"]["maxReps"],
        json!(20)
    );
    assert_eq!(
        request["programAdaptationInputs"]["strengthBaselines"]["squat"]["estimatedOneRepMax"],
        json!(225)
    );
    assert_eq!(
        request["programAdaptationInputs"]["strengthBaselines"]["deadlift"]["estimatedOneRepMax"],
        json!(225)
    );
    assert_eq!(
        request["programAdaptationInputs"]["strengthBaselines"]["bench_press"]
            ["estimatedOneRepMax"],
        json!(100)
    );
    assert_eq!(
        request["programAdaptationInputs"]["strengthBaselines"]["overhead_press"]
            ["estimatedOneRepMax"],
        json!(75)
    );
}

#[test]
fn advance_cycle_reweights_blended_programs_by_rank() {
    let mut high_rank_input = fixtures::advance_cycle_blended_power_bench_pushup_input();
    high_rank_input.request["seasonIndex"] = json!(6);
    high_rank_input.request["completionRate"] = json!(0.98);
    high_rank_input.request["adherence"] = json!(0.96);
    high_rank_input.request["completionQuality"] = json!(0.97);
    high_rank_input.request["progression"] = json!(0.95);
    high_rank_input.request["recovery"] = json!(0.94);
    high_rank_input.request["consistency"] = json!(0.97);
    high_rank_input.request["completedSessionCount"] = json!(24);
    high_rank_input.request["missedSessionCount"] = json!(0);

    let mut low_rank_input = fixtures::advance_cycle_blended_power_bench_pushup_input();
    low_rank_input.request["seasonIndex"] = json!(6);
    low_rank_input.request["completionRate"] = json!(0.31);
    low_rank_input.request["adherence"] = json!(0.28);
    low_rank_input.request["completionQuality"] = json!(0.25);
    low_rank_input.request["progression"] = json!(0.26);
    low_rank_input.request["recovery"] = json!(0.27);
    low_rank_input.request["consistency"] = json!(0.24);
    low_rank_input.request["completedSessionCount"] = json!(8);
    low_rank_input.request["missedSessionCount"] = json!(7);

    let high_rank_output = advance_cycle(&high_rank_input).expect("high rank advance_cycle");
    let low_rank_output = advance_cycle(&low_rank_input).expect("low rank advance_cycle");

    assert!(
        selected_program_weight(&high_rank_output, "program-powerlifting")
            > selected_program_weight(&low_rank_output, "program-powerlifting")
    );
    assert!(
        selected_program_weight(&low_rank_output, "program-challenge")
            >= selected_program_weight(&high_rank_output, "program-challenge")
    );
    assert!(
        (selected_program_weight(&high_rank_output, "program-powerlifting")
            + selected_program_weight(&high_rank_output, "program-bench")
            + selected_program_weight(&high_rank_output, "program-challenge")
            - 1.0)
            .abs()
            < 0.001
    );
    assert!(
        (selected_program_weight(&low_rank_output, "program-powerlifting")
            + selected_program_weight(&low_rank_output, "program-bench")
            + selected_program_weight(&low_rank_output, "program-challenge")
            - 1.0)
            .abs()
            < 0.001
    );
}

#[test]
fn advance_cycle_rejects_unknown_request_fields() {
    let mut input = fixtures::complete_session_input();
    input.operation = Operation::AdvanceCycle;
    input.request = serde_json::json!({
        "seasonIndex": 1,
        "completionRate": 0.8,
        "focus": "strength",
        "unexpectedField": true
    });

    let error = advance_cycle(&input).expect_err("unknown field should fail");
    match error {
        EngineError::InvalidInput { message } => {
            assert!(
                message.contains("unknown field"),
                "unexpected error: {message}"
            );
        }
        other => panic!("expected invalid input, got {other:?}"),
    }
}

#[test]
fn advance_cycle_replay_stability_is_deterministic_for_blended_fixture() {
    let input = fixtures::advance_cycle_blended_power_bench_pushup_input();

    let first = advance_cycle(&input).expect("first advance_cycle invocation");
    let second = advance_cycle(&input).expect("second advance_cycle invocation");

    assert_eq!(first, second);
}

#[test]
fn advance_cycle_next_cycle_request_is_initialize_cycle_compatible() {
    let blended_input = fixtures::advance_cycle_blended_power_bench_pushup_input();
    let output = advance_cycle(&blended_input).expect("advance_cycle should succeed");

    let mut initialize_input = fixtures::initialize_cycle_baseline_input();
    initialize_input.reference_snapshot = blended_input.reference_snapshot.clone();
    initialize_input.state_snapshot = blended_input.state_snapshot.clone();
    initialize_input.policy_snapshot = blended_input.policy_snapshot.clone();
    initialize_input.determinism.reference_hash =
        engine_rs::replay::hash_value(&initialize_input.reference_snapshot)
            .expect("reference hash");
    initialize_input.request = output.result["nextCycleRequest"].clone();

    let initialized =
        initialize_cycle(&initialize_input).expect("nextCycleRequest should be valid");

    assert_eq!(initialized.operation, Operation::InitializeCycle);
    let program_ids = initialized.result["programBlend"]
        .as_array()
        .expect("programBlend should be an array")
        .iter()
        .map(|program| {
            program["programId"]
                .as_str()
                .expect("program id should be a string")
        })
        .collect::<Vec<_>>();
    assert_eq!(
        program_ids,
        vec!["program-powerlifting", "program-bench", "program-challenge",]
    );
}
