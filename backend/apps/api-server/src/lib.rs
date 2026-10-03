use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, patch, post, put},
    Json, Router,
};
use serde::Serialize;
use shared_types::{
    BodyMetricRequest, ExerciseStatRequest, FoodEntryPatchRequest, FoodEntryQuery,
    FoodEntryRequest, FoodLogRequest, GoalPatchRequest, GoalRequest, HabitCheckInRequest,
    HabitRequest, MeResponse, MobileDashboardBody, MobileDashboardHabits, MobileDashboardResponse,
    MobileDashboardToday, MobileDashboardUser, MobileDashboardWorkout, NutritionTargetsRequest,
    Profile, ProfilePatchRequest, SessionResponse, StatusResponse, UnityPlayerState, UserStatsView,
    WorkoutPlanGenerateRequest, WorkoutSessionCreateRequest, WorkoutSessionFinishRequest,
    WorkoutSessionPatchRequest, WorkoutSessionRequest,
};
use storage::{AppStore, StorageError};
use thiserror::Error;
use tower_http::cors::CorsLayer;
use uuid::Uuid;
use validation::ValidateRequest;

mod validation;

#[derive(Clone)]
pub struct AppState {
    pub store: AppStore,
    pub auth_config: auth::AuthConfig,
}

impl AppState {
    pub fn new(store: AppStore, auth_config: auth::AuthConfig) -> Self {
        Self { store, auth_config }
    }

    pub fn for_tests() -> Self {
        Self {
            store: AppStore::new(),
            auth_config: auth::AuthConfig::local_dev(),
        }
    }
}

pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/me", get(me))
        .route("/me/profile", patch(patch_profile))
        .route("/me/stats", get(me_stats))
        .route("/me/stats/body", post(create_body_metric))
        .route("/me/stats/exercise", post(create_exercise_stat))
        .route("/me/dashboard", get(mobile_dashboard))
        .route(
            "/me/food/entries",
            get(list_food_entries).post(create_food_entry),
        )
        .route(
            "/me/food/entries/:id",
            patch(patch_food_entry).delete(delete_food_entry),
        )
        .route("/me/workouts/plan", get(workout_plans))
        .route("/me/workouts/plan/generate", post(generate_workout_plan))
        .route(
            "/me/workouts/sessions",
            get(workout_sessions).post(create_workout_session_v0),
        )
        .route(
            "/me/workouts/sessions/:id",
            get(workout_session).patch(patch_workout_session),
        )
        .route(
            "/me/workouts/sessions/:id/finish",
            post(finish_workout_session),
        )
        .route("/auth/session", get(auth_session))
        .route("/profile", get(get_profile).patch(patch_profile))
        .route("/health/dashboard", get(health_dashboard))
        .route("/nutrition/food-logs", post(create_food_log))
        .route("/nutrition/summary", get(nutrition_summary))
        .route("/nutrition/targets", put(update_nutrition_targets))
        .route("/workouts/sessions", post(create_workout_session))
        .route("/workouts/history", get(workout_history))
        .route("/workouts/exercises", get(workout_exercises))
        .route("/habits", get(list_habits).post(create_habit))
        .route("/habits/check-ins", post(check_in_habit))
        .route(
            "/body-metrics",
            get(list_body_metrics).post(create_body_metric),
        )
        .route("/goals", get(list_goals).post(create_goal))
        .route("/goals/:id", patch(patch_goal))
        .route("/events/recent", get(recent_events))
        .route("/progression/state", get(progression_state))
        .route("/achievements", get(achievements))
        .route("/clients/unity/player-state", get(unity_player_state))
        .route("/api/v0/health", get(health))
        .route("/api/v0/me", get(me))
        .route("/api/v0/me/profile", patch(patch_profile))
        .route("/api/v0/me/stats", get(me_stats))
        .route("/api/v0/me/stats/body", post(create_body_metric))
        .route("/api/v0/me/stats/exercise", post(create_exercise_stat))
        .route("/api/v0/me/dashboard", get(mobile_dashboard))
        .route(
            "/api/v0/me/food/entries",
            get(list_food_entries).post(create_food_entry),
        )
        .route(
            "/api/v0/me/food/entries/:id",
            patch(patch_food_entry).delete(delete_food_entry),
        )
        .route("/api/v0/me/workouts/plan", get(workout_plans))
        .route(
            "/api/v0/me/workouts/plan/generate",
            post(generate_workout_plan),
        )
        .route(
            "/api/v0/me/workouts/sessions",
            get(workout_sessions).post(create_workout_session_v0),
        )
        .route(
            "/api/v0/me/workouts/sessions/:id",
            get(workout_session).patch(patch_workout_session),
        )
        .route(
            "/api/v0/me/workouts/sessions/:id/finish",
            post(finish_workout_session),
        )
        .route("/api/v0/auth/session", get(auth_session))
        .route("/api/v0/profile", get(get_profile).patch(patch_profile))
        .route("/api/v0/health/dashboard", get(health_dashboard))
        .route("/api/v0/nutrition/food-logs", post(create_food_log))
        .route("/api/v0/nutrition/summary", get(nutrition_summary))
        .route("/api/v0/nutrition/targets", put(update_nutrition_targets))
        .route("/api/v0/workouts/sessions", post(create_workout_session))
        .route("/api/v0/workouts/history", get(workout_history))
        .route("/api/v0/workouts/exercises", get(workout_exercises))
        .route("/api/v0/habits", get(list_habits).post(create_habit))
        .route("/api/v0/habits/check-ins", post(check_in_habit))
        .route(
            "/api/v0/body-metrics",
            get(list_body_metrics).post(create_body_metric),
        )
        .route("/api/v0/goals", get(list_goals).post(create_goal))
        .route("/api/v0/goals/:id", patch(patch_goal))
        .route("/api/v0/events/recent", get(recent_events))
        .route("/api/v0/progression/state", get(progression_state))
        .route("/api/v0/achievements", get(achievements))
        .route(
            "/api/v0/clients/unity/player-state",
            get(unity_player_state),
        )
        .layer(CorsLayer::permissive())
        .with_state(state)
}

