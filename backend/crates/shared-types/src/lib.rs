use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub status: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponse {
    pub user_id: Uuid,
    pub auth_provider: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub display_name: Option<String>,
    pub unit_system: String,
    pub calorie_target: Option<i32>,
    pub protein_target_grams: Option<i32>,
    #[serde(default)]
    pub birth_date: Option<NaiveDate>,
    #[serde(default)]
    pub formula_sex: Option<String>,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            display_name: None,
            unit_system: "lbs".to_string(),
            calorie_target: None,
            protein_target_grams: None,
            birth_date: None,
            formula_sex: None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodLogRequest {
    pub food_name: String,
    pub calories: i32,
    #[serde(default)]
    pub protein_grams: i32,
}

/// Missing fields are preserved; explicit null clears nullable profile fields.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfilePatchRequest {
    #[serde(
        default,
        deserialize_with = "present_nullable",
        skip_serializing_if = "Option::is_none"
    )]
    pub display_name: Option<Option<String>>,
    #[serde(
        default,
        deserialize_with = "present_non_null",
        skip_serializing_if = "Option::is_none"
    )]
    pub unit_system: Option<String>,
    #[serde(
        default,
        deserialize_with = "present_nullable",
        skip_serializing_if = "Option::is_none"
    )]
    pub calorie_target: Option<Option<i32>>,
    #[serde(
        default,
        deserialize_with = "present_nullable",
        skip_serializing_if = "Option::is_none"
    )]
    pub protein_target_grams: Option<Option<i32>>,
    #[serde(
        default,
        deserialize_with = "present_nullable",
        skip_serializing_if = "Option::is_none"
    )]
    pub birth_date: Option<Option<NaiveDate>>,
    #[serde(
        default,
        deserialize_with = "present_nullable",
        skip_serializing_if = "Option::is_none"
    )]
    pub formula_sex: Option<Option<String>>,
}

fn present_nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

