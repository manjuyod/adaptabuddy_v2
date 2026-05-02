use crate::boundary::{TypedEngineInput, TypedEngineOutput, TypedEngineResult};
use crate::domain::{
    AwardedXpSummary, CompleteSessionResult, CompletionQuality, DecisionInputRef, DecisionLogEntry,
    DecisionStepType, GamificationState, LoadRepsReference, ProgressionAction,
    ProgressionActionSummary, ProgressionTrend, ReadinessStatePatch, SessionOutcomeClassification,
    StatePatch,
};
use crate::gamification::level_from_xp;
use serde_json::{json, Number, Value};
use std::collections::BTreeMap;

use super::{build_replay_receipt, derived_input_hash, derived_output_hash};

fn request_session(input: &TypedEngineInput) -> &Value {
    input.request.get("session").unwrap_or(&Value::Null)
}

fn session_overall_rpe(input: &TypedEngineInput) -> i64 {
    request_session(input)
        .get("overallRpe")
        .and_then(Value::as_i64)
        .unwrap_or(8)
}

fn session_exercises(input: &TypedEngineInput) -> Vec<Value> {
    request_session(input)
        .get("exercises")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn set_completion(input: &TypedEngineInput) -> bool {
    let exercises = session_exercises(input);
    !exercises.is_empty()
        && exercises.iter().all(|exercise| {
            exercise
                .get("sets")
                .and_then(Value::as_array)
                .map(|sets| {
                    !sets.is_empty()
                        && sets
                            .iter()
                            .all(|set| set.get("reps").and_then(Value::as_i64).unwrap_or(0) > 0)
                })
                .unwrap_or(false)
        })
}

fn primary_exercise_id(input: &TypedEngineInput) -> String {
    session_exercises(input)
        .first()
        .and_then(|exercise| exercise.get("exerciseId"))
        .and_then(Value::as_str)
        .or_else(|| {
            input
                .state_snapshot
                .progression_state
                .records
                .first()
                .map(|record| record.exercise_id.as_str())
        })
        .unwrap_or_else(|| {
            panic!(
                "complete_session requires a primary exercise in session.exercises or state_snapshot.progressionState.records"
            )
        })
        .to_string()
}

fn progression_record<'a>(
    input: &'a TypedEngineInput,
    exercise_id: &str,
) -> Option<&'a crate::domain::ProgressionRecord> {
    input
        .state_snapshot
        .progression_state
        .records
        .iter()
        .find(|record| record.exercise_id == exercise_id)
}

fn current_trend(input: &TypedEngineInput, exercise_id: &str) -> ProgressionTrend {
    progression_record(input, exercise_id)
        .map(|record| record.trend.clone())
        .unwrap_or(ProgressionTrend::Stalled)
}

fn last_successful_load(input: &TypedEngineInput, exercise_id: &str) -> Option<LoadRepsReference> {
    progression_record(input, exercise_id).map(|record| LoadRepsReference {
        weight: record.previous_performance_reference.weight.clone(),
        reps: record.previous_performance_reference.reps,
    })
}

fn completion_provenance(input: &TypedEngineInput) -> String {
    request_session(input)
        .get("completedAt")
        .and_then(Value::as_str)
        .unwrap_or(input.determinism.effective_at.as_str())
        .to_string()
}

fn first_set_load(input: &TypedEngineInput) -> Option<LoadRepsReference> {
    session_exercises(input)
        .first()
        .and_then(|exercise| exercise.get("sets"))
        .and_then(Value::as_array)
        .and_then(|sets| sets.first())
        .map(|set| LoadRepsReference {
            weight: set
                .get("weight")
                .and_then(Value::as_number)
                .cloned()
                .unwrap_or_else(|| Number::from(0)),
            reps: set
                .get("reps")
                .and_then(Value::as_u64)
                .and_then(|reps| u32::try_from(reps).ok())
                .unwrap_or(0),
        })
}

