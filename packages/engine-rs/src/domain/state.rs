use crate::domain::gamification::GamificationState;
use crate::domain::progression::{
    ProgressionAction, ProgressionRecord, ProgressionTrend, SessionOutcomeClassification,
};
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum FatigueLevel {
    Mild,
    Moderate,
    Severe,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum CompletionQuality {
    CompleteClean,
    CompleteCompromised,
    Partial,
    Missed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AthleteProfile {
    pub height: Number,
    pub weight: Number,
    pub training_age: u32,
    pub goal_bias: String,
    pub available_days_per_week: u32,
    pub class_archetype: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadinessState {
    pub systemic_fatigue: FatigueLevel,
    pub muscle_fatigue: BTreeMap<String, u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InjuryState {
    pub active_limitations: Vec<String>,
    pub blocked_movement_patterns: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct KnownLift {
    #[serde(rename = "estimated1RM")]
    pub estimated_1_rm: Number,
    pub last_weight: Number,
    pub last_reps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PerformanceState {
    pub known_lifts: BTreeMap<String, KnownLift>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LoadRepsReference {
    pub weight: Number,
    pub reps: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActiveProgramState {
    pub program_id: String,
    pub current_day_index: u32,
    pub current_microcycle: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RecentCompletion {
    pub exercise_id: String,
    pub completed_at: String,
    pub quality: CompletionQuality,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgressionState {
    pub records: Vec<ProgressionRecord>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AthleteStateSnapshot {
    pub athlete_profile: AthleteProfile,
    pub readiness_state: ReadinessState,
    pub injury_state: InjuryState,
    pub performance_state: PerformanceState,
    pub progression_state: ProgressionState,
    pub gamification_state: GamificationState,
    pub active_program_state: ActiveProgramState,
    pub recent_completions: Vec<RecentCompletion>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReadinessStatePatch {
    pub systemic_fatigue: FatigueLevel,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgressionStatePatchEntry {
    pub current_action: ProgressionAction,
    pub trend: ProgressionTrend,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_successful_load: Option<LoadRepsReference>,
    pub consecutive_successful_completions: u32,
    pub consecutive_stall_or_regression_count: u32,
    pub swap_recommendation_count: u32,
    pub last_session_outcome_classification: SessionOutcomeClassification,
    pub last_completed_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct ProgressionStatePatch(pub BTreeMap<String, ProgressionStatePatchEntry>);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StatePatch {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progression_state: Option<ProgressionStatePatch>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub readiness_state: Option<ReadinessStatePatch>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gamification_state: Option<GamificationState>,
}

impl AthleteProfile {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ReadinessState {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl InjuryState {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl KnownLift {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl PerformanceState {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ProgressionState {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl LoadRepsReference {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ActiveProgramState {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl RecentCompletion {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl AthleteStateSnapshot {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ReadinessStatePatch {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ProgressionStatePatchEntry {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl ProgressionStatePatch {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl StatePatch {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}
