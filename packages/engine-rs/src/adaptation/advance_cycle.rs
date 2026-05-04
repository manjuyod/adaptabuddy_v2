use super::{build_replay_receipt, derived_input_hash, derived_output_hash};
use crate::boundary::{TypedEngineInput, TypedEngineOutput, TypedEngineResult};
use crate::domain::{
    AdvanceCycleAward, AdvanceCyclePreview, AdvanceCycleRankBreakdown, AdvanceCycleResult,
    DecisionLogEntry, DecisionStepType, FatigueLevel, GamificationState, ProgressionTrend,
    SessionOutcomeClassification, StatePatch,
};
use serde_json::{json, Number, Value};

const SIGNAL_DEFAULT: f64 = 0.65;
const SIGNAL_WEIGHTS: [f64; 6] = [0.35, 0.2, 0.15, 0.15, 0.1, 0.05];

pub fn advance_cycle(input: &TypedEngineInput) -> TypedEngineOutput {
    let season_index = input
        .request
        .get("seasonIndex")
        .and_then(|value| value.as_u64())
        .unwrap_or(1) as u32;

    let completion_rate = signal_from_request(input, "completionRate", SIGNAL_DEFAULT);
    let adherence = signal_from_request(input, "adherence", derived_adherence(input));
    let completion_quality = completion_quality_signal(input);
    let progression = signal_from_request(input, "progression", derived_progression(input));
    let recovery = signal_from_request(input, "recovery", derived_recovery(input));
    let consistency = signal_from_request(input, "consistency", derived_consistency(input));

    let score = weighted_score([
        completion_rate,
        adherence,
        completion_quality,
        progression,
        recovery,
        consistency,
    ]);
    let season_rank = season_rank(score);
    let recommended_class_choice = recommended_class_choice(season_rank);
    let awards = awards_for_rank(season_rank, score);
    let award_xp = awards.iter().map(|award| award.xp).sum::<u32>();
    let next_cycle_request = build_next_cycle_request(recommended_class_choice);
    let evolution_patch = build_evolution_patch(input, season_rank, award_xp);
    let next_cycle_preview = AdvanceCyclePreview {
        season_index: season_index + 1,
        season_rank: season_rank.to_string(),
        recommended_class_choice: recommended_class_choice.to_string(),
        next_cycle_request: next_cycle_request.clone(),
    };
    let season_summary =
        format!("Season {season_index} scored {score:.2} and ranked {season_rank}");

    let result = TypedEngineResult::AdvanceCycle(AdvanceCycleResult {
        season_index,
        season_summary: season_summary.clone(),
        season_rank: season_rank.to_string(),
        rank_breakdown: AdvanceCycleRankBreakdown {
            completion_rate: number_from_f64(completion_rate),
            adherence: number_from_f64(adherence),
            completion_quality: number_from_f64(completion_quality),
            progression: number_from_f64(progression),
            recovery: number_from_f64(recovery),
            consistency: number_from_f64(consistency),
            score: number_from_f64(score),
        },
        awards: awards.clone(),
        evolution_patch: evolution_patch.clone(),
        next_cycle_request: next_cycle_request.clone(),
        next_cycle_preview,
    });

    let mut output = TypedEngineOutput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        result,
        state_patch: evolution_patch,
        events: vec![],
        decision_log: vec![DecisionLogEntry {
            step_type: DecisionStepType::StateUpdate,
            rule_id: "advance_cycle_rank_score_v1".to_string(),
            inputs_used: vec![],
            candidate_id: None,
            computed_value: Some(number_from_f64(score)),
            outcome: format!("rank={season_rank},score={score:.2},awards={award_xp}"),
            details: Some(json!({
                "seasonRank": season_rank,
                "awardXp": award_xp,
            })),
        }],
        replay_receipt: crate::ReplayReceipt {
            input_hash: String::new(),
            output_hash: String::new(),
            seed_used: String::new(),
            effective_at: String::new(),
            implementation_version: String::new(),
            policy_version: String::new(),
            reference_hash: String::new(),
        },
    };

    let input_hash = derived_input_hash(input);
    let output_hash = derived_output_hash(&output);
    output.replay_receipt = build_replay_receipt(input, input_hash, output_hash);
    output
}

