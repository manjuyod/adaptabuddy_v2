use serde_json::{json, Value};

use crate::derivations::{
    ACTION_MAINTAIN, ACTION_OVERLOAD, ACTION_REGRESS, ACTION_SWAP, TREND_IMPROVING,
    TREND_REGRESSING, TREND_STALLED,
};

pub const COMPLETION_CLEAN: &str = "complete_clean";
pub const COMPLETION_COMPROMISED: &str = "complete_compromised";
pub const COMPLETION_PARTIAL: &str = "partial";
pub const COMPLETION_MISSED: &str = "missed";

fn valid_action(action: &str) -> bool {
    matches!(
        action,
        ACTION_OVERLOAD | ACTION_MAINTAIN | ACTION_REGRESS | ACTION_SWAP
    )
}

fn severity_rank(action: &str) -> i32 {
    match action {
        ACTION_OVERLOAD => 0,
        ACTION_MAINTAIN => 1,
        ACTION_REGRESS => 2,
        ACTION_SWAP => 3,
        _ => 1,
    }
}

pub fn classify_trend(
    exposures: &[(f64, f64)],
    systemic_fatigue: &str,
    readiness: &str,
) -> &'static str {
    if exposures.len() < 2 {
        return TREND_STALLED;
    }

    let mut score = 0_i32;
    for window in exposures.windows(2) {
        let previous = window[0];
        let current = window[1];
        if current.0 >= previous.0 && current.1 >= previous.1 {
            score += 1;
        } else if current.0 < previous.0 || current.1 < previous.1 {
            score -= 1;
        }
    }

    if systemic_fatigue == "severe" {
        return TREND_REGRESSING;
    }

    if readiness == "uncertain" {
        return TREND_STALLED;
    }

    if score > 0 {
        TREND_IMPROVING
    } else if score < 0 {
        TREND_REGRESSING
    } else {
        TREND_STALLED
    }
}

pub fn branch_plan_action(
    current_action: &str,
    trend: &str,
    systemic_fatigue: &str,
    movement_blocked: bool,
) -> &'static str {
    if movement_blocked || trend == "blocked" {
        return ACTION_SWAP;
    }

    if systemic_fatigue == "severe" || trend == TREND_REGRESSING {
        return ACTION_REGRESS;
    }

    if trend == TREND_STALLED {
        return if valid_action(current_action)
            && severity_rank(current_action) <= severity_rank(ACTION_MAINTAIN)
        {
            match current_action {
                ACTION_OVERLOAD => ACTION_OVERLOAD,
                ACTION_MAINTAIN => ACTION_MAINTAIN,
                ACTION_REGRESS => ACTION_MAINTAIN,
                ACTION_SWAP => ACTION_MAINTAIN,
                _ => ACTION_MAINTAIN,
            }
        } else {
            ACTION_MAINTAIN
        };
    }

    if trend == TREND_IMPROVING {
        return if valid_action(current_action) {
            match current_action {
                ACTION_OVERLOAD => ACTION_OVERLOAD,
                ACTION_MAINTAIN => ACTION_MAINTAIN,
                ACTION_REGRESS => ACTION_REGRESS,
                ACTION_SWAP => ACTION_SWAP,
                _ => ACTION_OVERLOAD,
            }
        } else {
            ACTION_OVERLOAD
        };
    }

    ACTION_MAINTAIN
}

pub fn classify_completion(
    overall_rpe: i64,
    trend: &str,
    systemic_fatigue: &str,
    set_completion: bool,
) -> &'static str {
    if overall_rpe <= 7 && set_completion {
        return COMPLETION_CLEAN;
    }

    if overall_rpe == 8 && set_completion {
        return COMPLETION_COMPROMISED;
    }

    if overall_rpe == 9 && set_completion {
        return COMPLETION_PARTIAL;
    }

    if overall_rpe >= 10 {
        if trend == TREND_REGRESSING || systemic_fatigue == "severe" || !set_completion {
            return COMPLETION_PARTIAL;
        }
        return COMPLETION_MISSED;
    }

    COMPLETION_COMPROMISED
}

pub fn action_from_completion(
    classification: &str,
    current_action: &str,
    microcycle_index: i64,
    seed_fraction: f64,
) -> &'static str {
    match classification {
        COMPLETION_CLEAN => {
            if microcycle_index % 2 == 0 || seed_fraction >= 0.5 {
                ACTION_OVERLOAD
            } else {
                ACTION_MAINTAIN
            }
        }
        COMPLETION_COMPROMISED => ACTION_MAINTAIN,
        COMPLETION_PARTIAL => ACTION_REGRESS,
        COMPLETION_MISSED => ACTION_SWAP,
        _ => {
            if valid_action(current_action) {
                match current_action {
                    ACTION_OVERLOAD => ACTION_OVERLOAD,
                    ACTION_MAINTAIN => ACTION_MAINTAIN,
                    ACTION_REGRESS => ACTION_REGRESS,
                    ACTION_SWAP => ACTION_SWAP,
                    _ => ACTION_MAINTAIN,
                }
            } else {
                ACTION_MAINTAIN
            }
        }
    }
}

pub fn progression_action_summary(exercise_id: &str, action: &str, trend: &str) -> Value {
    json!({
        "exerciseId": exercise_id,
        "action": action,
        "trend": trend,
    })
}

