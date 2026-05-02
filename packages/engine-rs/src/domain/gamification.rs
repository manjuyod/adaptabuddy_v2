use crate::domain::progression::SessionOutcomeClassification;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GamificationState {
    pub xp: u32,
    pub level: u32,
    pub adherence_streak: u32,
    pub completed_session_count: u32,
    pub missed_session_count: u32,
    pub last_adherence_outcome_classification: SessionOutcomeClassification,
    pub last_awarded_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AwardedXpSummary {
    pub xp_delta: u32,
    pub streak_delta: i32,
    pub reason: String,
}

impl GamificationState {
    pub fn from_value(value: &Value) -> Result<Self, serde_json::Error> {
        serde_json::from_value(value.clone())
    }

    pub fn to_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }
}

impl AwardedXpSummary {
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
    fn gamification_state_round_trips_richer_engine14_fields() {
        let value = json!({
            "xp": 155,
            "level": 3,
            "adherenceStreak": 7,
            "completedSessionCount": 14,
            "missedSessionCount": 2,
            "lastAdherenceOutcomeClassification": "complete_compromised",
            "lastAwardedAt": "2026-02-13T11:10:00.000Z",
        });

        let state =
            GamificationState::from_value(&value).expect("richer gamification state should parse");
        let round_trip = state.to_value().expect("state should serialize");

        assert_eq!(round_trip, value);
    }
}