fn signal_from_request(input: &TypedEngineInput, key: &str, fallback: f64) -> f64 {
    input
        .request
        .get(key)
        .and_then(read_signal_value)
        .unwrap_or(fallback)
        .clamp(0.0, 1.0)
}

fn read_signal_value(value: &Value) -> Option<f64> {
    if let Some(number) = value.as_f64() {
        return Some(number);
    }

    let value = value.as_str()?;
    Some(match value {
        "complete_clean" => 1.0,
        "complete_compromised" => 0.8,
        "partial" => 0.5,
        "missed" => 0.1,
        "improving" => 0.85,
        "stalled" => 0.65,
        "regressing" => 0.35,
        "blocked" => 0.15,
        "mild" => 0.85,
        "moderate" => 0.65,
        "severe" => 0.35,
        _ => return None,
    })
}

fn completion_quality_signal(input: &TypedEngineInput) -> f64 {
    if let Some(value) = input.request.get("completionQuality") {
        if let Some(signal) = read_signal_value(value) {
            return signal.clamp(0.0, 1.0);
        }
    }

    match input
        .state_snapshot
        .gamification_state
        .last_adherence_outcome_classification
    {
        SessionOutcomeClassification::CompleteClean => 1.0,
        SessionOutcomeClassification::CompleteCompromised => 0.8,
        SessionOutcomeClassification::Partial => 0.5,
        SessionOutcomeClassification::Missed => 0.1,
    }
}

fn derived_adherence(input: &TypedEngineInput) -> f64 {
    let streak = input
        .state_snapshot
        .gamification_state
        .adherence_streak
        .min(10);
    (0.55 + (streak as f64) * 0.04).min(0.95)
}

fn derived_progression(input: &TypedEngineInput) -> f64 {
    input
        .state_snapshot
        .progression_state
        .records
        .first()
        .map(|record| match record.trend {
            ProgressionTrend::Improving => 0.85,
            ProgressionTrend::Stalled => 0.65,
            ProgressionTrend::Regressing => 0.35,
            ProgressionTrend::Blocked => 0.15,
        })
        .unwrap_or(SIGNAL_DEFAULT)
}

fn derived_recovery(input: &TypedEngineInput) -> f64 {
    match input.state_snapshot.readiness_state.systemic_fatigue {
        FatigueLevel::Mild => 0.85,
        FatigueLevel::Moderate => 0.65,
        FatigueLevel::Severe => 0.35,
    }
}

fn derived_consistency(input: &TypedEngineInput) -> f64 {
    let count = input.state_snapshot.recent_completions.len().min(10) as f64;
    (0.58 + count * 0.03).min(0.95)
}

fn weighted_score(signals: [f64; 6]) -> f64 {
    signals
        .into_iter()
        .zip(SIGNAL_WEIGHTS)
        .map(|(signal, weight)| signal * weight)
        .sum()
}

fn season_rank(score: f64) -> &'static str {
    if score >= 0.92 {
        "S"
    } else if score >= 0.82 {
        "A"
    } else if score >= 0.68 {
        "B"
    } else if score >= 0.52 {
        "C"
    } else {
        "D"
    }
}

fn awards_for_rank(rank: &str, score: f64) -> Vec<AdvanceCycleAward> {
    let award_xp = match rank {
        "S" => 500,
        "A" => 350,
        "B" => 220,
        "C" => 120,
        _ => 60,
    };
    let consistency_bonus = if rank == "S" && score >= 0.95 {
        Some(125)
    } else {
        None
    };

    let mut awards = vec![AdvanceCycleAward {
        award_id: format!("season_{rank}_rank"),
        label: format!("Season {rank} Rank"),
        xp: award_xp,
    }];

    if let Some(bonus_xp) = consistency_bonus {
        awards.push(AdvanceCycleAward {
            award_id: "consistency_bonus".to_string(),
            label: "Consistency Bonus".to_string(),
            xp: bonus_xp,
        });
    }

    awards
}

