use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Eq, Hash, PartialEq, Serialize, Deserialize)]
pub struct UserId(pub Uuid);

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum HealthEventKind {
    WorkoutCompleted,
    ExerciseLogged,
    SetLogged,
    FoodLogged,
    CalorieTargetHit,
    ProteinGoalHit,
    HabitCompleted,
    BodyMetricUpdated,
    RecoveryDayTaken,
    GoalCreated,
    GoalCompleted,
}

impl HealthEventKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::WorkoutCompleted => "WorkoutCompleted",
            Self::ExerciseLogged => "ExerciseLogged",
            Self::SetLogged => "SetLogged",
            Self::FoodLogged => "FoodLogged",
            Self::CalorieTargetHit => "CalorieTargetHit",
            Self::ProteinGoalHit => "ProteinGoalHit",
            Self::HabitCompleted => "HabitCompleted",
            Self::BodyMetricUpdated => "BodyMetricUpdated",
            Self::RecoveryDayTaken => "RecoveryDayTaken",
            Self::GoalCreated => "GoalCreated",
            Self::GoalCompleted => "GoalCompleted",
        }
    }

    pub fn from_database_value(value: &str) -> Option<Self> {
        Some(match value {
            "WorkoutCompleted" => Self::WorkoutCompleted,
            "ExerciseLogged" => Self::ExerciseLogged,
            "SetLogged" => Self::SetLogged,
            "FoodLogged" => Self::FoodLogged,
            "CalorieTargetHit" => Self::CalorieTargetHit,
            "ProteinGoalHit" => Self::ProteinGoalHit,
            "HabitCompleted" => Self::HabitCompleted,
            "BodyMetricUpdated" => Self::BodyMetricUpdated,
            "RecoveryDayTaken" => Self::RecoveryDayTaken,
            "GoalCreated" => Self::GoalCreated,
            "GoalCompleted" => Self::GoalCompleted,
            _ => return None,
        })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthEvent {
    pub id: Uuid,
    pub user_id: UserId,
    pub kind: HealthEventKind,
    pub occurred_at: DateTime<Utc>,
    pub source: EventSource,
    pub summary: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub enum EventSource {
    HealthApp,
    Mobile,
    Unity,
    Api,
}

impl EventSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::HealthApp => "health_app",
            Self::Mobile => "mobile",
            Self::Unity => "unity",
            Self::Api => "api",
        }
    }

    pub fn from_database_value(value: &str) -> Option<Self> {
        Some(match value {
            "health_app" => Self::HealthApp,
            "mobile" => Self::Mobile,
            "unity" => Self::Unity,
            "api" => Self::Api,
            _ => return None,
        })
    }
}

impl HealthEvent {
    pub fn new(
        user_id: UserId,
        kind: HealthEventKind,
        occurred_at: DateTime<Utc>,
        source: EventSource,
        summary: impl Into<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id,
            kind,
            occurred_at,
            source,
            summary: summary.into(),
        }
    }
}
