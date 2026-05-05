use super::{build_replay_receipt, derived_input_hash, derived_output_hash};
use crate::boundary::{TypedEngineInput, TypedEngineOutput, TypedEngineResult};
use crate::domain::{
    AdvanceCycleAward, AdvanceCyclePreview, AdvanceCycleRankBreakdown, AdvanceCycleResult,
    DecisionInputRef, DecisionLogEntry, DecisionStepType, FatigueLevel, GamificationState,
    ProgressionTrend, SessionOutcomeClassification, StatePatch,
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
    let completion_count = input
        .request
        .get("completedSessionCount")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(0);
    let missed_count = input
        .request
        .get("missedSessionCount")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .unwrap_or(0);
    let next_cycle_request = build_personalized_next_cycle_request(
        input,
        recommended_class_choice,
        season_rank,
        completion_rate,
        adherence,
        progression,
        recovery,
        consistency,
        completion_count,
        missed_count,
    );
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
        decision_log: vec![
            DecisionLogEntry {
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
            },
            DecisionLogEntry {
                step_type: DecisionStepType::Blend,
                rule_id: "advance_cycle_next_blend_retention_v1".to_string(),
                inputs_used: vec![DecisionInputRef {
                    path: "request.currentCycleRequest.selectedPrograms".to_string(),
                    stable_id: None,
                }],
                candidate_id: None,
                computed_value: Some(number_from_f64(score)),
                outcome: if input.request.get("currentCycleRequest").is_some() {
                    "selected programs retained and reweighted".to_string()
                } else {
                    "legacy generic next-cycle request retained".to_string()
                },
                details: Some(json!({
                    "currentCycleRequestPresent": input.request.get("currentCycleRequest").is_some(),
                    "seasonRank": season_rank,
                })),
            },
            DecisionLogEntry {
                step_type: DecisionStepType::StateUpdate,
                rule_id: "advance_cycle_next_fatigue_adjustment_v1".to_string(),
                inputs_used: vec![
                    DecisionInputRef {
                        path: "request.currentCycleRequest.profile.fatiguePreference".to_string(),
                        stable_id: None,
                    },
                    DecisionInputRef {
                        path: "request.recovery".to_string(),
                        stable_id: None,
                    },
                    DecisionInputRef {
                        path: "request.completedSessionCount".to_string(),
                        stable_id: None,
                    },
                    DecisionInputRef {
                        path: "request.missedSessionCount".to_string(),
                        stable_id: None,
                    },
                ],
                candidate_id: None,
                computed_value: Some(number_from_f64(recovery)),
                outcome: "fatigue preference carried forward conservatively".to_string(),
                details: Some(json!({
                    "completedSessionCount": completion_count,
                    "missedSessionCount": missed_count,
                    "recovery": recovery,
                })),
            },
            DecisionLogEntry {
                step_type: DecisionStepType::Blend,
                rule_id: "advance_cycle_next_injury_carry_forward_v1".to_string(),
                inputs_used: vec![DecisionInputRef {
                    path: "request.currentCycleRequest.profile.injuryMuscleGroupSlugs".to_string(),
                    stable_id: None,
                }],
                candidate_id: None,
                computed_value: None,
                outcome: "injury slugs preserved in next-cycle profile".to_string(),
                details: Some(json!({
                    "injuryMuscleGroupSlugs": next_cycle_request
                        .get("profile")
                        .and_then(Value::as_object)
                        .and_then(|profile| profile.get("injuryMuscleGroupSlugs"))
                        .cloned()
                        .unwrap_or_else(|| json!([])),
                })),
            },
            DecisionLogEntry {
                step_type: DecisionStepType::Blend,
                rule_id: "advance_cycle_next_baseline_carry_forward_v1".to_string(),
                inputs_used: vec![DecisionInputRef {
                    path: "request.programAdaptationInputs".to_string(),
                    stable_id: None,
                }],
                candidate_id: None,
                computed_value: None,
                outcome: "program adaptation inputs preserved for initialize_cycle compatibility"
                    .to_string(),
                details: Some(json!({
                    "hasProgramAdaptationInputs": next_cycle_request
                        .get("programAdaptationInputs")
                        .is_some(),
                })),
            },
        ],
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

fn current_cycle_request<'a>(input: &'a TypedEngineInput) -> Option<&'a Value> {
    input.request.get("currentCycleRequest")
}

