use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub const REJECTION_INJURY_BLOCKED: &str = "injury_blocked";
pub const REJECTION_FATIGUE_BLOCKED: &str = "fatigue_blocked";
pub const REJECTION_EQUIPMENT_BLOCKED: &str = "equipment_blocked";
pub const REJECTION_LOCK_REQUIRED: &str = "lock_required";
pub const REJECTION_NO_VALID_CANDIDATES: &str = "no_valid_candidates";

fn candidate_string(candidate: &Value, key: &str) -> Option<String> {
    candidate
        .get(key)
        .and_then(Value::as_str)
        .map(|value| value.to_string())
}

fn state_strings(state: &Value, key: &str) -> Vec<String> {
    state
        .get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn injury_detail_code(
    movement_pattern: &str,
    blocked_patterns: &[String],
    active_limitations: &[String],
) -> &'static str {
    if blocked_patterns
        .iter()
        .any(|pattern| pattern == movement_pattern)
    {
        return "blocked_movement_pattern";
    }

    if movement_pattern == "push"
        && active_limitations
            .iter()
            .any(|limitation| matches!(limitation.as_str(), "shoulder" | "elbow" | "back"))
    {
        return "active_limitation_push_shortcut";
    }

    "blocked_movement_pattern"
}

pub fn hard_block_records(
    reference_snapshot: &Value,
    state_snapshot: &Value,
    policy_snapshot: &Value,
    _requested_focus: &str,
    _allow_cross_family_fallback: bool,
) -> Vec<Value> {
    let blocked_patterns = state_strings(
        state_snapshot.get("injuryState").unwrap_or(&Value::Null),
        "blockedMovementPatterns",
    );
    let active_limitations = state_strings(
        state_snapshot.get("injuryState").unwrap_or(&Value::Null),
        "activeLimitations",
    );
    let severe_fatigue = state_snapshot
        .get("readinessState")
        .and_then(|readiness| readiness.get("systemicFatigue"))
        .and_then(Value::as_str)
        .is_some_and(|value| value == "severe");
    let fatigue_threshold_enabled = policy_snapshot
        .get("fatigueBlockThreshold")
        .and_then(Value::as_str)
        .is_some_and(|value| value != "none");
    let progression_records = state_snapshot
        .get("progressionState")
        .and_then(|progression| progression.get("records"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut blocked = Vec::new();
    let exercises = reference_snapshot
        .get("exercises")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for exercise in exercises {
        let exercise_id = match candidate_string(&exercise, "id") {
            Some(value) => value,
            None => continue,
        };
        let movement_pattern = candidate_string(&exercise, "movementPattern").unwrap_or_default();
        let injury_blocked = blocked_patterns
            .iter()
            .any(|pattern| pattern == &movement_pattern)
            || (movement_pattern == "push"
                && active_limitations.iter().any(|limitation| {
                    matches!(limitation.as_str(), "shoulder" | "elbow" | "back")
                }));
        let fatigue_blocked =
            severe_fatigue && fatigue_threshold_enabled && movement_pattern == "push";
        let swap_required = progression_records.iter().any(|record| {
            record
                .get("exerciseId")
                .and_then(Value::as_str)
                .is_some_and(|value| value == exercise_id)
                && record
                    .get("currentAction")
                    .and_then(Value::as_str)
                    .is_some_and(|value| value == "swap")
        });

        if fatigue_blocked {
            blocked.push(json!({
                "candidateId": exercise_id,
                "category": "fatigue_safety",
                "code": "fatigue_blocked",
                "detailCode": "severe_systemic_fatigue",
            }));
        }

        if injury_blocked {
            blocked.push(json!({
                "candidateId": exercise_id,
                "category": "injury_safety",
                "code": "injury_blocked",
                "detailCode": injury_detail_code(
                    movement_pattern.as_str(),
                    &blocked_patterns,
                    &active_limitations,
                ),
            }));
        }

        if swap_required {
            blocked.push(json!({
                "candidateId": exercise_id,
                "category": "explicit_disqualifier",
                "code": "explicit_disqualifier",
                "detailCode": "progression_swap_required_exact_exercise",
            }));
        }
    }

    blocked
}

fn blocked_candidate_ids_from_records(blocked_records: &[Value]) -> Vec<String> {
    let mut blocked = blocked_records
        .iter()
        .filter_map(|record| {
            record
                .get("candidateId")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect::<Vec<_>>();

    blocked.sort();
    blocked.dedup();
    blocked
}

pub fn blocked_candidate_ids(
    reference_snapshot: &Value,
    state_snapshot: &Value,
    policy_snapshot: &Value,
    requested_focus: &str,
    allow_cross_family_fallback: bool,
) -> Vec<String> {
    blocked_candidate_ids_from_records(&hard_block_records(
        reference_snapshot,
        state_snapshot,
        policy_snapshot,
        requested_focus,
        allow_cross_family_fallback,
    ))
}

fn blocked_candidate_ids_for_category(blocked_records: &[Value], category: &str) -> Vec<String> {
    let mut blocked = blocked_records
        .iter()
        .filter(|record| record.get("category").and_then(Value::as_str) == Some(category))
        .filter_map(|record| {
            record
                .get("candidateId")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .collect::<Vec<_>>();

    blocked.sort();
    blocked.dedup();
    blocked
}

pub fn collapse_rejection_for_hard_blocks(
    blocked_records: &[Value],
    total_candidate_count: usize,
) -> (&'static str, Vec<String>) {
    if total_candidate_count == 0 {
        return (REJECTION_NO_VALID_CANDIDATES, Vec::new());
    }

    let mut candidate_categories = BTreeMap::<String, BTreeSet<String>>::new();
    for record in blocked_records {
        let candidate_id = match record.get("candidateId").and_then(Value::as_str) {
            Some(value) => value.to_string(),
            None => continue,
        };
        let category = match record.get("category").and_then(Value::as_str) {
            Some(value) => value.to_string(),
            None => continue,
        };
        candidate_categories
            .entry(candidate_id)
            .or_default()
            .insert(category);
    }

    if candidate_categories.is_empty() {
        return (REJECTION_NO_VALID_CANDIDATES, Vec::new());
    }

    let all_fatigue_blocked = candidate_categories
        .values()
        .all(|categories| categories.contains("fatigue_safety"));
    if all_fatigue_blocked {
        return (
            REJECTION_FATIGUE_BLOCKED,
            blocked_candidate_ids_for_category(blocked_records, "fatigue_safety"),
        );
    }

    let all_injury_blocked = candidate_categories
        .values()
        .all(|categories| categories.contains("injury_safety"));
    if all_injury_blocked {
        return (
            REJECTION_INJURY_BLOCKED,
            blocked_candidate_ids_for_category(blocked_records, "injury_safety"),
        );
    }

    let mut blocked = candidate_categories.keys().cloned().collect::<Vec<_>>();
    blocked.sort();
    blocked.dedup();
    (REJECTION_NO_VALID_CANDIDATES, blocked)
}

pub fn rejection_code_for_candidates(
    blocked_candidate_ids: &[String],
    total_candidate_count: usize,
    state_snapshot: &Value,
    policy_snapshot: &Value,
) -> Option<&'static str> {
    if total_candidate_count == 0 {
        return Some(REJECTION_NO_VALID_CANDIDATES);
    }

    if blocked_candidate_ids.is_empty() {
        return None;
    }

    if blocked_candidate_ids.len() >= total_candidate_count {
        return Some(REJECTION_NO_VALID_CANDIDATES);
    }

    let severe_fatigue = state_snapshot
        .get("readinessState")
        .and_then(|readiness| readiness.get("systemicFatigue"))
        .and_then(Value::as_str)
        .is_some_and(|value| value == "severe");
    let threshold = policy_snapshot
        .get("fatigueBlockThreshold")
        .and_then(Value::as_str)
        .unwrap_or("severe");

    if severe_fatigue && threshold != "none" {
        return Some(REJECTION_FATIGUE_BLOCKED);
    }

    Some(REJECTION_INJURY_BLOCKED)
}

pub fn rejection_envelope(blocked_candidate_ids: Vec<String>, code: &str) -> Value {
    json!({
        "status": "deterministic_rejection",
        "rejectionCode": code,
        "blockedCandidateIds": blocked_candidate_ids,
    })
}

pub fn movement_family_for_focus(requested_focus: &str) -> &'static str {
    match requested_focus {
        "upper_push" => "push",
        "upper_pull" => "pull",
        "lower_push" => "push",
        "lower_pull" => "pull",
        _ => "push",
    }
}

pub fn candidate_allowed_for_focus(
    candidate: &Value,
    requested_focus: &str,
    allow_cross_family_fallback: bool,
) -> bool {
    if allow_cross_family_fallback {
        return true;
    }

    let movement_pattern = candidate
        .get("movementPattern")
        .and_then(Value::as_str)
        .unwrap_or_default();

    match requested_focus {
        "upper_push" => movement_pattern == "push",
        "upper_pull" => movement_pattern == "pull",
        "lower_push" => movement_pattern == "push",
        "lower_pull" => movement_pattern == "pull",
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn blocked_candidate_ids_filters_push_exercises_for_injury_and_severe_fatigue() {
        let reference_snapshot = json!({
            "exercises": [
                { "id": "push-press", "movementPattern": "push" },
                { "id": "row", "movementPattern": "pull" },
                { "id": "dip", "movementPattern": "push" }
            ]
        });
        let state_snapshot = json!({
            "injuryState": {
                "blockedMovementPatterns": ["push"],
                "activeLimitations": ["shoulder"]
            },
            "readinessState": {
                "systemicFatigue": "severe"
            }
        });
        let policy_snapshot = json!({
            "fatigueBlockThreshold": "moderate"
        });

        let blocked = blocked_candidate_ids(
            &reference_snapshot,
            &state_snapshot,
            &policy_snapshot,
            "upper_push",
            false,
        );

        assert_eq!(blocked, vec!["dip".to_string(), "push-press".to_string()]);
    }

    #[test]
    fn hard_block_records_respect_disabled_fatigue_threshold() {
        let reference_snapshot = json!({
            "exercises": [
                { "id": "push-press", "movementPattern": "push" },
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
    fn collapse_rejection_for_hard_blocks_prefers_universal_family_and_filters_ids() {
        let blocked_records = vec![
            json!({
                "candidateId": "bench-press",
                "category": "fatigue_safety",
                "code": "fatigue_blocked",
            }),
            json!({
                "candidateId": "bench-press",
                "category": "injury_safety",
                "code": "injury_blocked",
            }),
            json!({
                "candidateId": "incline-dumbbell-press",
                "category": "fatigue_safety",
                "code": "fatigue_blocked",
            }),
        ];

        let (code, blocked) = collapse_rejection_for_hard_blocks(&blocked_records, 2);

        assert_eq!(code, REJECTION_FATIGUE_BLOCKED);
        assert_eq!(
            blocked,
            vec![
                "bench-press".to_string(),
                "incline-dumbbell-press".to_string()
            ]
        );
    }

    #[test]
    fn rejection_code_for_candidates_returns_no_valid_candidates_when_set_is_exhausted() {
        let state_snapshot = json!({
            "readinessState": {
                "systemicFatigue": "moderate"
            }
        });
        let policy_snapshot = json!({});
        let blocked_candidate_ids = vec!["a".to_string(), "b".to_string()];

        let code = rejection_code_for_candidates(
            &blocked_candidate_ids,
            blocked_candidate_ids.len(),
            &state_snapshot,
            &policy_snapshot,
        );

        assert_eq!(code, Some(REJECTION_NO_VALID_CANDIDATES));
    }

    #[test]
    fn rejection_code_for_candidates_returns_fatigue_blocked_before_injury_blocked() {
        let state_snapshot = json!({
            "readinessState": {
                "systemicFatigue": "severe"
            }
        });
        let policy_snapshot = json!({
            "fatigueBlockThreshold": "severe"
        });
        let blocked_candidate_ids = vec!["a".to_string()];

        let code = rejection_code_for_candidates(
            &blocked_candidate_ids,
            2,
            &state_snapshot,
            &policy_snapshot,
        );

        assert_eq!(code, Some(REJECTION_FATIGUE_BLOCKED));
    }

    #[test]
    fn rejection_code_for_candidates_returns_injury_blocked_when_only_injury_applies() {
        let state_snapshot = json!({
            "readinessState": {
                "systemicFatigue": "moderate"
            }
        });
        let policy_snapshot = json!({
            "fatigueBlockThreshold": "severe"
        });
        let blocked_candidate_ids = vec!["a".to_string()];

        let code = rejection_code_for_candidates(
            &blocked_candidate_ids,
            2,
            &state_snapshot,
            &policy_snapshot,
        );

        assert_eq!(code, Some(REJECTION_INJURY_BLOCKED));
    }

    #[test]
    fn rejection_code_for_candidates_returns_none_for_empty_blocked_set_with_candidates() {
        let state_snapshot = json!({});
        let policy_snapshot = json!({});

        let code = rejection_code_for_candidates(&[], 2, &state_snapshot, &policy_snapshot);

        assert_eq!(code, None);
    }

    #[test]
    fn rejection_code_for_candidates_returns_no_valid_candidates_when_candidate_pool_is_empty() {
        let state_snapshot = json!({});
        let policy_snapshot = json!({});

        let code = rejection_code_for_candidates(&[], 0, &state_snapshot, &policy_snapshot);

        assert_eq!(code, Some(REJECTION_NO_VALID_CANDIDATES));
    }

    #[test]
    fn rejection_envelope_preserves_shape_and_blocked_ids() {
        let envelope = rejection_envelope(
            vec!["alpha".to_string(), "beta".to_string()],
            "injury_blocked",
        );

        assert_eq!(
            envelope,
            json!({
                "status": "deterministic_rejection",
                "rejectionCode": "injury_blocked",
                "blockedCandidateIds": ["alpha", "beta"]
            })
        );
    }

    #[test]
    fn movement_family_and_focus_allowance_use_family_mapping_and_fallbacks() {
        let push_candidate = json!({ "movementPattern": "push" });
        let pull_candidate = json!({ "movementPattern": "pull" });

        assert_eq!(movement_family_for_focus("upper_push"), "push");
        assert_eq!(movement_family_for_focus("lower_pull"), "pull");
        assert_eq!(movement_family_for_focus("unexpected"), "push");

        assert!(candidate_allowed_for_focus(
            &push_candidate,
            "upper_push",
            false
        ));
        assert!(!candidate_allowed_for_focus(
            &pull_candidate,
            "upper_push",
            false
        ));
        assert!(candidate_allowed_for_focus(
            &pull_candidate,
            "upper_push",
            true
        ));
        assert!(candidate_allowed_for_focus(
            &push_candidate,
            "unexpected",
            false
        ));
    }
}