fn classification_label(input: &TypedEngineInput, exercise_id: &str) -> &'static str {
    let fatigue = match input.state_snapshot.readiness_state.systemic_fatigue {
        crate::domain::FatigueLevel::Mild => "low",
        crate::domain::FatigueLevel::Moderate => "moderate",
        crate::domain::FatigueLevel::Severe => "severe",
    };
    let trend = match current_trend(input, exercise_id) {
        ProgressionTrend::Improving => "improving",
        ProgressionTrend::Stalled => "stalled",
        ProgressionTrend::Regressing => "regressing",
        ProgressionTrend::Blocked => "blocked",
    };

    crate::progression::classify_completion(
        session_overall_rpe(input),
        trend,
        fatigue,
        set_completion(input),
    )
}

fn next_action(classification: &str, microcycle_index: u32) -> ProgressionAction {
    match classification {
        "complete_clean" => {
            if microcycle_index.is_multiple_of(2) {
                ProgressionAction::Overload
            } else {
                ProgressionAction::Maintain
            }
        }
        "complete_compromised" => ProgressionAction::Maintain,
        "partial" => ProgressionAction::Regress,
        "missed" => ProgressionAction::Swap,
        _ => ProgressionAction::Maintain,
    }
}

fn next_trend(
    input: &TypedEngineInput,
    classification: &str,
    exercise_id: &str,
) -> ProgressionTrend {
    match classification {
        "partial" => ProgressionTrend::Regressing,
        "missed" => ProgressionTrend::Blocked,
        _ => current_trend(input, exercise_id),
    }
}

fn quality_xp(classification: &str) -> i64 {
    match classification {
        "complete_clean" => 15,
        "complete_compromised" => 10,
        "partial" => 5,
        "missed" => 0,
        _ => 5,
    }
}

fn progression_bonus(action: &ProgressionAction) -> i64 {
    match action {
        ProgressionAction::Overload => 5,
        ProgressionAction::Maintain | ProgressionAction::Regress | ProgressionAction::Swap => 0,
    }
}

fn award_xp(
    input: &TypedEngineInput,
    classification: &str,
    action: &ProgressionAction,
) -> (i64, u32, i64, bool) {
    let current_xp = i64::from(input.state_snapshot.gamification_state.xp);
    let current_streak = input.state_snapshot.gamification_state.adherence_streak;
    let streak_bonus = if classification == "missed" {
        0
    } else {
        i64::from(current_streak.min(5))
    };
    let xp_delta = quality_xp(classification) + streak_bonus + progression_bonus(action);
    let total_xp = current_xp.saturating_add(xp_delta).max(0);
    let level_before = level_from_xp(current_xp);
    let level_after = level_from_xp(total_xp);
    let level_up = level_before != level_after;

    (xp_delta, level_after, total_xp, level_up)
}

fn classification_enum(classification: &str) -> SessionOutcomeClassification {
    match classification {
        "complete_clean" => SessionOutcomeClassification::CompleteClean,
        "complete_compromised" => SessionOutcomeClassification::CompleteCompromised,
        "partial" => SessionOutcomeClassification::Partial,
        "missed" => SessionOutcomeClassification::Missed,
        _ => SessionOutcomeClassification::Partial,
    }
}

fn is_successful_completion(classification: &str) -> bool {
    matches!(classification, "complete_clean" | "complete_compromised")
}

fn progression_patch_entry(
    input: &TypedEngineInput,
    exercise_id: &str,
    action: &ProgressionAction,
    classification: &str,
    completed_at: &str,
) -> crate::domain::ProgressionStatePatchEntry {
    let previous_record = progression_record(input, exercise_id);
    let consecutive_successful_completions = if is_successful_completion(classification) {
        previous_record
            .map(|record| record.consecutive_successful_completions)
            .unwrap_or(0)
            + 1
    } else {
        0
    };
    let consecutive_stall_or_regression_count = if matches!(classification, "partial" | "missed") {
        previous_record
            .map(|record| record.consecutive_stall_or_regression_count)
            .unwrap_or(0)
            + 1
    } else {
        0
    };
    let swap_recommendation_count = previous_record
        .map(|record| record.swap_recommendation_count)
        .unwrap_or(0)
        + u32::from(
            matches!(classification, "missed") && matches!(action, ProgressionAction::Swap),
        );
    let last_successful_load = if is_successful_completion(classification) {
        first_set_load(input).or_else(|| last_successful_load(input, exercise_id))
    } else {
        last_successful_load(input, exercise_id)
    };

    crate::domain::ProgressionStatePatchEntry {
        current_action: action.clone(),
        trend: next_trend(input, classification, exercise_id),
        last_successful_load,
        consecutive_successful_completions,
        consecutive_stall_or_regression_count,
        swap_recommendation_count,
        last_session_outcome_classification: classification_enum(classification),
        last_completed_at: completed_at.to_string(),
    }
}