fn present_non_null<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    T::deserialize(deserializer).map(Some)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NutritionTargetsRequest {
    pub calorie_target: Option<i32>,
    pub protein_target_grams: Option<i32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NutritionSummary {
    pub calories_logged: i32,
    pub protein_grams: i32,
    pub calorie_target: Option<i32>,
    pub protein_target_grams: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bmr_estimate: Option<i32>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionRequest {
    pub name: String,
    pub duration_minutes: i32,
    pub completed_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSummary {
    pub completed_sessions: usize,
    pub total_minutes: i32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitRequest {
    pub name: String,
    pub cadence: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitCheckInRequest {
    pub habit_id: Uuid,
    pub completed_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitView {
    pub id: Uuid,
    pub name: String,
    pub cadence: String,
    pub completions: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BodyMetricRequest {
    pub metric: String,
    pub value: f64,
    pub unit: String,
    pub measured_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BodyMetricView {
    pub metric: String,
    pub value: f64,
    pub unit: String,
    pub measured_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseStatRequest {
    pub exercise_slug: String,
    #[serde(default)]
    pub estimated_one_rep_max: Option<f64>,
    #[serde(default)]
    pub weight: Option<f64>,
    #[serde(default)]
    pub reps: Option<i32>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub recorded_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExerciseStatView {
    pub id: Uuid,
    pub exercise_slug: String,
    pub estimated_one_rep_max: Option<f64>,
    pub weight: Option<f64>,
    pub reps: Option<i32>,
    pub unit: Option<String>,
    pub recorded_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MuscleGroupStatView {
    pub muscle_group: String,
    pub score: i32,
    pub training_frequency: i32,
    pub caution: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsUpdatePrompt {
    pub needs_update: bool,
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserStatsView {
    pub body_stats: Vec<BodyMetricView>,
    pub exercise_stats: Vec<ExerciseStatView>,
    pub muscle_groups: Vec<MuscleGroupStatView>,
    pub progression: ProgressionState,
    pub update_prompt: StatsUpdatePrompt,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodEntryRequest {
    pub food_name: String,
    #[serde(default = "default_meal_type")]
    pub meal_type: String,
    pub calories: i32,
    #[serde(default)]
    pub protein_grams: Option<i32>,
    #[serde(default)]
    pub carbs_grams: Option<i32>,
    #[serde(default)]
    pub fat_grams: Option<i32>,
    #[serde(default)]
    pub logged_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub metadata: Value,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodEntryPatchRequest {
    #[serde(default)]
    pub food_name: Option<String>,
    #[serde(default)]
    pub meal_type: Option<String>,
    #[serde(default)]
    pub calories: Option<i32>,
    #[serde(default)]
    pub protein_grams: Option<i32>,
    #[serde(default)]
    pub carbs_grams: Option<i32>,
    #[serde(default)]
    pub fat_grams: Option<i32>,
    #[serde(default)]
    pub logged_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodEntryQuery {
    #[serde(default)]
    pub meal_type: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodEntryView {
    pub id: Uuid,
    pub food_name: String,
    pub meal_type: String,
    pub calories: i32,
    pub protein_grams: Option<i32>,
    pub carbs_grams: Option<i32>,
    pub fat_grams: Option<i32>,
    pub logged_at: DateTime<Utc>,
    pub metadata: Value,
}

fn default_meal_type() -> String {
    "other".to_string()
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalRequest {
    pub title: String,
    pub target: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalPatchRequest {
    pub completed: Option<bool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalView {
    pub id: Uuid,
    pub title: String,
    pub target: String,
    pub completed: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressionState {
    pub xp: i32,
    pub level: i32,
    pub streak: i32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct XpEventView {
    pub id: Uuid,
    pub amount: i32,
    pub reason: String,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementView {
    pub id: String,
    pub title: String,
    pub unlocked: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub nutrition: NutritionSummary,
    pub workouts: WorkoutSummary,
    pub habits: Vec<HabitView>,
    pub body_metrics: Vec<BodyMetricView>,
    pub goals: Vec<GoalView>,
    pub progression: ProgressionState,
    pub achievements: Vec<AchievementView>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MobileDashboardResponse {
    pub user: MobileDashboardUser,
    pub today: MobileDashboardToday,
    pub body: MobileDashboardBody,
    pub workout: MobileDashboardWorkout,
    pub habits: MobileDashboardHabits,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MobileDashboardUser {
    pub id: Uuid,
    pub display_name: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MobileDashboardToday {
    pub calories_consumed: i32,
    pub protein_g: i32,
    pub carbs_g: i32,
    pub fat_g: i32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MobileDashboardBody {
    pub latest_weight: Option<f64>,
    pub weight_unit: String,
    pub last_updated: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MobileDashboardWorkout {
    pub next_workout_date: Option<NaiveDate>,
    pub next_workout_name: Option<String>,
    pub recommendation: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MobileDashboardHabits {
    pub food_logged_today: bool,
    pub workout_completed_today: bool,
    pub stats_stale: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnityPlayerState {
    pub source: String,
    pub progression: ProgressionState,
    pub achievements: Vec<AchievementView>,
    pub presentation_hints: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub user_id: Uuid,
    pub auth_provider: String,
    pub profile: Profile,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramSelectionInput {
    pub program_slug: String,
    #[serde(default)]
    pub weight: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutPlanGenerateRequest {
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub available_days_per_week: u8,
    #[serde(default)]
    pub fatigue_level: Option<i32>,
    #[serde(default)]
    pub preferred_training_goal: Option<String>,
    #[serde(default)]
    pub class_selection: Option<String>,
    #[serde(default)]
    pub injury_zones: Vec<String>,
    #[serde(default)]
    pub program_selection: Vec<ProgramSelectionInput>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutExerciseView {
    pub id: Uuid,
    pub workout_day_id: Uuid,
    pub exercise_slug: String,
    pub name: String,
    pub sets: i32,
    pub reps: i32,
    pub caution_notes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutDayView {
    pub id: Uuid,
    pub workout_plan_id: Uuid,
    pub scheduled_date: NaiveDate,
    pub status: String,
    pub name: String,
    pub notes: Option<String>,
    pub exercises: Vec<WorkoutExerciseView>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutPlanView {
    pub id: Uuid,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub status: String,
    pub class_selection: String,
    pub preferred_training_goal: Option<String>,
    pub warnings: Vec<String>,
    pub days: Vec<WorkoutDayView>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionCreateRequest {
    #[serde(default)]
    pub workout_day_id: Option<Uuid>,
    #[serde(default)]
    pub started_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionPatchRequest {
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionExerciseInput {
    #[serde(default)]
    pub workout_exercise_id: Option<Uuid>,
    pub exercise_slug: String,
    pub status: String,
    #[serde(default)]
    pub sets_completed: Option<i32>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionFinishRequest {
    #[serde(default)]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub exercises: Vec<WorkoutSessionExerciseInput>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionExerciseView {
    pub id: Uuid,
    pub workout_session_id: Uuid,
    pub workout_exercise_id: Option<Uuid>,
    pub exercise_slug: String,
    pub status: String,
    pub sets_completed: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkoutSessionView {
    pub id: Uuid,
    pub workout_day_id: Option<Uuid>,
    pub status: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub exercises: Vec<WorkoutSessionExerciseView>,
    pub xp_awarded: i32,
}