async fn health() -> Json<StatusResponse> {
    Json(StatusResponse {
        status: "ok".to_string(),
    })
}

async fn auth_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<SessionResponse>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(SessionResponse {
        user_id: user.user_id.0,
        auth_provider: user.provider,
    }))
}

async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<MeResponse>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    Ok(Json(MeResponse {
        user_id: context.user_id.0,
        auth_provider: context.provider,
        profile: state.store.profile(&context.user_id).await?,
    }))
}

async fn get_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Profile>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(state.store.profile(&user.user_id).await?))
}

async fn patch_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(profile): Json<ProfilePatchRequest>,
) -> Result<Json<Profile>, ApiError> {
    let user = require_user(&state, &headers).await?;
    profile.validate().map_err(ApiError::InvalidRequest)?;
    Ok(Json(
        state.store.patch_profile(&user.user_id, profile).await?,
    ))
}

async fn health_dashboard(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<shared_types::DashboardSummary>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(
        analytics::dashboard(&state.store, &user.user_id).await?,
    ))
}

async fn mobile_dashboard(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<MobileDashboardResponse>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    let profile = state.store.profile(&context.user_id).await?;
    let now = chrono::Utc::now();
    let today = now.date_naive();
    let food_entries = state
        .store
        .food_entries(&context.user_id, FoodEntryQuery::default())
        .await?;
    let today_entries: Vec<_> = food_entries
        .iter()
        .filter(|entry| entry.logged_at.date_naive() == today)
        .collect();
    let today_nutrition = today_entries.iter().fold(
        MobileDashboardToday {
            calories_consumed: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
        },
        |mut totals, entry| {
            totals.calories_consumed = totals.calories_consumed.saturating_add(entry.calories);
            totals.protein_g = totals
                .protein_g
                .saturating_add(entry.protein_grams.unwrap_or(0));
            totals.carbs_g = totals
                .carbs_g
                .saturating_add(entry.carbs_grams.unwrap_or(0));
            totals.fat_g = totals.fat_g.saturating_add(entry.fat_grams.unwrap_or(0));
            totals
        },
    );
    let completed_workouts = workouts::history(&state.store, &context.user_id).await?;
    let plans = workouts::plans(&state.store, &context.user_id).await?;
    let next_workout = plans
        .iter()
        .filter(|plan| plan.status == "active")
        .flat_map(|plan| &plan.days)
        .filter(|day| {
            day.scheduled_date >= today && matches!(day.status.as_str(), "planned" | "started")
        })
        .min_by_key(|day| day.scheduled_date);
    let body_metrics = body_metrics::list(&state.store, &context.user_id).await?;
    let latest_weight = body_metrics
        .iter()
        .filter(|metric| metric.metric.eq_ignore_ascii_case("weight"))
        .max_by(|left, right| left.measured_at.cmp(&right.measured_at));

    Ok(Json(MobileDashboardResponse {
        user: MobileDashboardUser {
            id: context.user_id.0,
            display_name: profile.display_name.clone(),
        },
        today: today_nutrition,
        body: MobileDashboardBody {
            latest_weight: latest_weight.map(|metric| metric.value),
            weight_unit: latest_weight
                .map(|metric| metric.unit.clone())
                .unwrap_or_else(|| default_weight_unit(&profile.unit_system)),
            last_updated: latest_weight.map(|metric| metric.measured_at),
        },
        workout: MobileDashboardWorkout {
            next_workout_date: next_workout.map(|day| day.scheduled_date),
            next_workout_name: next_workout.map(|day| day.name.clone()),
            recommendation: match next_workout {
                Some(day) => format!("Next workout: {}", day.name),
                None if plans.is_empty() => "No workout generated yet".to_string(),
                None => "No upcoming workouts scheduled".to_string(),
            },
        },
        habits: MobileDashboardHabits {
            food_logged_today: !today_entries.is_empty(),
            workout_completed_today: completed_workouts
                .iter()
                .any(|session| session.completed_at.date_naive() == today),
            stats_stale: latest_weight.is_none_or(|metric| {
                now.signed_duration_since(metric.measured_at) > chrono::Duration::days(30)
            }),
        },
    }))
}

