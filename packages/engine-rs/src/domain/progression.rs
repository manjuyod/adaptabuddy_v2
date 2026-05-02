use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum ProgressionTrend {
    Improving,
    Stalled,
    Regressing,
    Blocked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum ProgressionAction {
    Overload,
    Maintain,
    Regress,
    Swap,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PreviousPerformanceReference {
    pub weight: Number,
    pub reps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgressionRecord {
    pub exercise_id: String,
    pub previous_performance_reference: PreviousPerformanceReference,
    pub trend: ProgressionTrend,
    pub current_action: ProgressionAction,
    pub consecutive_successful_completions: u32,
    pub consecutive_stall_or_regression_count: u32,
    pub swap_recommendation_count: u32,
    pub last_session_outcome_classification: SessionOutcomeClassification,
    pub last_completed_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgressionActionSummary {
    pub exercise_id: String,
    pub action: ProgressionAction,
    pub trend: ProgressionTrend,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScoreBreakdown {
    pub progression_need: Number,
    pub fatigue_compatibility: Number,
    pub class_bias: Number,
    pub novelty: Number,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum SessionOutcomeClassification {
    CompleteClean,
    CompleteCompromised,
    Partial,
    Missed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum DeterministicRejectionStatus {
    DeterministicRejection,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum DeterministicRejectionCode {
    NoValidCandidates,
    InjuryBlocked,
    FatigueBlocked,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DeterministicRejection {
    pub status: DeterministicRejectionStatus,
    pub rejection_code: DeterministicRejectionCode,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub blocked_candidate_ids: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanSessionResult {
    pub recommended_session_id: String,
    pub recommended_movement_family: String,
    pub selected_exercise_ids: Vec<String>,
    pub session_rationale: String,
    pub progression_action_summary: Vec<ProgressionActionSummary>,
    pub score_breakdown: ScoreBreakdown,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CompleteSessionResult {
    pub session_outcome_classification: SessionOutcomeClassification,
    pub updated_progression_action_summary: Vec<ProgressionActionSummary>,
    pub awarded_xp_summary: crate::domain::gamification::AwardedXpSummary,
    pub level_up_indicator: bool,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum DecisionStepType {
    Initialize,
    Blend,
    ExpandCycle,
    Scope,
    Filter,
    Score,
    TieBreak,
    FinalSelection,
    Classify,
    StateUpdate,
    AwardXp,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DecisionInputRef {
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stable_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DecisionLogEntry {
    pub step_type: DecisionStepType,
    pub rule_id: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub inputs_used: Vec<DecisionInputRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidate_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub computed_value: Option<Number>,
    pub outcome: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl PreviousPerformanceReference {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ProgressionRecord {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ProgressionActionSummary {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl DeterministicRejection {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl PlanSessionResult {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl CompleteSessionResult {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl DecisionLogEntry {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn progression_record_round_trips_between_value_and_typed_form() {
        let record = ProgressionRecord {
            exercise_id: "bench-press".to_string(),
            previous_performance_reference: PreviousPerformanceReference {
                weight: Number::from(100),
                reps: 5,
            },
            trend: ProgressionTrend::Improving,
            current_action: ProgressionAction::Maintain,
            consecutive_successful_completions: 1,
            consecutive_stall_or_regression_count: 0,
            swap_recommendation_count: 0,
            last_session_outcome_classification: SessionOutcomeClassification::CompleteClean,
            last_completed_at: "2026-02-10T10:00:00.000Z".to_string(),
        };

        let value = record.to_value().expect("record should serialize");
        let round_trip = ProgressionRecord::from_value(&value).expect("record should deserialize");

        assert_eq!(round_trip, record);
        assert_eq!(
            value,
            json!({
                "exerciseId": "bench-press",
                "previousPerformanceReference": {
                    "weight": 100,
                    "reps": 5,
                },
                "trend": "improving",
                "currentAction": "maintain",
                "consecutiveSuccessfulCompletions": 1,
                "consecutiveStallOrRegressionCount": 0,
                "swapRecommendationCount": 0,
                "lastSessionOutcomeClassification": "complete_clean",
                "lastCompletedAt": "2026-02-10T10:00:00.000Z",
            })
        );
    }

    #[test]
    fn progression_record_rejects_unknown_fields() {
        let value = json!({
            "exerciseId": "bench-press",
            "previousPerformanceReference": {
                "weight": 100,
                "reps": 5,
            },
            "trend": "improving",
            "currentAction": "maintain",
            "consecutiveSuccessfulCompletions": 1,
            "consecutiveStallOrRegressionCount": 0,
            "swapRecommendationCount": 0,
            "lastSessionOutcomeClassification": "complete_clean",
            "lastCompletedAt": "2026-02-10T10:00:00.000Z",
            "unexpected": true,
        });

        let error = ProgressionRecord::from_value(&value).expect_err("unknown field should fail");

        assert!(error.to_string().contains("unknown field"));
    }

    #[test]
    fn progression_record_rejects_invalid_action_strings() {
        let value = json!({
            "exerciseId": "bench-press",
            "previousPerformanceReference": {
                "weight": 100,
                "reps": 5,
            },
            "trend": "improving",
            "currentAction": "explode",
            "consecutiveSuccessfulCompletions": 1,
            "consecutiveStallOrRegressionCount": 0,
            "swapRecommendationCount": 0,
            "lastSessionOutcomeClassification": "complete_clean",
            "lastCompletedAt": "2026-02-10T10:00:00.000Z",
        });

        let error =
            ProgressionRecord::from_value(&value).expect_err("invalid action should fail parsing");

        assert!(error.to_string().contains("unknown variant"));
    }

    #[test]
    fn progression_record_round_trips_richer_engine14_fields() {
        let value = json!({
            "exerciseId": "bench-press",
            "previousPerformanceReference": {
                "weight": 100,
                "reps": 5,
            },
            "trend": "improving",
            "currentAction": "maintain",
            "consecutiveSuccessfulCompletions": 3,
            "consecutiveStallOrRegressionCount": 1,
            "swapRecommendationCount": 2,
            "lastSessionOutcomeClassification": "complete_compromised",
            "lastCompletedAt": "2026-02-13T11:10:00.000Z",
        });

        let record =
            ProgressionRecord::from_value(&value).expect("richer progression record should parse");
        let round_trip = record.to_value().expect("record should serialize");

        assert_eq!(round_trip, value);
    }

    #[test]
    fn plan_session_result_round_trips_nested_progression_payloads() {
        let result = PlanSessionResult {
            recommended_session_id: "program-upper-1-upper-push-m2".to_string(),
            recommended_movement_family: "upper_push".to_string(),
            selected_exercise_ids: vec![
                "bench-press".to_string(),
                "incline-dumbbell-press".to_string(),
            ],
            session_rationale: "Fresh enough to overload the main push pattern.".to_string(),
            progression_action_summary: vec![
                ProgressionActionSummary {
                    exercise_id: "bench-press".to_string(),
                    action: ProgressionAction::Overload,
                    trend: ProgressionTrend::Improving,
                },
                ProgressionActionSummary {
                    exercise_id: "incline-dumbbell-press".to_string(),
                    action: ProgressionAction::Maintain,
                    trend: ProgressionTrend::Stalled,
                },
            ],
            score_breakdown: ScoreBreakdown {
                progression_need: Number::from_f64(0.9).expect("finite number"),
                fatigue_compatibility: Number::from_f64(0.88).expect("finite number"),
                class_bias: Number::from_f64(0.1).expect("finite number"),
                novelty: Number::from_f64(0.02).expect("finite number"),
            },
        };

        let value = result.to_value().expect("result should serialize");
        let round_trip =
            PlanSessionResult::from_value(&value).expect("result should deserialize cleanly");

        assert_eq!(round_trip, result);
        assert_eq!(
            value["progressionActionSummary"][0]["action"],
            json!("overload")
        );
        assert_eq!(value["scoreBreakdown"]["novelty"], json!(0.02));
    }

    #[test]
    fn deterministic_rejection_omits_empty_blocked_candidates_on_serialize() {
        let rejection = DeterministicRejection {
            status: DeterministicRejectionStatus::DeterministicRejection,
            rejection_code: DeterministicRejectionCode::NoValidCandidates,
            blocked_candidate_ids: Vec::new(),
        };

        let value = rejection.to_value().expect("rejection should serialize");
        let round_trip =
            DeterministicRejection::from_value(&value).expect("rejection should deserialize");

        assert_eq!(round_trip, rejection);
        assert_eq!(
            value,
            json!({
                "status": "deterministic_rejection",
                "rejectionCode": "no_valid_candidates",
            })
        );
    }

    #[test]
    fn deterministic_rejection_round_trips_the_fatigue_blocked_code() {
        let rejection = DeterministicRejection {
            status: DeterministicRejectionStatus::DeterministicRejection,
            rejection_code: DeterministicRejectionCode::FatigueBlocked,
            blocked_candidate_ids: vec!["bench-press".to_string()],
        };

        let value = rejection.to_value().expect("rejection should serialize");
        let round_trip =
            DeterministicRejection::from_value(&value).expect("rejection should deserialize");

        assert_eq!(round_trip, rejection);
        assert_eq!(value["rejectionCode"], json!("fatigue_blocked"));
    }
}