fn readiness_patch(input: &TypedEngineInput) -> ReadinessStatePatch {
    ReadinessStatePatch {
        systemic_fatigue: input
            .state_snapshot
            .readiness_state
            .systemic_fatigue
            .clone(),
    }
}

fn gamification_patch(
    input: &TypedEngineInput,
    classification: &str,
    total_xp: i64,
    level: u32,
    adherence_streak: u32,
    awarded_at: &str,
) -> GamificationState {
    let previous = &input.state_snapshot.gamification_state;
    GamificationState {
        xp: total_xp.max(0) as u32,
        level,
        adherence_streak,
        completed_session_count: previous.completed_session_count
            + u32::from(!matches!(classification, "missed")),
        missed_session_count: previous.missed_session_count
            + u32::from(matches!(classification, "missed")),
        last_adherence_outcome_classification: classification_enum(classification),
        last_awarded_at: awarded_at.to_string(),
    }
}

fn input_ref(path: &str, stable_id: Option<&str>) -> DecisionInputRef {
    DecisionInputRef {
        path: path.to_string(),
        stable_id: stable_id.map(ToString::to_string),
    }
}

fn action_before(input: &TypedEngineInput, exercise_id: &str) -> ProgressionAction {
    progression_record(input, exercise_id)
        .map(|record| record.current_action.clone())
        .unwrap_or(ProgressionAction::Maintain)
}

fn trend_before(input: &TypedEngineInput, exercise_id: &str) -> ProgressionTrend {
    current_trend(input, exercise_id)
}

fn completion_quality_from_classification(classification: &str) -> CompletionQuality {
    match classification {
        "complete_clean" => CompletionQuality::CompleteClean,
        "complete_compromised" => CompletionQuality::CompleteCompromised,
        "partial" => CompletionQuality::Partial,
        "missed" => CompletionQuality::Missed,
        _ => CompletionQuality::Partial,
    }
}

fn completion_quality_label(quality: &CompletionQuality) -> &'static str {
    match quality {
        CompletionQuality::CompleteClean => "complete_clean",
        CompletionQuality::CompleteCompromised => "complete_compromised",
        CompletionQuality::Partial => "partial",
        CompletionQuality::Missed => "missed",
    }
}

