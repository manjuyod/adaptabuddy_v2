use engine_rs::{advance_cycle, fixtures, initialize_cycle, EngineError, Operation};
use serde_json::json;

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
fn advance_cycle_next_cycle_request_is_initialize_cycle_compatible() {
    let output = advance_cycle(&fixtures::advance_cycle_a_rank_input())
        .expect("advance_cycle should succeed");
    let mut initialize_input = fixtures::initialize_cycle_baseline_input();
    initialize_input.request = output.result["nextCycleRequest"].clone();

    let initialized =
        initialize_cycle(&initialize_input).expect("nextCycleRequest should be valid");

    assert_eq!(initialized.operation, Operation::InitializeCycle);
}
