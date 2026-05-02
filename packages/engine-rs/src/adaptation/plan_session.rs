use crate::boundary::{TypedEngineInput, TypedEngineOutput, TypedEngineResult};
use crate::constraints::{
    candidate_allowed_for_focus, collapse_rejection_for_hard_blocks, hard_block_records,
};
use crate::derivations::{
    recommended_session_id, session_rationale, ACTION_MAINTAIN, ACTION_OVERLOAD, ACTION_REGRESS,
    ACTION_SWAP, TREND_IMPROVING, TREND_REGRESSING, TREND_STALLED,
};
use crate::domain::{
    DecisionInputRef, DecisionLogEntry, DecisionStepType, DeterministicRejection,
    DeterministicRejectionCode, DeterministicRejectionStatus, ExerciseReference, PlanSessionResult,
    ProgressionAction, ProgressionActionSummary, ProgressionTrend, ScoreBreakdown, StatePatch,
};
use crate::scoring::{rank_candidates, score_candidate, select_best_candidate_with_trace};
use serde_json::{json, Map, Number, Value};

use super::{build_replay_receipt, derived_input_hash, derived_output_hash, number_from_f64};

fn requested_focus(input: &TypedEngineInput) -> String {
    input
        .request
        .get("sessionFocus")
        .and_then(Value::as_str)
        .unwrap_or("upper_push")
        .to_string()
}

fn request_microcycle_index(input: &TypedEngineInput) -> i64 {
    input
        .request
        .get("microcycleIndex")
        .and_then(Value::as_i64)
        .unwrap_or(i64::from(
            input.state_snapshot.active_program_state.current_microcycle,
        ))
}

fn request_program_id(input: &TypedEngineInput) -> String {
    input
        .request
        .get("programId")
        .and_then(Value::as_str)
        .unwrap_or(&input.state_snapshot.active_program_state.program_id)
        .to_string()
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

fn focus_family(focus: &str) -> Option<&'static str> {
    match focus {
        "upper_push" | "lower_push" => Some("push"),
        "upper_pull" | "lower_pull" => Some("pull"),
        _ => None,
    }
}

fn focus_region(focus: &str) -> &'static str {
    if focus.starts_with("lower_") {
        "lower"
    } else {
        "upper"
    }
}

fn recommended_movement_family_label(focus: &str, candidate: &ExerciseReference) -> String {
    format!("{}_{}", focus_region(focus), candidate.movement_pattern)
}

fn candidate_value(candidate: &ExerciseReference) -> Value {
    candidate
        .to_value()
        .expect("serializing exercise reference should not fail")
}

fn progression_action_for_plan(
    current_action: &str,
    trend: &str,
    consecutive_successful_completions: u32,
    consecutive_stall_or_regression_count: u32,
    swap_recommendation_count: u32,
    progression_need: f64,
    systemic_fatigue: &str,
    movement_blocked: bool,
) -> &'static str {
    if movement_blocked
        || trend == "blocked"
        || (consecutive_stall_or_regression_count >= 4 && swap_recommendation_count >= 2)
    {
        return ACTION_SWAP;
    }

    if systemic_fatigue == "severe" || trend == TREND_REGRESSING {
        return ACTION_REGRESS;
    }

    if trend == TREND_STALLED {
        return match current_action {
            ACTION_OVERLOAD => ACTION_OVERLOAD,
            ACTION_MAINTAIN => ACTION_MAINTAIN,
            ACTION_REGRESS => ACTION_MAINTAIN,
            ACTION_SWAP => ACTION_MAINTAIN,
            _ => ACTION_MAINTAIN,
        };
    }

    if trend == TREND_IMPROVING {
        if current_action == ACTION_OVERLOAD
            || progression_need >= 0.9
            || consecutive_successful_completions >= 3
        {
            return ACTION_OVERLOAD;
        }

        return ACTION_MAINTAIN;
    }

    ACTION_MAINTAIN
}

fn progression_action_enum(action: &str) -> ProgressionAction {
    match action {
        ACTION_OVERLOAD => ProgressionAction::Overload,
        ACTION_MAINTAIN => ProgressionAction::Maintain,
        ACTION_REGRESS => ProgressionAction::Regress,
        ACTION_SWAP => ProgressionAction::Swap,
        _ => ProgressionAction::Maintain,
    }
}

fn action_label(action: &ProgressionAction) -> &'static str {
    match action {
        ProgressionAction::Overload => ACTION_OVERLOAD,
        ProgressionAction::Maintain => ACTION_MAINTAIN,
        ProgressionAction::Regress => ACTION_REGRESS,
        ProgressionAction::Swap => ACTION_SWAP,
    }
}

