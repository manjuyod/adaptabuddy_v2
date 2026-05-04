#[path = "support/fixtures.rs"]
mod fixtures;

use engine_rs::{advance_cycle, complete_session, plan_session};
use serde_json::{json, Value};

fn replay_receipt(output: &Value) -> &serde_json::Map<String, Value> {
    output["replayReceipt"]
        .as_object()
        .expect("replayReceipt should be an object")
}

fn output_json<T: serde::Serialize>(value: &T) -> Value {
    serde_json::to_value(value).expect("serializing engine output")
}

fn typed_input_from_public(
    input: &engine_rs::EngineInputV1,
) -> engine_rs::boundary::TypedEngineInput {
    engine_rs::boundary::TypedEngineInput::from_public(input)
        .expect("typed input should parse from public envelope")
}

fn assert_replay_hashes_match(first: &Value, second: &Value) {
    let first_receipt = replay_receipt(first);
    let second_receipt = replay_receipt(second);

    assert_eq!(
        first_receipt.get("inputHash"),
        second_receipt.get("inputHash")
    );
    assert_eq!(
        first_receipt.get("outputHash"),
        second_receipt.get("outputHash")
    );
}

fn assert_replay_hashes_change(first: &Value, second: &Value) {
    let first_receipt = replay_receipt(first);
    let second_receipt = replay_receipt(second);

    assert_ne!(
        first_receipt.get("inputHash"),
        second_receipt.get("inputHash")
    );
    assert_ne!(
        first_receipt.get("outputHash"),
        second_receipt.get("outputHash")
    );
}

fn assert_sha256_receipt_hash(value: &Value, field: &str) {
    let hash = replay_receipt(value)
        .get(field)
        .and_then(Value::as_str)
        .expect("replay receipt hash should be a string");

    let digest = hash
        .strip_prefix("sha256:")
        .expect("replay receipt hash should use the sha256 prefix");

    assert_eq!(
        digest.len(),
        64,
        "sha256 digest should be 64 lowercase hex characters"
    );
    assert!(
        digest
            .chars()
            .all(|character| character.is_ascii_hexdigit() && !character.is_ascii_uppercase()),
        "sha256 digest should be lowercase hexadecimal"
    );
}

#[test]
fn plan_session_replay_receipt_hashes_are_stable_for_identical_input() {
    let input = fixtures::plan_session_input();
    let first = output_json(&plan_session(&input).expect("first plan_session invocation"));
    let second = output_json(&plan_session(&input).expect("second plan_session invocation"));

    assert_replay_hashes_match(&first, &second);
    assert_eq!(
        replay_receipt(&first).get("seedUsed"),
        replay_receipt(&second).get("seedUsed")
    );
}

#[test]
fn replay_receipt_hashes_match_sha256_format_for_plan_session() {
    let output = output_json(&plan_session(&fixtures::plan_session_input()).expect("plan_session"));

    assert_sha256_receipt_hash(&output, "inputHash");
    assert_sha256_receipt_hash(&output, "outputHash");
}

#[test]
fn complete_session_replay_receipt_hashes_are_stable_for_identical_input() {
    let input = fixtures::complete_session_input();
    let first = output_json(&complete_session(&input).expect("first complete_session invocation"));
    let second =
        output_json(&complete_session(&input).expect("second complete_session invocation"));

    assert_replay_hashes_match(&first, &second);
    assert_eq!(
        replay_receipt(&first).get("seedUsed"),
        replay_receipt(&second).get("seedUsed")
    );
}

#[test]
fn replay_receipt_hashes_match_sha256_format_for_complete_session() {
    let output = output_json(
        &complete_session(&fixtures::complete_session_input()).expect("complete_session"),
    );

    assert_sha256_receipt_hash(&output, "inputHash");
    assert_sha256_receipt_hash(&output, "outputHash");
}

#[test]
fn advance_cycle_replay_receipt_hashes_are_stable_for_identical_input() {
    let input = engine_rs::fixtures::advance_cycle_input();

    let first = output_json(&advance_cycle(&input).expect("first advance_cycle invocation"));
    let second = output_json(&advance_cycle(&input).expect("second advance_cycle invocation"));

    assert_replay_hashes_match(&first, &second);
    assert_eq!(
        replay_receipt(&first).get("seedUsed"),
        replay_receipt(&second).get("seedUsed")
    );
    assert_eq!(first["result"]["seasonRank"], json!("B"));
    assert!(first["result"]["seasonSummary"].is_string());
    assert!(first["result"]["nextCyclePreview"].is_object());
}