fn recent_completion_window(
    input: &TypedEngineInput,
    exercise_id: &str,
    classification: &str,
) -> Vec<Value> {
    let mut grouped = BTreeMap::<String, Vec<(String, String)>>::new();
    for completion in &input.state_snapshot.recent_completions {
        grouped
            .entry(completion.exercise_id.clone())
            .or_default()
            .push((
                completion.completed_at.clone(),
                completion_quality_label(&completion.quality).to_string(),
            ));
    }

    let completed_at = request_session(input)
        .get("completedAt")
        .and_then(Value::as_str)
        .unwrap_or(input.determinism.effective_at.as_str())
        .to_string();
    grouped.entry(exercise_id.to_string()).or_default().push((
        completed_at,
        completion_quality_label(&completion_quality_from_classification(classification))
            .to_string(),
    ));

    let mut retained = Vec::new();
    for (exercise_id, entries) in grouped {
        let mut entries = entries;
        entries.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
        entries.truncate(3);
        retained.extend(entries.into_iter().map(|(completed_at, quality)| {
            json!({
                "exerciseId": exercise_id,
                "completedAt": completed_at,
                "quality": quality,
            })
        }));
    }

    retained.sort_by(|left, right| {
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

    retained
}

pub fn complete_session(input: &TypedEngineInput) -> TypedEngineOutput {
    let exercise_id = primary_exercise_id(input);
    let classification = classification_label(input, &exercise_id);
    let completion_at = completion_provenance(input);
    let microcycle_index = input.state_snapshot.active_program_state.current_microcycle;
    let previous_action = action_before(input, &exercise_id);
    let previous_trend = trend_before(input, &exercise_id);
    let action = next_action(classification, microcycle_index);
    let (xp_delta, level_after, total_xp, level_up) = award_xp(input, classification, &action);
    let current_streak = input.state_snapshot.gamification_state.adherence_streak;
    let next_streak = if classification == "missed" {
        0
    } else {
        current_streak + 1
    };

    let result = CompleteSessionResult {
        session_outcome_classification: classification_enum(classification),
        updated_progression_action_summary: vec![ProgressionActionSummary {
            exercise_id: exercise_id.clone(),
            action: action.clone(),
            trend: next_trend(input, classification, &exercise_id),
        }],
        awarded_xp_summary: AwardedXpSummary {
            xp_delta: xp_delta as u32,
            streak_delta: if classification == "missed" { 0 } else { 1 },
            reason: "completed_recommended_session".to_string(),
        },
        level_up_indicator: level_up,
        warnings: if classification == "complete_clean" {
            Vec::new()
        } else {
            vec!["future_choices_tightened".to_string()]
        },
    };

    let mut progression_state = BTreeMap::new();
    progression_state.insert(
        exercise_id.clone(),
        progression_patch_entry(input, &exercise_id, &action, classification, &completion_at),
    );
    let state_patch = StatePatch {
        progression_state: Some(crate::domain::ProgressionStatePatch(progression_state)),
        readiness_state: Some(readiness_patch(input)),
        gamification_state: Some(gamification_patch(
            input,
            classification,
            total_xp,
            level_after,
            next_streak,
            &completion_at,
        )),
    };

    let recent_completion_update = recent_completion_window(input, &exercise_id, classification);
    let decision_log = vec![
        DecisionLogEntry {
            step_type: DecisionStepType::Classify,
            rule_id: "completion_quality".to_string(),
            inputs_used: vec![
                input_ref("request.session.overallRpe", None),
                input_ref("request.session.exercises", Some(&exercise_id)),
                input_ref("stateSnapshot.progressionState.records", Some(&exercise_id)),
                input_ref("stateSnapshot.readinessState.systemicFatigue", None),
            ],
            candidate_id: None,
            computed_value: None,
            outcome: classification.to_string(),
            details: Some(json!({
                "sessionOutcomeClassification": classification,
                "primaryExerciseId": exercise_id.clone(),
                "progressionActionBefore": serde_json::to_value(&previous_action).expect("action should serialize"),
                "progressionTrendBefore": serde_json::to_value(&previous_trend).expect("trend should serialize"),
            })),
        },
        DecisionLogEntry {
            step_type: DecisionStepType::StateUpdate,
            rule_id: "state_update".to_string(),
            inputs_used: vec![
                input_ref("stateSnapshot.progressionState.records", Some(&exercise_id)),
                input_ref("stateSnapshot.readinessState.systemicFatigue", None),
                input_ref("stateSnapshot.gamificationState", None),
                input_ref("stateSnapshot.recentCompletions", None),
            ],
            candidate_id: Some(exercise_id.clone()),
            computed_value: None,
            outcome: "applied".to_string(),
            details: Some(json!({
                "touchedBuckets": ["progressionState", "readinessState", "gamificationState"],
                "progressionUpdates": [{
                    "exerciseId": exercise_id.clone(),
                    "actionBefore": serde_json::to_value(&previous_action).expect("action should serialize"),
                    "actionAfter": serde_json::to_value(&action).expect("action should serialize"),
                    "trendBefore": serde_json::to_value(&previous_trend).expect("trend should serialize"),
                    "trendAfter": serde_json::to_value(next_trend(input, classification, &exercise_id)).expect("trend should serialize"),
                    "consecutiveSuccessfulCompletionsBefore": progression_record(input, &exercise_id)
                        .map(|record| record.consecutive_successful_completions)
                        .unwrap_or(0),
                    "consecutiveSuccessfulCompletionsAfter": state_patch.progression_state.as_ref()
                        .and_then(|patch| patch.0.get(&exercise_id))
                        .map(|record| record.consecutive_successful_completions)
                        .unwrap_or(0),
                    "consecutiveStallOrRegressionCountBefore": progression_record(input, &exercise_id)
                        .map(|record| record.consecutive_stall_or_regression_count)
                        .unwrap_or(0),
                    "consecutiveStallOrRegressionCountAfter": state_patch.progression_state.as_ref()
                        .and_then(|patch| patch.0.get(&exercise_id))
                        .map(|record| record.consecutive_stall_or_regression_count)
                        .unwrap_or(0),
                    "swapRecommendationCountBefore": progression_record(input, &exercise_id)
                        .map(|record| record.swap_recommendation_count)
                        .unwrap_or(0),
                    "swapRecommendationCountAfter": state_patch.progression_state.as_ref()
                        .and_then(|patch| patch.0.get(&exercise_id))
                        .map(|record| record.swap_recommendation_count)
                        .unwrap_or(0),
                    "lastSessionOutcomeClassificationAfter": classification,
                    "lastCompletedAtAfter": completion_at,
                }],
                "readinessUpdate": {
                    "systemicFatigueBefore": serde_json::to_value(&input.state_snapshot.readiness_state.systemic_fatigue).expect("fatigue should serialize"),
                    "systemicFatigueAfter": serde_json::to_value(&input.state_snapshot.readiness_state.systemic_fatigue).expect("fatigue should serialize"),
                },
                "recentCompletionUpdate": {
                    "retainedCompletions": recent_completion_update,
                },
                "gamificationUpdate": {
                    "xpBefore": input.state_snapshot.gamification_state.xp,
                    "xpAfter": total_xp.max(0) as u32,
                    "levelBefore": input.state_snapshot.gamification_state.level,
                    "levelAfter": level_after,
                    "adherenceStreakBefore": current_streak,
                    "adherenceStreakAfter": next_streak,
                    "completedSessionCountBefore": input.state_snapshot.gamification_state.completed_session_count,
                    "completedSessionCountAfter": state_patch.gamification_state.as_ref().map(|state| state.completed_session_count).unwrap_or(0),
                    "missedSessionCountBefore": input.state_snapshot.gamification_state.missed_session_count,
                    "missedSessionCountAfter": state_patch.gamification_state.as_ref().map(|state| state.missed_session_count).unwrap_or(0),
                    "lastAdherenceOutcomeClassificationAfter": classification,
                    "lastAwardedAtAfter": completion_at,
                },
            })),
        },
        DecisionLogEntry {
            step_type: DecisionStepType::AwardXp,
            rule_id: "completion_reward".to_string(),
            inputs_used: vec![
                input_ref("stateSnapshot.gamificationState.xp", None),
                input_ref("stateSnapshot.gamificationState.adherenceStreak", None),
            ],
            candidate_id: None,
            computed_value: Some(Number::from(xp_delta)),
            outcome: "applied".to_string(),
            details: Some(json!({
                "streakDelta": if classification == "missed" { 0 } else { 1 },
                "levelBefore": input.state_snapshot.gamification_state.level,
                "levelAfter": level_after,
                "levelUp": level_up,
            })),
        },
    ];

    let mut typed_output = TypedEngineOutput {
        schema_version: input.schema_version.clone(),
        operation: input.operation.clone(),
        result: TypedEngineResult::CompleteSession(result),
        state_patch,
        events: Vec::new(),
        decision_log,
        replay_receipt: build_replay_receipt(input, String::new(), String::new()),
    };
    let input_hash = derived_input_hash(input);
    let output_hash = derived_output_hash(&typed_output);
    typed_output.replay_receipt = build_replay_receipt(input, input_hash, output_hash);

    typed_output
}