fn default_weight_unit(unit_system: &str) -> String {
    if unit_system.eq_ignore_ascii_case("kg") || unit_system.eq_ignore_ascii_case("metric") {
        "kg".to_string()
    } else {
        "lb".to_string()
    }
}

async fn me_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UserStatsView>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    Ok(Json(UserStatsView {
        body_stats: body_metrics::list(&state.store, &context.user_id).await?,
        exercise_stats: state.store.exercise_stats(&context.user_id).await?,
        muscle_groups: state.store.muscle_group_stats(&context.user_id).await?,
        progression: progression::state(&state.store, &context.user_id).await?,
        update_prompt: shared_types::StatsUpdatePrompt {
            needs_update: false,
            reason: None,
        },
    }))
}

async fn create_food_log(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<FoodLogRequest>,
) -> Result<(StatusCode, Json<FoodLogRequest>), ApiError> {
    let user = require_user(&state, &headers).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = nutrition::log_food(&state.store, &user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn create_food_entry(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<FoodEntryRequest>,
) -> Result<(StatusCode, Json<shared_types::FoodEntryView>), ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = nutrition::create_food_entry(&state.store, &context.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn list_food_entries(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<FoodEntryQuery>,
) -> Result<Json<Vec<shared_types::FoodEntryView>>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    query.validate().map_err(ApiError::InvalidRequest)?;
    Ok(Json(
        nutrition::food_entries(&state.store, &context.user_id, query).await?,
    ))
}

async fn patch_food_entry(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(entry_id): Path<Uuid>,
    Json(request): Json<FoodEntryPatchRequest>,
) -> Result<Json<shared_types::FoodEntryView>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    Ok(Json(
        nutrition::patch_food_entry(&state.store, &context.user_id, entry_id, request).await?,
    ))
}

async fn delete_food_entry(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(entry_id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    nutrition::delete_food_entry(&state.store, &context.user_id, entry_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn nutrition_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<shared_types::NutritionSummary>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(nutrition::summary(&state.store, &user.user_id).await?))
}

async fn update_nutrition_targets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<NutritionTargetsRequest>,
) -> Result<Json<shared_types::NutritionSummary>, ApiError> {
    let user = require_user(&state, &headers).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    Ok(Json(
        nutrition::set_targets(&state.store, &user.user_id, request).await?,
    ))
}

async fn create_workout_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<WorkoutSessionRequest>,
) -> Result<(StatusCode, Json<WorkoutSessionRequest>), ApiError> {
    let user = require_user(&state, &headers).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = workouts::complete_session(&state.store, &user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn generate_workout_plan(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<WorkoutPlanGenerateRequest>,
) -> Result<(StatusCode, Json<shared_types::WorkoutPlanView>), ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = workouts::generate_plan(&state.store, &context.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn workout_plans(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<shared_types::WorkoutPlanView>>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    Ok(Json(workouts::plans(&state.store, &context.user_id).await?))
}

async fn create_workout_session_v0(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<WorkoutSessionCreateRequest>,
) -> Result<(StatusCode, Json<shared_types::WorkoutSessionView>), ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    let saved = workouts::create_session(&state.store, &context.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn workout_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<shared_types::WorkoutSessionView>>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    Ok(Json(
        workouts::sessions(&state.store, &context.user_id).await?,
    ))
}

async fn workout_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
) -> Result<Json<shared_types::WorkoutSessionView>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    Ok(Json(
        workouts::session(&state.store, &context.user_id, session_id).await?,
    ))
}

async fn patch_workout_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(request): Json<WorkoutSessionPatchRequest>,
) -> Result<Json<shared_types::WorkoutSessionView>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    Ok(Json(
        workouts::patch_session(&state.store, &context.user_id, session_id, request).await?,
    ))
}

async fn finish_workout_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(request): Json<WorkoutSessionFinishRequest>,
) -> Result<Json<shared_types::WorkoutSessionView>, ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    Ok(Json(
        workouts::finish_session(&state.store, &context.user_id, session_id, request).await?,
    ))
}