fn trend_enum(trend: &str) -> ProgressionTrend {
    match trend {
        TREND_IMPROVING => ProgressionTrend::Improving,
        TREND_STALLED => ProgressionTrend::Stalled,
        TREND_REGRESSING => ProgressionTrend::Regressing,
        "blocked" => ProgressionTrend::Blocked,
        _ => ProgressionTrend::Stalled,
    }
}

fn current_record_action(input: &TypedEngineInput, exercise_id: &str) -> String {
    input
        .state_snapshot
        .progression_state
        .records
        .iter()
        .find(|record| record.exercise_id == exercise_id)
        .map(|record| {
            match record.current_action {
                ProgressionAction::Overload => ACTION_OVERLOAD,
                ProgressionAction::Maintain => ACTION_MAINTAIN,
                ProgressionAction::Regress => ACTION_REGRESS,
                ProgressionAction::Swap => ACTION_SWAP,
            }
            .to_string()
        })
        .unwrap_or_else(|| ACTION_MAINTAIN.to_string())
}

fn current_record_trend(input: &TypedEngineInput, exercise_id: &str) -> String {
    input
        .state_snapshot
        .progression_state
        .records
        .iter()
        .find(|record| record.exercise_id == exercise_id)
        .map(|record| match record.trend {
            ProgressionTrend::Improving => TREND_IMPROVING,
            ProgressionTrend::Stalled => TREND_STALLED,
            ProgressionTrend::Regressing => TREND_REGRESSING,
            ProgressionTrend::Blocked => "blocked",
        })
        .unwrap_or(TREND_STALLED)
        .to_string()
}

fn current_record_success_count(input: &TypedEngineInput, exercise_id: &str) -> u32 {
    input
        .state_snapshot
        .progression_state
        .records
        .iter()
        .find(|record| record.exercise_id == exercise_id)
        .map(|record| record.consecutive_successful_completions)
        .unwrap_or(0)
}

fn current_record_stall_count(input: &TypedEngineInput, exercise_id: &str) -> u32 {
    input
        .state_snapshot
        .progression_state
        .records
        .iter()
        .find(|record| record.exercise_id == exercise_id)
        .map(|record| record.consecutive_stall_or_regression_count)
        .unwrap_or(0)
}

fn current_record_swap_count(input: &TypedEngineInput, exercise_id: &str) -> u32 {
    input
        .state_snapshot
        .progression_state
        .records
        .iter()
        .find(|record| record.exercise_id == exercise_id)
        .map(|record| record.swap_recommendation_count)
        .unwrap_or(0)
}

fn plan_result_action(
    candidate: &ExerciseReference,
    input: &TypedEngineInput,
    systemic_fatigue: &str,
    movement_blocked: bool,
    progression_need: f64,
) -> ProgressionActionSummary {
    let current_action = current_record_action(input, &candidate.id);
    let trend = current_record_trend(input, &candidate.id);
    let consecutive_successful_completions = current_record_success_count(input, &candidate.id);
    let consecutive_stall_or_regression_count = current_record_stall_count(input, &candidate.id);
    let swap_recommendation_count = current_record_swap_count(input, &candidate.id);
    let action = progression_action_for_plan(
        &current_action,
        &trend,
        consecutive_successful_completions,
        consecutive_stall_or_regression_count,
        swap_recommendation_count,
        progression_need,
        systemic_fatigue,
        movement_blocked,
    );

    ProgressionActionSummary {
        exercise_id: candidate.id.clone(),
        action: progression_action_enum(action),
        trend: trend_enum(&trend),
    }
}

