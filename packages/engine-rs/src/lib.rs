pub mod adaptation;
pub mod boundary;
pub mod constraints;
pub mod derivations;
pub mod domain;
pub mod fixtures;
pub mod gamification;
pub mod logging;
pub mod progression;
pub mod replay;
pub mod rng;
pub mod scoring;
pub mod state_update;

use adaptation::{
    complete_session as complete_session_impl, initialize_cycle as initialize_cycle_impl,
    plan_session as plan_session_impl,
};
use boundary::BoundaryError;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const SCHEMA_VERSION: &str = "engine.v1";

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    InitializeCycle,
    PlanSession,
    CompleteSession,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Determinism {
    pub seed: String,
    pub effective_at: String,
    pub rule_version: String,
    pub reference_hash: String,
    pub canonicalization_version: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayReceipt {
    pub input_hash: String,
    pub output_hash: String,
    pub seed_used: String,
    pub effective_at: String,
    pub implementation_version: String,
    pub policy_version: String,
    pub reference_hash: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineInputV1 {
    pub schema_version: String,
    pub operation: Operation,
    pub determinism: Determinism,
    pub reference_snapshot: Value,
    pub state_snapshot: Value,
    pub policy_snapshot: Value,
    pub request: Value,
    pub metadata: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineOutputV1 {
    pub schema_version: String,
    pub operation: Operation,
    pub result: Value,
    pub state_patch: Value,
    pub events: Vec<Value>,
    pub decision_log: Vec<Value>,
    pub replay_receipt: ReplayReceipt,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EngineError {
    InvalidInput { message: String },
    InvalidOutput { message: String },
}

impl core::fmt::Display for EngineError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::InvalidInput { message } => write!(f, "invalid engine input: {message}"),
            Self::InvalidOutput { message } => write!(f, "invalid engine output: {message}"),
        }
    }
}

impl std::error::Error for EngineError {}

impl From<BoundaryError> for EngineError {
    fn from(error: BoundaryError) -> Self {
        match error {
            BoundaryError::SchemaVersionMismatch { .. } | BoundaryError::InvalidSnapshot { .. } => {
                Self::InvalidInput {
                    message: error.to_string(),
                }
            }
            BoundaryError::InvalidOutput { .. } => Self::InvalidOutput {
                message: error.to_string(),
            },
        }
    }
}

pub fn plan_session(input: &EngineInputV1) -> Result<EngineOutputV1, EngineError> {
    let typed_input = boundary::TypedEngineInput::from_public(input)?;
    let typed_output = plan_session_impl::plan_session(&typed_input);
    typed_output.to_public().map_err(EngineError::from)
}

pub fn initialize_cycle(input: &EngineInputV1) -> Result<EngineOutputV1, EngineError> {
    let typed_input = boundary::TypedEngineInput::from_public(input)?;
    let typed_output = initialize_cycle_impl::initialize_cycle(&typed_input);
    typed_output.to_public().map_err(EngineError::from)
}

pub fn complete_session(input: &EngineInputV1) -> Result<EngineOutputV1, EngineError> {
    let typed_input = boundary::TypedEngineInput::from_public(input)?;
    let typed_output = complete_session_impl::complete_session(&typed_input);
    typed_output.to_public().map_err(EngineError::from)
}
