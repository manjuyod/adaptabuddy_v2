use serde_json::{json, Map, Value};

pub fn decision_log_entry(
    step_type: &str,
    rule_id: &str,
    inputs_used: &[&str],
    outcome: &str,
) -> Value {
    json!({
        "stepType": step_type,
        "ruleId": rule_id,
        "inputsUsed": inputs_used,
        "outcome": outcome,
    })
}

pub fn filter_log(rule_id: &str, inputs_used: &[&str], outcome: &str) -> Value {
    decision_log_entry("filter", rule_id, inputs_used, outcome)
}

pub fn score_log(rule_id: &str, candidate_id: &str, computed_value: f64, outcome: &str) -> Value {
    json!({
        "stepType": "score",
        "ruleId": rule_id,
        "candidateId": candidate_id,
        "computedValue": computed_value,
        "outcome": outcome,
    })
}

pub fn tie_break_log(rule_id: &str, inputs_used: &[&str], outcome: &str) -> Value {
    decision_log_entry("tie_break", rule_id, inputs_used, outcome)
}

pub fn classify_log(rule_id: &str, inputs_used: &[&str], outcome: &str) -> Value {
    decision_log_entry("classify", rule_id, inputs_used, outcome)
}

pub fn award_xp_log(rule_id: &str, computed_value: i64, outcome: &str) -> Value {
    json!({
        "stepType": "award_xp",
        "ruleId": rule_id,
        "computedValue": computed_value,
        "outcome": outcome,
    })
}

pub fn replay_receipt(
    input_hash: &str,
    output_hash: &str,
    seed_used: &str,
    effective_at: &str,
    implementation_version: &str,
    policy_version: &str,
    reference_hash: &str,
) -> Value {
    json!({
        "inputHash": input_hash,
        "outputHash": output_hash,
        "seedUsed": seed_used,
        "effectiveAt": effective_at,
        "implementationVersion": implementation_version,
        "policyVersion": policy_version,
        "referenceHash": reference_hash,
    })
}

pub fn semantic_state_patch(entries: Vec<(&str, Value)>) -> Value {
    let mut object = Map::new();
    for (key, value) in entries {
        object.insert(key.to_string(), value);
    }
    Value::Object(object)
}

pub fn empty_state_patch() -> Value {
    Value::Object(Map::new())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn decision_log_entry_and_wrappers_emit_stable_shapes() {
        assert_eq!(
            decision_log_entry(
                "filter",
                "injury_compatibility",
                &["readinessState"],
                "pass"
            ),
            json!({
                "stepType": "filter",
                "ruleId": "injury_compatibility",
                "inputsUsed": ["readinessState"],
                "outcome": "pass",
            })
        );

        assert_eq!(
            filter_log("injury_compatibility", &["readinessState"], "pass"),
            json!({
                "stepType": "filter",
                "ruleId": "injury_compatibility",
                "inputsUsed": ["readinessState"],
                "outcome": "pass",
            })
        );

        assert_eq!(
            tie_break_log("seeded_selection", &["seed-42"], "selected"),
            json!({
                "stepType": "tie_break",
                "ruleId": "seeded_selection",
                "inputsUsed": ["seed-42"],
                "outcome": "selected",
            })
        );

        assert_eq!(
            classify_log("completion_quality", &["overallRpe"], "improving"),
            json!({
                "stepType": "classify",
                "ruleId": "completion_quality",
                "inputsUsed": ["overallRpe"],
                "outcome": "improving",
            })
        );

        assert_eq!(
            score_log("progression_need", "bench-press", 0.69, "kept"),
            json!({
                "stepType": "score",
                "ruleId": "progression_need",
                "candidateId": "bench-press",
                "computedValue": 0.69,
                "outcome": "kept",
            })
        );

        assert_eq!(
            award_xp_log("completion_reward", 20, "applied"),
            json!({
                "stepType": "award_xp",
                "ruleId": "completion_reward",
                "computedValue": 20,
                "outcome": "applied",
            })
        );
    }

    #[test]
    fn replay_receipt_emits_canonical_camel_case_fields() {
        assert_eq!(
            replay_receipt(
                "sha256:input",
                "sha256:output",
                "seed-1",
                "2026-03-26T00:00:00Z",
                "engine-rs-mvp-0",
                "policy-2026-02",
                "sha256:reference",
            ),
            json!({
                "inputHash": "sha256:input",
                "outputHash": "sha256:output",
                "seedUsed": "seed-1",
                "effectiveAt": "2026-03-26T00:00:00Z",
                "implementationVersion": "engine-rs-mvp-0",
                "policyVersion": "policy-2026-02",
                "referenceHash": "sha256:reference",
            })
        );
    }

    #[test]
    fn semantic_state_patch_preserves_provided_buckets() {
        assert_eq!(
            semantic_state_patch(vec![
                (
                    "progressionState",
                    json!({
                        "records": [],
                        "lastUpdated": "2026-03-26T00:00:00Z",
                    }),
                ),
                (
                    "readinessState",
                    json!({
                        "systemicFatigue": "moderate",
                    }),
                ),
            ]),
            json!({
                "progressionState": {
                    "records": [],
                    "lastUpdated": "2026-03-26T00:00:00Z",
                },
                "readinessState": {
                    "systemicFatigue": "moderate",
                },
            })
        );
    }

    #[test]
    fn empty_state_patch_emits_an_empty_object() {
        assert_eq!(empty_state_patch(), json!({}));
    }
}