#[test]
fn replay_receipt_hashes_match_sha256_format_for_advance_cycle() {
    let input = engine_rs::fixtures::advance_cycle_b_rank_input();

    let output = output_json(&advance_cycle(&input).expect("advance_cycle"));

    assert_sha256_receipt_hash(&output, "inputHash");
    assert_sha256_receipt_hash(&output, "outputHash");
}

#[test]
fn plan_session_seed_changes_seed_used_and_hashes() {
    let base_input = fixtures::plan_session_input();
    let seed_variant = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-hash-variant".to_string();
    });

    let base_output = output_json(&plan_session(&base_input).expect("baseline plan_session"));
    let variant_output =
        output_json(&plan_session(&seed_variant).expect("seed-variant plan_session"));

    assert_ne!(
        replay_receipt(&base_output).get("seedUsed"),
        replay_receipt(&variant_output).get("seedUsed")
    );
    assert_ne!(
        replay_receipt(&base_output).get("inputHash"),
        replay_receipt(&variant_output).get("inputHash")
    );
}

#[test]
fn plan_session_microcycle_change_updates_replay_hashes() {
    let base_input = fixtures::plan_session_input();
    let cycle_variant = fixtures::plan_session_input_with(|input| {
        input.request["microcycleIndex"] = json!(3);
        input.state_snapshot["activeProgramState"]["currentMicrocycle"] = json!(3);
    });

    let base_output = output_json(&plan_session(&base_input).expect("baseline plan_session"));
    let variant_output =
        output_json(&plan_session(&cycle_variant).expect("cycle-variant plan_session"));

    assert_replay_hashes_change(&base_output, &variant_output);
}

#[test]
fn plan_session_metadata_only_change_on_derived_path_does_not_change_replay_hashes() {
    let base_input = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-metadata-derived-path".to_string();
    });
    let metadata_variant = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-metadata-derived-path".to_string();
        input.metadata["correlationId"] = json!("trace-plan-session-metadata-derived-path");
        input.metadata["uiHint"] = json!("coach-panel-open");
    });

    let base_output = output_json(&plan_session(&base_input).expect("baseline plan_session"));
    let variant_output =
        output_json(&plan_session(&metadata_variant).expect("metadata variant plan_session"));

    assert_eq!(base_output, variant_output);
    assert_eq!(
        replay_receipt(&base_output).get("inputHash"),
        replay_receipt(&variant_output).get("inputHash")
    );
    assert_eq!(
        replay_receipt(&base_output).get("outputHash"),
        replay_receipt(&variant_output).get("outputHash")
    );
}

#[test]
fn plan_session_legacy_canon_alias_matches_replay_policy_hashes() {
    let variant_a = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-canon-variant".to_string();
        input.determinism.canonicalization_version = "canon-v1".to_string();
    });
    let variant_b = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-canon-variant".to_string();
        input.determinism.canonicalization_version = "canon-replay-v1".to_string();
    });

    let output_a = output_json(&plan_session(&variant_a).expect("legacy canonicalization alias"));
    let output_b = output_json(&plan_session(&variant_b).expect("canonical replay policy"));

    assert_eq!(
        replay_receipt(&output_a).get("inputHash"),
        replay_receipt(&output_b).get("inputHash")
    );
    assert_eq!(
        replay_receipt(&output_a).get("outputHash"),
        replay_receipt(&output_b).get("outputHash")
    );
}

#[test]
fn plan_session_effective_at_change_updates_replay_input_hash_on_derived_path() {
    let base_input = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-derived-path".to_string();
    });
    let variant_input = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-derived-path".to_string();
        input.determinism.effective_at = "2026-02-14T10:00:00.000Z".to_string();
    });

    let base_output = output_json(&plan_session(&base_input).expect("baseline plan_session"));
    let variant_output =
        output_json(&plan_session(&variant_input).expect("effectiveAt-variant plan_session"));

    assert_ne!(
        replay_receipt(&base_output).get("inputHash"),
        replay_receipt(&variant_output).get("inputHash")
    );
    assert_eq!(
        replay_receipt(&base_output).get("outputHash"),
        replay_receipt(&variant_output).get("outputHash")
    );
}