fn recommended_class_choice(rank: &str) -> &'static str {
    match rank {
        "S" | "A" => "strength",
        _ => "hybrid",
    }
}

fn build_next_cycle_request(recommended_class_choice: &str) -> Value {
    json!({
        "profile": {
            "classChoice": recommended_class_choice,
            "goalBias": "strength",
            "availableDaysPerWeek": 3,
            "fatiguePreference": "moderate",
            "injuryMuscleGroupSlugs": ["shoulders"]
        },
        "macrocycleWeeks": 8,
        "selectedPrograms": [
            {
                "programId": "program-strength",
                "weight": 0.7,
                "days": [
                    {
                        "programDayId": "day-strength-1",
                        "dayIndex": 0,
                        "name": "Strength Day 1",
                        "slots": [
                            {
                                "slotId": "slot-strength-main",
                                "slotIndex": 0,
                                "slotType": "main",
                                "movementPattern": "push",
                                "setsMin": 4,
                                "setsMax": 5,
                                "repsMin": 3,
                                "repsMax": 5,
                                "muscleTargets": {
                                    "chest": 0.6,
                                    "shoulders": 0.4
                                },
                                "tagsRequired": ["compound"]
                            }
                        ]
                    }
                ]
            },
            {
                "programId": "program-hypertrophy",
                "weight": 0.3,
                "days": [
                    {
                        "programDayId": "day-hypertrophy-1",
                        "dayIndex": 0,
                        "name": "Hypertrophy Day 1",
                        "slots": [
                            {
                                "slotId": "slot-hypertrophy-main",
                                "slotIndex": 0,
                                "slotType": "main",
                                "movementPattern": "pull",
                                "setsMin": 3,
                                "setsMax": 4,
                                "repsMin": 8,
                                "repsMax": 12,
                                "muscleTargets": {
                                    "back": 0.8
                                },
                                "tagsRequired": ["compound"]
                            },
                            {
                                "slotId": "slot-hypertrophy-accessory",
                                "slotIndex": 1,
                                "slotType": "accessory",
                                "movementPattern": "push",
                                "setsMin": 2,
                                "setsMax": 3,
                                "repsMin": 10,
                                "repsMax": 15,
                                "muscleTargets": {
                                    "shoulders": 0.6
                                },
                                "tagsRequired": ["hypertrophy"]
                            }
                        ]
                    }
                ]
            }
        ]
    })
}

fn build_evolution_patch(input: &TypedEngineInput, season_rank: &str, award_xp: u32) -> StatePatch {
    let current_gamification = input.state_snapshot.gamification_state.clone();
    let classification = match season_rank {
        "S" | "A" => SessionOutcomeClassification::CompleteClean,
        "B" => SessionOutcomeClassification::CompleteCompromised,
        "C" => SessionOutcomeClassification::Partial,
        _ => SessionOutcomeClassification::Missed,
    };
    let level_delta = if season_rank == "S" { 1 } else { 0 };
    let adherence_streak = if season_rank == "D" {
        current_gamification.adherence_streak.saturating_sub(1)
    } else {
        current_gamification.adherence_streak + 1
    };
    let missed_session_count = if season_rank == "D" {
        current_gamification.missed_session_count + 1
    } else {
        current_gamification.missed_session_count
    };

    StatePatch {
        progression_state: None,
        readiness_state: None,
        gamification_state: Some(GamificationState {
            xp: current_gamification.xp + award_xp,
            level: current_gamification.level + level_delta,
            adherence_streak,
            completed_session_count: current_gamification.completed_session_count + 1,
            missed_session_count,
            last_adherence_outcome_classification: classification,
            last_awarded_at: input.determinism.effective_at.clone(),
        }),
    }
}

fn number_from_f64(value: f64) -> Number {
    Number::from_f64(value).expect("advance_cycle score should be finite")
}
