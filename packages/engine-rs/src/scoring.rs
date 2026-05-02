use serde_json::{json, Value};

use crate::derivations::{
    class_bias_score, fatigue_compatibility, novelty_score, plan_progression_need, round_f64,
    value_as_f64, value_as_i64,
};
use crate::rng::seeded_fraction;
use crate::rng::seeded_index;

#[derive(Clone, Debug, PartialEq)]
pub struct ScoreBreakdown {
    pub progression_need: f64,
    pub fatigue_compatibility: f64,
    pub class_bias: f64,
    pub novelty: f64,
}

impl ScoreBreakdown {
    pub fn total(&self) -> f64 {
        round_f64(
            self.progression_need * 0.45
                + self.fatigue_compatibility * 0.35
                + self.class_bias
                + self.novelty,
            2,
        )
    }

    pub fn as_value(&self) -> Value {
        json!({
            "progressionNeed": self.progression_need,
            "fatigueCompatibility": self.fatigue_compatibility,
            "classBias": self.class_bias,
            "novelty": self.novelty,
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct CandidateSelection<'a> {
    pub candidate: &'a Value,
    pub breakdown: ScoreBreakdown,
    pub total: f64,
    pub eligible_count: usize,
    pub tie_break_index: Option<usize>,
}

#[derive(Clone, Debug, PartialEq)]
struct ProgressionContext {
    trend: String,
    current_action: String,
    freshness: f64,
    consecutive_successful_completions: i64,
    consecutive_stall_or_regression_count: i64,
    swap_recommendation_count: i64,
}

fn muscle_fatigue_for_candidate(candidate: &Value, state_snapshot: &Value) -> f64 {
    let movement_pattern = candidate
        .get("movementPattern")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let readiness = state_snapshot
        .get("readinessState")
        .and_then(|value| value.get("muscleFatigue"))
        .and_then(Value::as_object);

    match movement_pattern {
        "push" => readiness
            .and_then(|map| map.get("chest"))
            .and_then(value_as_f64)
            .unwrap_or(0.0),
        "pull" => readiness
            .and_then(|map| map.get("back"))
            .and_then(value_as_f64)
            .unwrap_or(0.0),
        _ => readiness
            .and_then(|map| map.values().next())
            .and_then(value_as_f64)
            .unwrap_or(0.0),
    }
}

fn systemic_fatigue_label(state_snapshot: &Value) -> &str {
    state_snapshot
        .get("readinessState")
        .and_then(|value| value.get("systemicFatigue"))
        .and_then(Value::as_str)
        .unwrap_or("moderate")
}

fn progression_context(candidate: &Value, state_snapshot: &Value) -> ProgressionContext {
    let exercise_id = candidate
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let records = state_snapshot
        .get("progressionState")
        .and_then(|value| value.get("records"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for record in records {
        if record
            .get("exerciseId")
            .and_then(Value::as_str)
            .is_some_and(|value| value == exercise_id)
        {
            let trend = record
                .get("trend")
                .and_then(Value::as_str)
                .unwrap_or("stalled")
                .to_string();
            let current_action = record
                .get("currentAction")
                .and_then(Value::as_str)
                .unwrap_or("maintain")
                .to_string();
            let freshness = record
                .get("previousPerformanceReference")
                .and_then(|value| value.get("reps"))
                .and_then(value_as_i64)
                .map(|reps| if reps >= 5 { 1.0 } else { 0.5 })
                .unwrap_or(0.5);
            return ProgressionContext {
                trend,
                current_action,
                freshness,
                consecutive_successful_completions: record
                    .get("consecutiveSuccessfulCompletions")
                    .and_then(value_as_i64)
                    .unwrap_or(0),
                consecutive_stall_or_regression_count: record
                    .get("consecutiveStallOrRegressionCount")
                    .and_then(value_as_i64)
                    .unwrap_or(0),
                swap_recommendation_count: record
                    .get("swapRecommendationCount")
                    .and_then(value_as_i64)
                    .unwrap_or(0),
            };
        }
    }

    ProgressionContext {
        trend: "stalled".to_string(),
        current_action: "maintain".to_string(),
        freshness: 0.5,
        consecutive_successful_completions: 0,
        consecutive_stall_or_regression_count: 0,
        swap_recommendation_count: 0,
    }
}

fn missed_session_penalty(state_snapshot: &Value) -> f64 {
    let gamification = state_snapshot
        .get("gamificationState")
        .and_then(Value::as_object);
    let missed_session_count = gamification
        .and_then(|map| map.get("missedSessionCount"))
        .and_then(value_as_i64)
        .unwrap_or(0);
    let last_outcome = gamification
        .and_then(|map| map.get("lastAdherenceOutcomeClassification"))
        .and_then(Value::as_str)
        .unwrap_or("complete_clean");

    let missed_count_penalty: f64 = if missed_session_count >= 3 {
        0.08
    } else if missed_session_count >= 1 {
        0.04
    } else {
        0.0
    };
    let missed_outcome_penalty: f64 = if last_outcome == "missed" { 0.04 } else { 0.0 };

    round_f64(
        (missed_count_penalty + missed_outcome_penalty).min(0.12_f64),
        2,
    )
}

pub fn score_candidate(
    candidate: &Value,
    state_snapshot: &Value,
    policy_snapshot: &Value,
    seed: &str,
    cycle_index: i64,
) -> ScoreBreakdown {
    let progression = progression_context(candidate, state_snapshot);
    let progression_pressure_penalty = if progression.consecutive_stall_or_regression_count >= 4 {
        0.12
    } else if progression.consecutive_stall_or_regression_count >= 2 {
        0.06
    } else {
        0.0
    } + if progression.swap_recommendation_count >= 2 {
        0.06
    } else if progression.swap_recommendation_count >= 1 {
        0.03
    } else {
        0.0
    };
    let success_bias_bonus = if progression.trend == "improving"
        && progression.consecutive_successful_completions >= 3
    {
        0.03
    } else {
        0.0
    };
    let progression_need = round_f64(
        (plan_progression_need(
            &progression.trend,
            &progression.current_action,
            progression.freshness,
        ) - progression_pressure_penalty
            + success_bias_bonus)
            .clamp(0.0, 1.0),
        2,
    );
    let muscle_fatigue = muscle_fatigue_for_candidate(candidate, state_snapshot);
    let fatigue_compatibility = round_f64(
        (fatigue_compatibility(systemic_fatigue_label(state_snapshot), muscle_fatigue)
            - missed_session_penalty(state_snapshot))
        .clamp(0.0, 1.0),
        2,
    );

    let class_bias = policy_snapshot
        .get("classArchetypeBias")
        .and_then(value_as_f64)
        .map(class_bias_score)
        .unwrap_or(0.0);

    let novelty_budget = policy_snapshot
        .get("noveltyBudget")
        .and_then(value_as_f64)
        .unwrap_or(0.0);
    let candidate_id = candidate
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let seeded_fraction = seeded_fraction(seed, "novelty", cycle_index, candidate_id);
    let novelty = novelty_score(novelty_budget, seeded_fraction);

    ScoreBreakdown {
        progression_need,
        fatigue_compatibility,
        class_bias,
        novelty,
    }
}

pub fn score_total(breakdown: &ScoreBreakdown) -> f64 {
    breakdown.total()
}

pub fn score_entry(candidate_id: &str, breakdown: &ScoreBreakdown, outcome: &str) -> Value {
    json!({
        "stepType": "score",
        "ruleId": "soft_scoring",
        "candidateId": candidate_id,
        "computedValue": breakdown.total(),
        "breakdown": breakdown.as_value(),
        "outcome": outcome,
    })
}

pub fn rank_candidates<'a>(
    candidates: &'a [Value],
    state_snapshot: &Value,
    policy_snapshot: &Value,
    seed: &str,
    cycle_index: i64,
) -> Vec<(&'a Value, ScoreBreakdown, f64)> {
    let mut ranked = candidates
        .iter()
        .map(|candidate| {
            let breakdown = score_candidate(
                candidate,
                state_snapshot,
                policy_snapshot,
                seed,
                cycle_index,
            );
            let total = score_total(&breakdown);
            (candidate, breakdown, total)
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|left, right| {
        right
            .2
            .partial_cmp(&left.2)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                let left_id = left.0.get("id").and_then(Value::as_str).unwrap_or_default();
                let right_id = right
                    .0
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                left_id.cmp(right_id)
            })
    });

    ranked
}

pub fn pick_best_candidate<'a>(
    candidates: &'a [Value],
    state_snapshot: &Value,
    policy_snapshot: &Value,
    seed: &str,
    cycle_index: i64,
) -> Option<(&'a Value, ScoreBreakdown, f64)> {
    select_best_candidate_with_trace(
        candidates,
        state_snapshot,
        policy_snapshot,
        seed,
        cycle_index,
    )
    .map(|selection| (selection.candidate, selection.breakdown, selection.total))
}

pub fn select_best_candidate_with_trace<'a>(
    candidates: &'a [Value],
    state_snapshot: &Value,
    policy_snapshot: &Value,
    seed: &str,
    cycle_index: i64,
) -> Option<CandidateSelection<'a>> {
    let ranked = rank_candidates(
        candidates,
        state_snapshot,
        policy_snapshot,
        seed,
        cycle_index,
    );
    let best = ranked.first()?;
    let top_score = best.2;
    let band = policy_snapshot
        .get("seededTieBreakBand")
        .and_then(value_as_f64)
        .unwrap_or(0.05);