#[test]
fn plan_session_rule_version_change_updates_replay_input_hash_on_derived_path() {
    let base_input = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-rule-version".to_string();
    });
    let variant_input = fixtures::plan_session_input_with(|input| {
        input.determinism.seed = "seed-plan-session-rule-version".to_string();
        input.determinism.rule_version = "rules-2026-03".to_string();
    });

    let base_output = output_json(&plan_session(&base_input).expect("baseline plan_session"));
    let variant_output =
        output_json(&plan_session(&variant_input).expect("ruleVersion-variant plan_session"));

    assert_ne!(
        replay_receipt(&base_output).get("inputHash"),
        replay_receipt(&variant_output).get("inputHash")
    );
    assert_eq!(
        replay_receipt(&base_output).get("outputHash"),
        replay_receipt(&variant_output).get("outputHash")
    );
}

#[test]
fn complete_session_rule_version_change_updates_replay_input_hash_on_derived_path() {
    let base_input = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-rule-version".to_string();
    });
    let variant_input = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-rule-version".to_string();
        input.determinism.rule_version = "rules-2026-03".to_string();
    });

    let base_output =
        output_json(&complete_session(&base_input).expect("baseline complete_session"));
    let variant_output = output_json(
        &complete_session(&variant_input).expect("ruleVersion-variant complete_session"),
    );

    assert_ne!(
        replay_receipt(&base_output).get("inputHash"),
        replay_receipt(&variant_output).get("inputHash")
    );
    assert_eq!(
        replay_receipt(&base_output).get("outputHash"),
        replay_receipt(&variant_output).get("outputHash")
    );
}

#[test]
fn complete_session_effective_at_change_updates_replay_input_hash_with_missing_completed_at() {
    let base_input =
        fixtures::complete_session_recent_completion_window_without_completed_at_input();
    let variant_input = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-derived-path".to_string();
        input.determinism.effective_at = "2026-02-14T10:00:00.000Z".to_string();
        if let Some(session) = input.request["session"].as_object_mut() {
            session.remove("completedAt");
        }
        input.state_snapshot["recentCompletions"] = json!([
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-10T10:00:00.000Z",
                "quality": "complete_clean"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-11T10:00:00.000Z",
                "quality": "partial"
            },
            {
                "exerciseId": "barbell-row",
                "completedAt": "2026-02-12T09:00:00.000Z",
                "quality": "complete_compromised"
            },
            {
                "exerciseId": "bench-press",
                "completedAt": "2026-02-12T10:00:00.000Z",
                "quality": "complete_clean"
            }
        ]);
    });

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
        replay_receipt(&base_output).get("inputHash"),
        replay_receipt(&variant_output).get("inputHash")
    );
    assert_ne!(
        replay_receipt(&base_output).get("outputHash"),
        replay_receipt(&variant_output).get("outputHash")
    );
}

#[test]
fn complete_session_session_notes_are_non_material_for_output_and_hashes_on_derived_path() {
    let baseline = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-notes-derived-path".to_string();
    });
    let variant = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-notes-derived-path".to_string();
        input.request["session"]["notes"] = json!("Different summary note");
    });

    let baseline_output =
        output_json(&complete_session(&baseline).expect("baseline complete_session"));
    let variant_output =
        output_json(&complete_session(&variant).expect("session-note variant complete_session"));

    assert_eq!(baseline_output, variant_output);
    assert_replay_hashes_match(&baseline_output, &variant_output);
}

#[test]
fn complete_session_set_notes_are_non_material_for_output_and_hashes_on_derived_path() {
    let baseline = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-set-notes-derived-path".to_string();
    });
    let variant = fixtures::complete_session_input_with(|input| {
        input.determinism.seed = "seed-complete-session-set-notes-derived-path".to_string();
        input.request["session"]["exercises"][0]["sets"][0]["notes"] =
            json!("Different top-set note");
    });

    let baseline_output =
        output_json(&complete_session(&baseline).expect("baseline complete_session"));
    let variant_output =
        output_json(&complete_session(&variant).expect("set-note variant complete_session"));

    assert_eq!(baseline_output, variant_output);
    assert_replay_hashes_match(&baseline_output, &variant_output);
}

#[test]
fn complete_session_classification_inputs_update_replay_hashes() {
    let base_input = fixtures::complete_session_input();
    let variant_input = fixtures::complete_session_input_with(|input| {
        input.request["session"]["overallRpe"] = json!(10);
    });

    let base_output =
        output_json(&complete_session(&base_input).expect("baseline complete_session"));
    let variant_output = output_json(
        &complete_session(&variant_input).expect("classification-variant complete_session"),
    );

    assert_eq!(
        replay_receipt(&base_output).get("seedUsed"),
        replay_receipt(&variant_output).get("seedUsed")
    );
    assert_replay_hashes_change(&base_output, &variant_output);
}