fn deterministic_rejection(
    input: &TypedEngineInput,
    requested_focus: &str,
    allow_cross_family_fallback: bool,
    hard_block_records: Vec<Value>,
    blocked: Vec<String>,
    rejection_code: &str,
) -> TypedEngineOutput {
    let rejection = DeterministicRejection {
        status: DeterministicRejectionStatus::DeterministicRejection,
        rejection_code: match rejection_code {
            "no_valid_candidates" => DeterministicRejectionCode::NoValidCandidates,
            "fatigue_blocked" => DeterministicRejectionCode::FatigueBlocked,
            _ => DeterministicRejectionCode::InjuryBlocked,
        },
        blocked_candidate_ids: blocked.clone(),
    };

    let (preferred_candidates, surviving_candidates) = candidate_scope_sets(
        input,
        requested_focus,
        &blocked,
        allow_cross_family_fallback,
    );
    let decision_log = vec![
        scope_entry(
            input,
            requested_focus,
            &preferred_candidates,
            &surviving_candidates,
        ),
        filter_entry(
            input,
            hard_block_records,
            surviving_candidates
                .iter()
                .map(|candidate| candidate.id.clone())
                .collect(),
        ),
    ];

    let mut typed_output = TypedEngineOutput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        result: TypedEngineResult::DeterministicRejection(rejection),
        state_patch: StatePatch::default(),
        events: Vec::new(),
        decision_log,
        replay_receipt: build_replay_receipt(input, String::new(), String::new()),
    };
    let input_hash = derived_input_hash(input);
    let output_hash = derived_output_hash(&typed_output);
    typed_output.replay_receipt = build_replay_receipt(input, input_hash, output_hash);

    typed_output
}

fn candidate_scope_sets(
    input: &TypedEngineInput,
    requested_focus: &str,
    blocked: &[String],
    allow_cross_family_fallback: bool,
) -> (Vec<ExerciseReference>, Vec<ExerciseReference>) {
    let preferred_family = focus_family(requested_focus);
    let preferred = input
        .reference_snapshot
        .exercises
        .iter()
        .filter(|candidate| !blocked.contains(&candidate.id))
        .filter(|candidate| {
            candidate_allowed_for_focus(&candidate_value(candidate), requested_focus, false)
                && preferred_family
                    .map(|family| candidate.movement_pattern == family)
                    .unwrap_or(true)
        })
        .cloned()
        .collect::<Vec<_>>();

    if !preferred.is_empty() {
        return (preferred.clone(), preferred);
    }

    let surviving = input
        .reference_snapshot
        .exercises
        .iter()
        .filter(|candidate| !blocked.contains(&candidate.id))
        .filter(|candidate| {
            candidate_allowed_for_focus(
                &candidate_value(candidate),
                requested_focus,
                allow_cross_family_fallback,
            )
        })
        .cloned()
        .collect::<Vec<_>>();

    (preferred, surviving)
}

fn input_ref(path: &str, stable_id: Option<&str>) -> DecisionInputRef {
    DecisionInputRef {
        path: path.to_string(),
        stable_id: stable_id.map(ToString::to_string),
    }
}

fn scope_entry(
    input: &TypedEngineInput,
    requested_focus: &str,
    preferred_candidates: &[ExerciseReference],
    surviving_candidates: &[ExerciseReference],
) -> DecisionLogEntry {
    let preferred_scope_bucket = focus_family(requested_focus).unwrap_or("mixed");
    let widening_applied = preferred_candidates.is_empty();
    let surviving_scope_bucket = if widening_applied {
        surviving_candidates
            .first()
            .map(|candidate| candidate.movement_pattern.as_str())
            .unwrap_or(preferred_scope_bucket)
    } else {
        preferred_scope_bucket
    };

    let enumerated_candidate_ids = input
        .reference_snapshot
        .exercises
        .iter()
        .map(|candidate| candidate.id.clone())
        .collect::<Vec<_>>();

    DecisionLogEntry {
        step_type: DecisionStepType::Scope,
        rule_id: "candidate_scope".to_string(),
        inputs_used: vec![
            input_ref("request.sessionFocus", None),
            input_ref("referenceSnapshot.exercises", None),
        ],
        candidate_id: None,
        computed_value: None,
        outcome: if widening_applied {
            "widened".to_string()
        } else {
            "preferred_scope".to_string()
        },
        details: Some(json!({
            "resolvedFocus": requested_focus,
            "preferredScopeBucket": preferred_scope_bucket,
            "enumeratedCandidateIds": enumerated_candidate_ids,
            "wideningApplied": widening_applied,
            "survivingScopeBucket": surviving_scope_bucket,
        })),
    }
}

fn filter_entry(
    input: &TypedEngineInput,
    blocked_records: Vec<Value>,
    surviving_candidate_ids: Vec<String>,
) -> DecisionLogEntry {
    let evaluated_candidate_ids = input
        .reference_snapshot
        .exercises
        .iter()
        .map(|candidate| candidate.id.clone())
        .collect::<Vec<_>>();

    DecisionLogEntry {
        step_type: DecisionStepType::Filter,
        rule_id: "candidate_filter".to_string(),
        inputs_used: vec![
            input_ref("stateSnapshot.injuryState.blockedMovementPatterns", None),
            input_ref("stateSnapshot.injuryState.activeLimitations", None),
            input_ref("stateSnapshot.readinessState.systemicFatigue", None),
        ],
        candidate_id: None,
        computed_value: None,
        outcome: if surviving_candidate_ids.is_empty() {
            "deterministic_rejection".to_string()
        } else {
            "survivors_retained".to_string()
        },
        details: Some(json!({
            "evaluatedCandidateIds": evaluated_candidate_ids,
            "blocked": blocked_records,
            "survivingCandidateIds": surviving_candidate_ids,
        })),
    }
}

