use crate::domain::gamification::GamificationState;
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CanonicalClassArchetype {
    Strength,
    Hybrid,
}

impl CanonicalClassArchetype {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Strength => "strength",
            Self::Hybrid => "hybrid",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProgramBlendEntry {
    pub program_id: String,
    pub weight: Number,
    pub role: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CycleSessionSlot {
    pub slot_id: String,
    pub slot_index: u32,
    pub slot_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub movement_pattern: Option<String>,
    pub sets_min: u32,
    pub sets_max: u32,
    pub reps_min: u32,
    pub reps_max: u32,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub muscle_targets: BTreeMap<String, Number>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags_required: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locked_exercise_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prescription: Option<Value>,
    pub source_program_id: String,
    pub source_program_day_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CycleSessionPlan {
    pub session_id: String,
    pub program_id: String,
    pub program_day_id: String,
    pub program_day_name: String,
    pub macro_week: u32,
    pub mesocycle_index: u32,
    pub microcycle_index: u32,
    pub session_index: u32,
    pub planned_day_of_week: u32,
    pub class_archetype: CanonicalClassArchetype,
    pub slot_payload: Vec<CycleSessionSlot>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MacrocyclePlan {
    pub total_weeks: u32,
    pub mesocycle_count: u32,
    pub current_mesocycle_index: u32,
    pub current_microcycle_index: u32,
    pub current_session_index: u32,
    pub sessions: Vec<CycleSessionPlan>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InitializeCycleResult {
    pub resolved_class_archetype: CanonicalClassArchetype,
    pub primary_program_id: String,
    pub program_blend: Vec<ProgramBlendEntry>,
    pub macrocycle: MacrocyclePlan,
    pub initial_gamification_state: GamificationState,
}

impl ProgramBlendEntry {
    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl CycleSessionSlot {
    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl CycleSessionPlan {
    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl MacrocyclePlan {
    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl InitializeCycleResult {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}