pub fn progression_state_patch(
    exercise_id: &str,
    action: &str,
    trend: &str,
    weight: f64,
    reps: i64,
) -> Value {
    let mut progression = serde_json::Map::new();
    progression.insert(
        exercise_id.to_string(),
        json!({
            "currentAction": action,
            "trend": trend,
            "lastSuccessfulLoad": {
                "weight": weight,
                "reps": reps,
            },
        }),
    );

    let mut root = serde_json::Map::new();
    root.insert("progressionState".to_string(), Value::Object(progression));
    Value::Object(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::derivations::{
        ACTION_MAINTAIN, ACTION_OVERLOAD, ACTION_REGRESS, ACTION_SWAP, TREND_IMPROVING,
        TREND_REGRESSING, TREND_STALLED,
    };
    use serde_json::json;

    #[test]
    fn classify_trend_defaults_to_stalled_with_too_few_exposures() {
        let trend = classify_trend(&[(100.0, 5.0)], "moderate", "ready");

        assert_eq!(trend, TREND_STALLED);
    }

    #[test]
    fn classify_trend_keeps_uncertain_readiness_out_of_regressing() {
        let trend = classify_trend(&[(100.0, 5.0), (102.5, 6.0)], "moderate", "uncertain");

        assert_eq!(trend, TREND_STALLED);
    }

    #[test]
    fn classify_trend_detects_improving_and_recovering_inputs() {
        let trend = classify_trend(&[(100.0, 5.0), (102.5, 5.0), (102.5, 6.0)], "low", "ready");

        assert_eq!(trend, TREND_IMPROVING);
    }

    #[test]
    fn classify_trend_regresses_when_performance_drops_or_fatigue_is_severe() {
        let dropping = classify_trend(&[(100.0, 5.0), (95.0, 4.0)], "moderate", "ready");
        let fatigued = classify_trend(&[(100.0, 5.0), (102.5, 6.0)], "severe", "ready");

        assert_eq!(dropping, TREND_REGRESSING);
        assert_eq!(fatigued, TREND_REGRESSING);
    }

    #[test]
    fn branch_plan_action_covers_swap_regress_and_maintain_paths() {
        assert_eq!(
            branch_plan_action(ACTION_OVERLOAD, TREND_IMPROVING, "moderate", true),
            ACTION_SWAP
        );
        assert_eq!(
            branch_plan_action(ACTION_MAINTAIN, TREND_REGRESSING, "moderate", false),
            ACTION_REGRESS
        );
        assert_eq!(
            branch_plan_action(ACTION_REGRESS, TREND_STALLED, "moderate", false),
            ACTION_MAINTAIN
        );
    }

    #[test]
    fn branch_plan_action_preserves_valid_improving_actions_and_defaults_invalid_to_overload() {
        assert_eq!(
            branch_plan_action(ACTION_OVERLOAD, TREND_IMPROVING, "moderate", false),
            ACTION_OVERLOAD
        );
        assert_eq!(
            branch_plan_action("unexpected", TREND_IMPROVING, "moderate", false),
            ACTION_OVERLOAD
        );
    }

    #[test]
    fn classify_completion_applies_threshold_edges() {
        assert_eq!(
            classify_completion(7, TREND_IMPROVING, "moderate", true),
            COMPLETION_CLEAN
        );
        assert_eq!(
            classify_completion(8, TREND_IMPROVING, "moderate", true),
            COMPLETION_COMPROMISED
        );
        assert_eq!(
            classify_completion(9, TREND_IMPROVING, "moderate", true),
            COMPLETION_PARTIAL
        );
        assert_eq!(
            classify_completion(10, TREND_IMPROVING, "moderate", true),
            COMPLETION_MISSED
        );
        assert_eq!(
            classify_completion(10, TREND_REGRESSING, "moderate", true),
            COMPLETION_PARTIAL
        );
        assert_eq!(
            classify_completion(10, TREND_IMPROVING, "severe", true),
            COMPLETION_PARTIAL
        );
        assert_eq!(
            classify_completion(10, TREND_IMPROVING, "moderate", false),
            COMPLETION_PARTIAL
        );
    }

    #[test]
    fn action_from_completion_maps_outcomes_and_handles_invalid_inputs_deterministically() {
        assert_eq!(
            action_from_completion(COMPLETION_CLEAN, ACTION_MAINTAIN, 2, 0.1),
            ACTION_OVERLOAD
        );
        assert_eq!(
            action_from_completion(COMPLETION_CLEAN, ACTION_MAINTAIN, 3, 0.4),
            ACTION_MAINTAIN
        );
        assert_eq!(
            action_from_completion(COMPLETION_COMPROMISED, ACTION_OVERLOAD, 2, 0.9),
            ACTION_MAINTAIN
        );
        assert_eq!(
            action_from_completion(COMPLETION_PARTIAL, ACTION_OVERLOAD, 2, 0.9),
            ACTION_REGRESS
        );
        assert_eq!(
            action_from_completion(COMPLETION_MISSED, ACTION_OVERLOAD, 2, 0.9),
            ACTION_SWAP
        );
        assert_eq!(
            action_from_completion("unknown", ACTION_REGRESS, 3, 0.4),
            ACTION_REGRESS
        );
        assert_eq!(
            action_from_completion("unknown", "invalid", 3, 0.4),
            ACTION_MAINTAIN
        );
    }

    #[test]
    fn progression_helpers_emit_engine_owned_shapes() {
        let summary = progression_action_summary("bench-press", ACTION_OVERLOAD, TREND_IMPROVING);
        let patch =
            progression_state_patch("bench-press", ACTION_OVERLOAD, TREND_IMPROVING, 102.5, 6);

        assert_eq!(
            summary,
            json!({
                "exerciseId": "bench-press",
                "action": "overload",
                "trend": "improving",
            })
        );
        assert_eq!(
            patch,
            json!({
                "progressionState": {
                    "bench-press": {
                        "currentAction": "overload",
                        "trend": "improving",
                        "lastSuccessfulLoad": {
                            "weight": 102.5,
                            "reps": 6,
                        },
                    }
                }
            })
        );
    }
}
