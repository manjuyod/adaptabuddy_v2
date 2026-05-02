pub mod complete_session;
pub mod initialize_cycle;
pub mod plan_session;

use crate::boundary::{to_public_input, to_public_output, TypedEngineInput, TypedEngineOutput};
use crate::replay::{self, NumericScale};
use crate::Operation;
use crate::ReplayReceipt;
use serde_json::{json, Number, Value};

pub(crate) const IMPLEMENTATION_VERSION: &str = "engine-rs-mvp-0";
pub(crate) const POLICY_VERSION: &str = "policy-2026-02";

pub(crate) fn number_from_f64(value: f64) -> Number {
    replay::number_from_scaled_f64(value, NumericScale::Score2)
}

fn strip_complete_session_note_fields(request: &mut Value) {
    let Some(session) = request.get_mut("session").and_then(Value::as_object_mut) else {
        return;
    };

    session.remove("notes");
    let Some(exercises) = session.get_mut("exercises").and_then(Value::as_array_mut) else {
        return;
    };

    for exercise in exercises {
        let Some(exercise) = exercise.as_object_mut() else {
            continue;
        };
        let Some(sets) = exercise.get_mut("sets").and_then(Value::as_array_mut) else {
            continue;
        };

        for set in sets {
            if let Some(set) = set.as_object_mut() {
                set.remove("notes");
            }
        }
    }
}

fn normalize_recent_completions(state_snapshot: &mut Value) {
    let Some(state_snapshot) = state_snapshot.as_object_mut() else {
        return;
    };

    let Some(recent_completions) = state_snapshot
        .get_mut("recentCompletions")
        .and_then(Value::as_array_mut)
    else {
        return;
    };

    recent_completions.sort_by(|left, right| {
        let left_exercise = left
            .get("exerciseId")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let right_exercise = right
            .get("exerciseId")
            .and_then(Value::as_str)
            .unwrap_or_default();
        left_exercise
            .cmp(right_exercise)
            .then_with(|| {
                left.get("completedAt")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .cmp(
                        right
                            .get("completedAt")
                            .and_then(Value::as_str)
                            .unwrap_or_default(),
                    )
            })
            .then_with(|| {
                left.get("quality")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .cmp(
                        right
                            .get("quality")
                            .and_then(Value::as_str)
                            .unwrap_or_default(),
                    )
            })
    });
}

pub(crate) fn derived_input_hash(input: &TypedEngineInput) -> String {
    let public_input = to_public_input(input).expect("typed input should serialize");
    let mut request = public_input.request.clone();
    let mut state_snapshot = public_input.state_snapshot.clone();
    let mut determinism =
        serde_json::to_value(public_input.determinism).expect("determinism should serialize");
    determinism["canonicalizationVersion"] = json!(replay::canonical_policy_version());
    if matches!(input.operation, Operation::CompleteSession) {
        strip_complete_session_note_fields(&mut request);
    }
    normalize_recent_completions(&mut state_snapshot);

    let material = json!({
        "schemaVersion": public_input.schema_version,
        "operation": public_input.operation,
        "determinism": determinism,
        "referenceSnapshot": public_input.reference_snapshot,
        "stateSnapshot": state_snapshot,
        "policySnapshot": public_input.policy_snapshot,
        "request": request,
    });

    replay::hash_value(&material).expect("canonical input material should hash")
}

pub(crate) fn derived_output_hash(output: &TypedEngineOutput) -> String {
    let public_output = to_public_output(output).expect("typed output should serialize");
    let mut material = serde_json::to_value(public_output).expect("public output should serialize");

    if let Value::Object(map) = &mut material {
        map.remove("replayReceipt");
    }

    replay::hash_value(&material).expect("canonical output material should hash")
}

pub(crate) fn build_replay_receipt(
    input: &TypedEngineInput,
    input_hash: String,
    output_hash: String,
) -> ReplayReceipt {
    ReplayReceipt {
        input_hash,
        output_hash,
        seed_used: input.determinism.seed.clone(),
        effective_at: input.determinism.effective_at.clone(),
        implementation_version: IMPLEMENTATION_VERSION.to_string(),
        policy_version: POLICY_VERSION.to_string(),
        reference_hash: input.determinism.reference_hash.clone(),
    }
}