async fn workout_history(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<WorkoutSessionRequest>>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(workouts::history(&state.store, &user.user_id).await?))
}

async fn workout_exercises(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<&'static str>>, ApiError> {
    require_user(&state, &headers).await?;
    Ok(Json(workouts::exercises()))
}

async fn create_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<HabitRequest>,
) -> Result<(StatusCode, Json<shared_types::HabitView>), ApiError> {
    let user = require_user(&state, &headers).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = habits::create(&state.store, &user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn check_in_habit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<HabitCheckInRequest>,
) -> Result<Json<shared_types::HabitView>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(
        habits::check_in(&state.store, &user.user_id, request).await?,
    ))
}

async fn list_habits(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<shared_types::HabitView>>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(habits::list(&state.store, &user.user_id).await?))
}

async fn create_body_metric(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<BodyMetricRequest>,
) -> Result<(StatusCode, Json<shared_types::BodyMetricView>), ApiError> {
    let user = require_user(&state, &headers).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = body_metrics::record(&state.store, &user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn create_exercise_stat(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<ExerciseStatRequest>,
) -> Result<(StatusCode, Json<shared_types::ExerciseStatView>), ApiError> {
    let context = require_auth_context(&state, &headers, auth::RouteClass::User).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = state
        .store
        .add_exercise_stat(&context.user_id, request)
        .await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn list_body_metrics(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<shared_types::BodyMetricView>>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(body_metrics::list(&state.store, &user.user_id).await?))
}

async fn create_goal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<GoalRequest>,
) -> Result<(StatusCode, Json<shared_types::GoalView>), ApiError> {
    let user = require_user(&state, &headers).await?;
    request.validate().map_err(ApiError::InvalidRequest)?;
    let saved = goals::create(&state.store, &user.user_id, request).await?;
    Ok((StatusCode::CREATED, Json(saved)))
}

async fn patch_goal(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(goal_id): Path<Uuid>,
    Json(request): Json<GoalPatchRequest>,
) -> Result<Json<shared_types::GoalView>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(
        goals::patch(&state.store, &user.user_id, goal_id, request).await?,
    ))
}

async fn list_goals(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<shared_types::GoalView>>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(goals::list(&state.store, &user.user_id).await?))
}

async fn recent_events(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<core_domain::HealthEvent>>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(
        events::recent_events(&state.store, &user.user_id).await?,
    ))
}

async fn progression_state(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<shared_types::ProgressionState>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(progression::state(&state.store, &user.user_id).await?))
}

async fn achievements(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<shared_types::AchievementView>>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(achievements::list(&state.store, &user.user_id).await?))
}

async fn unity_player_state(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UnityPlayerState>, ApiError> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(UnityPlayerState {
        source: "backend".to_string(),
        progression: progression::state(&state.store, &user.user_id).await?,
        achievements: achievements::list(&state.store, &user.user_id).await?,
        presentation_hints: vec![
            "Render progression as the RPG layer; do not persist game state locally.".to_string(),
            "Use achievements as visual unlocks derived from health events.".to_string(),
        ],
    }))
}

async fn require_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<auth::AuthenticatedUser, ApiError> {
    auth::authenticate(headers, &state.auth_config)
        .await
        .map_err(ApiError::from)
}

async fn require_auth_context(
    state: &AppState,
    headers: &HeaderMap,
    route_class: auth::RouteClass,
) -> Result<auth::AuthContext, ApiError> {
    Ok(auth::AuthContext::new(
        require_user(state, headers).await?,
        route_class,
    ))
}

#[derive(Debug, Error)]
enum ApiError {
    #[error("{0}")]
    InvalidRequest(&'static str),
    #[error(transparent)]
    Auth(#[from] auth::AuthError),
    #[error(transparent)]
    Storage(#[from] StorageError),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    code: &'static str,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            ApiError::InvalidRequest(message) => (
                StatusCode::BAD_REQUEST,
                "invalid_request",
                (*message).to_string(),
            ),
            ApiError::Auth(auth::AuthError::MissingToken | auth::AuthError::InvalidToken) => (
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "Missing or invalid access token".to_string(),
            ),
            ApiError::Storage(StorageError::NotFound) => {
                (StatusCode::NOT_FOUND, "not_found", self.to_string())
            }
            ApiError::Storage(StorageError::Conflict) => {
                (StatusCode::CONFLICT, "conflict", self.to_string())
            }
            ApiError::Storage(StorageError::Poisoned)
            | ApiError::Storage(StorageError::Database(_))
            | ApiError::Storage(StorageError::InvalidEventKind(_))
            | ApiError::Storage(StorageError::InvalidEventSource(_)) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "The request could not be completed".to_string(),
            ),
        };

        (
            status,
            Json(ErrorResponse {
                error: ErrorBody { code, message },
            }),
        )
            .into_response()
    }
}