pub fn plan_session(input: &TypedEngineInput) -> TypedEngineOutput {
    let requested_focus = requested_focus(input);
    let microcycle_index = request_microcycle_index(input);
    let program_id = request_program_id(input);

    let reference_values = input
        .reference_snapshot
        .to_value()
        .expect("serializing reference snapshot should not fail");
    let state_values = input
        .state_snapshot
        .to_value()
        .expect("serializing state snapshot should not fail");
    let policy_values = input
        .policy_snapshot
        .to_value()
        .expect("serializing policy snapshot should not fail");
    let hard_blocks = hard_block_records(
        &reference_values,
        &state_values,
        &policy_values,
        &requested_focus,
        false,
    );
    let blocked = blocked_candidate_ids_from_records(&hard_blocks);
    let (preferred_candidates, candidates) =
        candidate_scope_sets(input, &requested_focus, &blocked, true);

    if candidates.is_empty() {
        let (rejection_code, blocked_candidate_ids) = collapse_rejection_for_hard_blocks(
            &hard_blocks,
            input.reference_snapshot.exercises.len(),
        );
        return deterministic_rejection(
            input,
            &requested_focus,
            true,
            hard_blocks,
            blocked_candidate_ids,
            rejection_code,
        );
    }

    let candidate_values = candidates.iter().map(candidate_value).collect::<Vec<_>>();
    let ranked = rank_candidates(
        &candidate_values,
        &state_values,
        &policy_values,
        &input.determinism.seed,
        microcycle_index,
    );
    let top_score = ranked.first().map(|entry| entry.2).unwrap_or(0.0);
    let band = input
        .policy_snapshot
        .seeded_tie_break_band
        .as_f64()
        .unwrap_or(0.05);
    let mut eligible_candidate_ids = ranked
        .iter()
        .filter(|entry| (top_score - entry.2).abs() <= band)
        .map(|entry| {
            entry
                .0
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string()
        })
        .collect::<Vec<_>>();
    eligible_candidate_ids.sort();
    let selection = select_best_candidate_with_trace(
        &candidate_values,
        &state_values,
        &policy_values,
        &input.determinism.seed,
        microcycle_index,
    )
    .expect("successful plan session should have at least one candidate");
    let best_candidate = candidates
        .iter()
        .find(|candidate| {
            candidate.id
                == selection
                    .candidate
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
        })
        .expect("ranked candidate should exist");
    let best_score = selection.breakdown.clone();
    let best_action = plan_result_action(
        best_candidate,
        input,
        state_values
            .get("readinessState")
            .and_then(|value| value.get("systemicFatigue"))
            .and_then(Value::as_str)
            .unwrap_or("moderate"),
        blocked.contains(&best_candidate.id),
        best_score.progression_need,
    );
    let selected_exercise_ids = std::iter::once(best_candidate.id.clone())
        .chain(
            ranked
                .iter()
                .filter(|entry| {
                    entry.0.get("id").and_then(Value::as_str) != Some(best_candidate.id.as_str())
                })
                .take(1)
                .map(|entry| {
                    entry
                        .0
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string()
                }),
        )
        .collect::<Vec<_>>();
    let recommended_movement_family =
        recommended_movement_family_label(&requested_focus, best_candidate);
    let injury_sensitive = !blocked.is_empty() || focus_family(&requested_focus) == Some("push");
    let session_rationale = session_rationale(
        &recommended_movement_family,
        action_label(&best_action.action),
        injury_sensitive,
    );

    let mut progression_action_summary = vec![best_action.clone()];
    if let Some(second_candidate_id) = selected_exercise_ids.get(1) {
        if let Some(second_candidate) = candidates
            .iter()
            .find(|candidate| &candidate.id == second_candidate_id)
        {
            progression_action_summary.push(plan_result_action(
                second_candidate,
                input,
                state_values
                    .get("readinessState")
                    .and_then(|value| value.get("systemicFatigue"))
                    .and_then(Value::as_str)
                    .unwrap_or("moderate"),
                blocked.contains(&second_candidate.id),
                score_candidate(
                    &candidate_value(second_candidate),
                    &state_values,
                    &policy_values,
                    &input.determinism.seed,
                    microcycle_index,
                )
                .progression_need,
            ));
        }
    }

    let result = PlanSessionResult {
        recommended_session_id: recommended_session_id(
            &input.determinism.seed,
            &program_id,
            microcycle_index,
            &requested_focus,
        ),
        recommended_movement_family,
        selected_exercise_ids,
        session_rationale,
        progression_action_summary,
        score_breakdown: ScoreBreakdown {
            progression_need: number_from_f64(best_score.progression_need),
            fatigue_compatibility: number_from_f64(best_score.fatigue_compatibility),
            class_bias: number_from_f64(best_score.class_bias),
            novelty: number_from_f64(best_score.novelty),
        },
    };

    let mut decision_log = vec![
        scope_entry(input, &requested_focus, &preferred_candidates, &candidates),
        filter_entry(
            input,
            hard_blocks,
            candidates
                .iter()
                .map(|candidate| candidate.id.clone())
                .collect::<Vec<_>>(),
        ),
    ];
    decision_log.extend(
        ranked
            .iter()
            .enumerate()
            .map(|(index, (candidate, breakdown, total))| {
                let candidate_id = candidate
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                DecisionLogEntry {
                    step_type: DecisionStepType::Score,
                    rule_id: "soft_scoring".to_string(),
                    inputs_used: vec![
                        input_ref(
                            "stateSnapshot.progressionState.records",
                            Some(&candidate_id),
                        ),
                        input_ref(
                            "stateSnapshot.readinessState.muscleFatigue",
                            Some(&candidate_id),
                        ),
                        input_ref("policySnapshot.classArchetypeBias", None),
                        input_ref("policySnapshot.noveltyBudget", None),
                    ],
                    candidate_id: Some(candidate_id.clone()),
                    computed_value: Some(Number::from_f64(*total).expect("finite score")),
                    outcome: "scored".to_string(),
                    details: Some(json!({
                        "breakdown": breakdown.as_value(),
                        "rankPosition": index + 1,
                        "eligibleForTopBand": eligible_candidate_ids.contains(&candidate_id),
                    })),
                }
            }),
    );
    decision_log.push(DecisionLogEntry {
        step_type: DecisionStepType::TieBreak,
        rule_id: "seeded_selection".to_string(),
        inputs_used: vec![
            input_ref("determinism.seed", None),
            input_ref("request.microcycleIndex", None),
        ],
        candidate_id: None,
        computed_value: selection
            .tie_break_index
            .map(|index| Number::from(index as i64)),
        outcome: if selection.eligible_count > 1 {
            "selected".to_string()
        } else {
            "not_needed".to_string()
        },
        details: {
            let mut details = Map::new();
            details.insert("topScore".to_string(), json!(top_score));
            details.insert("bandWidth".to_string(), json!(band));
            details.insert(
                "eligibleCandidateIds".to_string(),
                json!(eligible_candidate_ids),
            );
            if let Some(selected_index) = selection.tie_break_index {
                details.insert("selectedIndex".to_string(), json!(selected_index));
            }
            details.insert("selectedCandidateId".to_string(), json!(best_candidate.id));
            Some(Value::Object(details))
        },
    });
    decision_log.push(DecisionLogEntry {
        step_type: DecisionStepType::FinalSelection,
        rule_id: "final_selection".to_string(),
        inputs_used: Vec::new(),
        candidate_id: Some(best_candidate.id.clone()),
        computed_value: None,
        outcome: "selected".to_string(),
        details: Some(json!({
            "selectedCandidateId": best_candidate.id,
            "rankedCandidateIds": ranked.iter().map(|(candidate, _, _)| {
                candidate.get("id").and_then(Value::as_str).unwrap_or_default().to_string()
            }).collect::<Vec<_>>(),
        })),
    });

    let mut typed_output = TypedEngineOutput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        result: TypedEngineResult::PlanSession(result),
        state_patch: StatePatch::default(),
        events: Vec::new(),
        decision_log,
        replay_receipt: build_replay_receipt(input, String::new(), String::new()),
    };
    let input_hash = derived_input_hash(input);
    let output_hash = derived_output_hash(&typed_output);
    typed_output.replay_receipt = build_replay_receipt(input, input_hash, output_hash);

    typed_output
}
