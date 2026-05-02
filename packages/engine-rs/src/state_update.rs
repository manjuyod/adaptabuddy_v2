use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

use crate::domain::SessionOutcomeClassification;

/// Progression trend classes used in semantic state patches.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProgressionTrend {
    Improving,
    Stalled,
    Regressing,
}

/// Progression action classes used in semantic state patches.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProgressionAction {
    Overload,
    Maintain,
    Regress,
    Swap,
}

/// Semantic load summary for the last successful exposure of a movement.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastSuccessfulLoadPatch {
    pub weight: Value,
    pub reps: Value,
}

/// Semantic per-exercise patch entry.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressionRecordPatch {
    pub current_action: ProgressionAction,
    pub trend: ProgressionTrend,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_successful_load: Option<LastSuccessfulLoadPatch>,
    pub consecutive_successful_completions: u32,
    pub consecutive_stall_or_regression_count: u32,
    pub swap_recommendation_count: u32,
    pub last_session_outcome_classification: SessionOutcomeClassification,
    pub last_completed_at: String,
}

/// Semantic readiness patch bucket.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessStatePatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub systemic_fatigue: Option<Value>,
}

impl ReadinessStatePatch {
    fn is_empty(&self) -> bool {
        self.systemic_fatigue.is_none()
    }
}

/// Semantic gamification patch bucket.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GamificationStatePatch {
    pub xp: i64,
    pub level: u32,
    pub adherence_streak: u32,
    pub completed_session_count: u32,
    pub missed_session_count: u32,
    pub last_adherence_outcome_classification: SessionOutcomeClassification,
    pub last_awarded_at: String,
}

/// Engine-owned state patch with only semantic buckets.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineOwnedStatePatch {
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub progression_state: BTreeMap<String, ProgressionRecordPatch>,
    #[serde(skip_serializing_if = "is_absent_readiness_patch", default)]
    pub readiness_state: Option<ReadinessStatePatch>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub gamification_state: Option<GamificationStatePatch>,
}

fn is_absent_readiness_patch(patch: &Option<ReadinessStatePatch>) -> bool {
    patch.as_ref().is_none_or(ReadinessStatePatch::is_empty)
}

/// Creates a semantic state patch for a completed session.
#[allow(clippy::too_many_arguments)]
pub fn build_completion_state_patch(
    exercise_id: impl Into<String>,
    current_action: ProgressionAction,
    trend: ProgressionTrend,
    last_successful_load: Option<LastSuccessfulLoadPatch>,
    consecutive_successful_completions: u32,
    consecutive_stall_or_regression_count: u32,
    swap_recommendation_count: u32,
    last_session_outcome_classification: SessionOutcomeClassification,
    last_completed_at: impl Into<String>,
    systemic_fatigue: Option<Value>,
    total_xp: i64,
    level: u32,
    adherence_streak: u32,
    completed_session_count: u32,
    missed_session_count: u32,
    last_adherence_outcome_classification: SessionOutcomeClassification,
    last_awarded_at: impl Into<String>,
) -> EngineOwnedStatePatch {
    let mut progression_state = BTreeMap::new();
    progression_state.insert(
        exercise_id.into(),
        ProgressionRecordPatch {
            current_action,
            trend,
            last_successful_load,
            consecutive_successful_completions,
            consecutive_stall_or_regression_count,
            swap_recommendation_count,
            last_session_outcome_classification,
            last_completed_at: last_completed_at.into(),
        },
    );

    EngineOwnedStatePatch {
        progression_state,
        readiness_state: Some(ReadinessStatePatch { systemic_fatigue }),
        gamification_state: Some(GamificationStatePatch {
            xp: total_xp,
            level,
            adherence_streak,
            completed_session_count,
            missed_session_count,
            last_adherence_outcome_classification,
            last_awarded_at: last_awarded_at.into(),
        }),
    }
}

fn merge_object_bucket(target: &mut Map<String, Value>, key: &str, patch_value: Value) {
    match patch_value {
        Value::Object(new_fields) => match target.get_mut(key) {
            Some(Value::Object(existing)) => {
                for (field, value) in new_fields {
                    existing.insert(field, value);
                }
            }
            _ => {
                target.insert(key.to_string(), Value::Object(new_fields));
            }
        },
        other => {
            target.insert(key.to_string(), other);
        }
    }
}

/// Applies a semantic patch to an engine-owned snapshot.
///
/// The helper is intentionally bucket-oriented: it only merges the engine-owned
/// state buckets that the patch owns and never tries to infer or rewrite app
/// persistence shapes.
pub fn apply_engine_owned_state_patch(
    state_snapshot: &Value,
    patch: &EngineOwnedStatePatch,
) -> Value {
    let mut next_state = match state_snapshot {
        Value::Object(map) => Value::Object(map.clone()),
        _ => Value::Object(Map::new()),
    };

    let next_object = next_state
        .as_object_mut()
        .expect("engine-owned state snapshot must be a JSON object");

    if !patch.progression_state.is_empty() {
        let mut progression_bucket = match next_object.get("progressionState") {
            Some(Value::Object(existing)) => existing.clone(),
            _ => Map::new(),
        };

        for (exercise_id, record_patch) in &patch.progression_state {
            progression_bucket.insert(
                exercise_id.clone(),
                serde_json::to_value(record_patch)
                    .expect("serializing progression record patch should not fail"),
            );
        }

        next_object.insert(
            "progressionState".to_string(),
            Value::Object(progression_bucket),
        );
    }

    if let Some(readiness_patch) = &patch.readiness_state {
        if !readiness_patch.is_empty() {
            merge_object_bucket(
                next_object,
                "readinessState",
                serde_json::to_value(readiness_patch)
                    .expect("serializing readiness patch should not fail"),
            );
        }
    }

    if let Some(gamification_patch) = &patch.gamification_state {
        merge_object_bucket(
            next_object,
            "gamificationState",
            serde_json::to_value(gamification_patch)
                .expect("serializing gamification patch should not fail"),
        );
    }

    next_state
}