fn build_personalized_next_cycle_request(
    input: &TypedEngineInput,
    recommended_class_choice: &str,
    season_rank: &str,
    completion_rate: f64,
    adherence: f64,
    progression: f64,
    recovery: f64,
    consistency: f64,
    completed_session_count: u32,
    missed_session_count: u32,
) -> Value {
    let Some(current_cycle_request) = current_cycle_request(input) else {
        return build_generic_next_cycle_request(recommended_class_choice);
    };

    let Some(current_cycle_request) = current_cycle_request.as_object() else {
        return build_generic_next_cycle_request(recommended_class_choice);
    };

    let mut next_cycle_request = Value::Object(current_cycle_request.clone());

    if let Some(profile) = next_cycle_request
        .get_mut("profile")
        .and_then(Value::as_object_mut)
    {
        let fatigue_preference = profile
            .get("fatiguePreference")
            .and_then(Value::as_str)
            .unwrap_or("moderate");
        profile.insert(
            "fatiguePreference".to_string(),
            json!(next_fatigue_preference(
                fatigue_preference,
                season_rank,
                recovery,
                completed_session_count,
                missed_session_count
            )),
        );

        if !profile.contains_key("classChoice") {
            profile.insert("classChoice".to_string(), json!(recommended_class_choice));
        }
    }

    if let Some(selected_programs) = next_cycle_request
        .get_mut("selectedPrograms")
        .and_then(Value::as_array_mut)
    {
        normalize_selected_program_weights(
            selected_programs,
            season_rank,
            completion_rate,
            adherence,
            progression,
            recovery,
            consistency,
            completed_session_count,
            missed_session_count,
        );
    }

    let program_adaptation_inputs = input
        .request
        .get("programAdaptationInputs")
        .cloned()
        .or_else(|| {
            current_cycle_request
                .get("programAdaptationInputs")
                .cloned()
        });
    if let Some(program_adaptation_inputs) = program_adaptation_inputs {
        next_cycle_request
            .as_object_mut()
            .expect("cloned request should remain an object")
            .insert(
                "programAdaptationInputs".to_string(),
                program_adaptation_inputs,
            );
    }

    next_cycle_request
}

fn build_generic_next_cycle_request(recommended_class_choice: &str) -> Value {
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

fn normalize_selected_program_weights(
    selected_programs: &mut [Value],
    season_rank: &str,
    completion_rate: f64,
    adherence: f64,
    progression: f64,
    recovery: f64,
    consistency: f64,
    completed_session_count: u32,
    missed_session_count: u32,
) {
    if selected_programs.is_empty() {
        return;
    }

    let mut weights = Vec::with_capacity(selected_programs.len());
    for (index, program) in selected_programs.iter().enumerate() {
        let base_weight = program
            .get("weight")
            .and_then(Value::as_f64)
            .unwrap_or(0.0)
            .max(0.0);
        let is_adaptive = program
            .get("templateKind")
            .and_then(Value::as_str)
            .is_some_and(|kind| kind == "challenge_progression")
            || program.get("adaptiveTemplate").is_some();
        weights.push(adjusted_program_weight(
            base_weight,
            index,
            is_adaptive,
            season_rank,
            completion_rate,
            adherence,
            progression,
            recovery,
            consistency,
            completed_session_count,
            missed_session_count,
        ));
    }

    let total_weight: f64 = weights.iter().sum();
    let equal_weight = 1.0 / selected_programs.len() as f64;
    let mut running_total = 0.0;
    let last_index = selected_programs.len() - 1;

    for (index, program) in selected_programs.iter_mut().enumerate() {
        let normalized = if total_weight <= f64::EPSILON {
            equal_weight
        } else if index == last_index {
            (1.0_f64 - running_total).max(0.0_f64)
        } else {
            let raw = weights[index] / total_weight;
            round_weight(raw)
        };

        let normalized = if index == last_index {
            (1.0_f64 - running_total).max(0.0_f64)
        } else {
            round_weight(normalized)
        };
        running_total += normalized;
        if let Some(object) = program.as_object_mut() {
            object.insert("weight".to_string(), json!(normalized));
        }
    }
}

fn adjusted_program_weight(
    base_weight: f64,
    index: usize,
    is_adaptive: bool,
    season_rank: &str,
    completion_rate: f64,
    adherence: f64,
    progression: f64,
    recovery: f64,
    consistency: f64,
    completed_session_count: u32,
    missed_session_count: u32,
) -> f64 {
    let rank_bias = match season_rank {
        "S" => 0.12,
        "A" => 0.08,
        "B" => 0.0,
        "C" => -0.07,
        _ => -0.12,
    };
    let signal_bias = ((completion_rate - 0.5) * 0.07)
        + ((adherence - 0.5) * 0.06)
        + ((progression - 0.5) * 0.05)
        + ((recovery - 0.5) * 0.06)
        + ((consistency - 0.5) * 0.04)
        - if missed_session_count > completed_session_count {
            0.05
        } else {
            0.0
        };
    let adaptive_bias = if is_adaptive {
        0.12 + if recovery < 0.6 { 0.04 } else { 0.0 }
    } else {
        0.0
    };
    let lead_program_bias = if index == 0 && adherence >= 0.75 {
        0.03
    } else {
        0.0
    };
    let low_rank_penalty = if !is_adaptive && matches!(season_rank, "C" | "D") {
        0.05
    } else {
        0.0
    };

    (base_weight
        * (1.0 + rank_bias + signal_bias + adaptive_bias + lead_program_bias - low_rank_penalty))
        .clamp(0.05, 1.0)
}

fn round_weight(value: f64) -> f64 {
    ((value * 1000.0).round() / 1000.0).clamp(0.0, 1.0)
}

fn next_fatigue_preference(
    current: &str,
    season_rank: &str,
    recovery: f64,
    completed_session_count: u32,
    missed_session_count: u32,
) -> String {
    if current == "high" {
        return "high".to_string();
    }

    if missed_session_count > completed_session_count {
        return "high".to_string();
    }

    if recovery < 0.45 || matches!(season_rank, "C" | "D") {
        return "high".to_string();
    }

    if current == "low" && recovery < 0.75 {
        return "moderate".to_string();
    }

    current.to_string()
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