    let mut eligible = ranked
        .into_iter()
        .filter(|entry| (top_score - entry.2).abs() <= band)
        .collect::<Vec<_>>();
    let eligible_count = eligible.len();

    if eligible_count == 1 {
        let (candidate, breakdown, total) = eligible
            .into_iter()
            .next()
            .expect("eligible candidate should exist");
        return Some(CandidateSelection {
            candidate,
            breakdown,
            total,
            eligible_count,
            tie_break_index: None,
        });
    }

    eligible.sort_by(|left, right| {
        let left_id = left.0.get("id").and_then(Value::as_str).unwrap_or_default();
        let right_id = right
            .0
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default();
        left_id.cmp(right_id)
    });

    let index = seeded_index(seed, "tie_break", cycle_index, "candidate", eligible.len());
    let (candidate, breakdown, total) = eligible.into_iter().nth(index)?;
    Some(CandidateSelection {
        candidate,
        breakdown,
        total,
        eligible_count,
        tie_break_index: Some(index),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn candidate(id: &str, movement_pattern: &str) -> Value {
        json!({
            "id": id,
            "movementPattern": movement_pattern,
        })
    }

    fn state_snapshot() -> Value {
        json!({
            "readinessState": {
                "systemicFatigue": "moderate",
                "muscleFatigue": {
                    "chest": 50.0,
                    "back": 450.0
                }
            },
            "gamificationState": {
                "xp": 140,
                "level": 3,
                "adherenceStreak": 6,
                "completedSessionCount": 12,
                "missedSessionCount": 0,
                "lastAdherenceOutcomeClassification": "complete_clean",
                "lastAwardedAt": "2026-02-10T10:00:00.000Z"
            },
            "progressionState": {
                "records": []
            }
        })
    }

    fn policy_snapshot() -> Value {
        json!({
            "classArchetypeBias": 0.30,
            "noveltyBudget": 1.0,
            "seededTieBreakBand": 0.05
        })
    }

    #[test]
    fn score_breakdown_total_and_as_value_match_expected_shape() {
        let breakdown = ScoreBreakdown {
            progression_need: 0.80,
            fatigue_compatibility: 0.60,
            class_bias: 0.10,
            novelty: 0.02,
        };

        assert_eq!(
            breakdown.as_value(),
            json!({
                "progressionNeed": 0.80,
                "fatigueCompatibility": 0.60,
                "classBias": 0.10,
                "novelty": 0.02,
            })
        );
        assert!((score_total(&breakdown) - 0.69).abs() < 1e-9);
        assert_eq!(
            score_entry("bench-press", &breakdown, "kept"),
            json!({
                "stepType": "score",
                "ruleId": "soft_scoring",
                "candidateId": "bench-press",
                "computedValue": 0.69,
                "breakdown": {
                    "progressionNeed": 0.80,
                    "fatigueCompatibility": 0.60,
                    "classBias": 0.10,
                    "novelty": 0.02,
                },
                "outcome": "kept",
            })
        );
    }

    #[test]
    fn score_candidate_uses_push_and_pull_fatigue_inputs_with_bounded_bias_and_novelty() {
        let state_snapshot = state_snapshot();
        let policy_snapshot = policy_snapshot();

        let push = score_candidate(
            &candidate("push-a", "push"),
            &state_snapshot,
            &policy_snapshot,
            "seed-1",
            0,
        );
        let pull = score_candidate(
            &candidate("pull-a", "pull"),
            &state_snapshot,
            &policy_snapshot,
            "seed-1",
            0,
        );

        assert_eq!(push.progression_need, 0.85);
        assert_eq!(push.fatigue_compatibility, 0.82);
        assert_eq!(push.class_bias, 0.15);
        assert_eq!(push.novelty, 0.02);
        assert_eq!(pull.fatigue_compatibility, 0.64);
        assert_eq!(pull.class_bias, 0.15);
        assert_eq!(pull.novelty, 0.02);
        assert!(push.total() > pull.total());
    }

    #[test]
    fn rank_candidates_orders_by_score_then_uses_stable_id_fallback() {
        let state_snapshot = state_snapshot();
        let policy_snapshot = policy_snapshot();
        let candidates = vec![
            candidate("alpha", "push"),
            candidate("beta", "push"),
            candidate("gamma", "pull"),
        ];

        let ranked = rank_candidates(&candidates, &state_snapshot, &policy_snapshot, "seed-1", 0);
        let ranked_ids = ranked
            .into_iter()
            .map(|(candidate, _, total)| {
                (
                    candidate
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default(),
                    format!("{total:.2}"),
                )
            })
            .collect::<Vec<_>>();

        assert_eq!(
            ranked_ids,
            vec![
                ("alpha", "0.84".to_string()),
                ("beta", "0.84".to_string()),
                ("gamma", "0.78".to_string()),
            ]
        );
    }

    #[test]
    fn pick_best_candidate_respects_the_seeded_band_and_is_deterministic_for_identical_input() {
        let state_snapshot = state_snapshot();
        let policy_snapshot = policy_snapshot();
        let candidates = vec![
            candidate("alpha", "push"),
            candidate("beta", "push"),
            candidate("gamma", "pull"),
        ];

        let first =
            pick_best_candidate(&candidates, &state_snapshot, &policy_snapshot, "seed-0", 0)
                .expect("expected a best candidate");
        let second =
            pick_best_candidate(&candidates, &state_snapshot, &policy_snapshot, "seed-0", 0)
                .expect("expected a best candidate");

        assert_eq!(first.0.get("id").and_then(Value::as_str), Some("alpha"));
        assert_eq!(second.0.get("id").and_then(Value::as_str), Some("alpha"));
        assert_eq!(first.2, second.2);
        assert_eq!(format!("{:.2}", first.2), "0.84");
    }

    #[test]
    fn score_candidate_penalizes_repeated_stalls_and_swap_pressure() {
        let baseline_state = state_snapshot();
        let pressured_state = json!({
            "readinessState": {
                "systemicFatigue": "moderate",
                "muscleFatigue": {
                    "chest": 50.0,
                    "back": 450.0
                }
            },
            "gamificationState": {
                "xp": 140,
                "level": 3,
                "adherenceStreak": 6,
                "completedSessionCount": 12,
                "missedSessionCount": 0,
                "lastAdherenceOutcomeClassification": "complete_clean",
                "lastAwardedAt": "2026-02-10T10:00:00.000Z"
            },
            "progressionState": {
                "records": [{
                    "exerciseId": "push-a",
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
                }]
            }
        });
        let policy_snapshot = policy_snapshot();

        let baseline = score_candidate(
            &candidate("push-a", "push"),
            &baseline_state,
            &policy_snapshot,
            "seed-1",
            0,
        );
        let pressured = score_candidate(
            &candidate("push-a", "push"),
            &pressured_state,
            &policy_snapshot,
            "seed-1",
            0,
        );

        assert!(
            pressured.progression_need < baseline.progression_need,
            "repeated stalls and swap pressure should lower progression need"
        );
    }

    #[test]
    fn score_candidate_penalizes_recent_missed_session_history() {
        let baseline_state = state_snapshot();
        let missed_state = json!({
            "readinessState": {
                "systemicFatigue": "moderate",
                "muscleFatigue": {
                    "chest": 50.0,
                    "back": 450.0
                }
            },
            "gamificationState": {
                "xp": 140,
                "level": 3,
                "adherenceStreak": 0,
                "completedSessionCount": 12,
                "missedSessionCount": 3,
                "lastAdherenceOutcomeClassification": "missed",
                "lastAwardedAt": "2026-02-10T10:00:00.000Z"
            },
            "progressionState": {
                "records": []
            }
        });
        let policy_snapshot = policy_snapshot();

        let baseline = score_candidate(
            &candidate("push-a", "push"),
            &baseline_state,
            &policy_snapshot,
            "seed-1",
            0,
        );
        let missed = score_candidate(
            &candidate("push-a", "push"),
            &missed_state,
            &policy_snapshot,
            "seed-1",
            0,
        );

        assert!(
            missed.fatigue_compatibility < baseline.fatigue_compatibility,
            "missed-session history should reduce fatigue compatibility"
        );
    }
}
