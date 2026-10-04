use chrono::{Duration, Utc};
use core_domain::UserId;
use shared_types::{
    WorkoutDayView, WorkoutExerciseView, WorkoutPlanGenerateRequest, WorkoutPlanView,
    WorkoutSessionCreateRequest, WorkoutSessionExerciseInput, WorkoutSessionFinishRequest,
    WorkoutSessionPatchRequest, WorkoutSessionRequest, WorkoutSessionView, WorkoutSummary,
};
use storage::{AppStore, StorageError};
use uuid::Uuid;

pub async fn complete_session(
    store: &AppStore,
    user_id: &UserId,
    request: WorkoutSessionRequest,
) -> Result<WorkoutSessionRequest, StorageError> {
    store.add_workout(user_id, request).await
}

pub async fn history(
    store: &AppStore,
    user_id: &UserId,
) -> Result<Vec<WorkoutSessionRequest>, StorageError> {
    store.workouts(user_id).await
}

pub async fn summary(store: &AppStore, user_id: &UserId) -> Result<WorkoutSummary, StorageError> {
    let sessions = store.workouts(user_id).await?;
    Ok(WorkoutSummary {
        completed_sessions: sessions.len(),
        total_minutes: sessions.iter().fold(0_i32, |total, entry| {
            total.saturating_add(entry.duration_minutes)
        }),
    })
}

pub async fn exercises(store: &AppStore) -> Result<Vec<String>, StorageError> {
    store.catalog_exercise_slugs().await
}

pub async fn generate_plan(
    store: &AppStore,
    user_id: &UserId,
    request: WorkoutPlanGenerateRequest,
) -> Result<WorkoutPlanView, StorageError> {
    let plan_id = Uuid::new_v4();
    let class_selection = request
        .class_selection
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "no_class".to_string());
    let available_days = request.available_days_per_week.clamp(1, 7);
    let total_days = (request.end_date - request.start_date).num_days().max(0) + 1;
    let warnings: Vec<String> = request
        .injury_zones
        .iter()
        .map(|zone| format!("Use caution around {zone}."))
        .collect();

    let days = (0..total_days)
        .filter(|offset| {
            (0..available_days)
                .any(|index| offset % 7 == i64::from(index) * 7 / i64::from(available_days))
        })
        .enumerate()
        .map(|(index, offset)| {
            let scheduled_date = request.start_date + Duration::days(offset);
            let day_id = Uuid::new_v4();
            let caution_notes = if warnings.is_empty() {
                Vec::new()
            } else {
                warnings.clone()
            };
            WorkoutDayView {
                id: day_id,
                workout_plan_id: plan_id,
                scheduled_date,
                status: "planned".to_string(),
                name: format!("Workout Day {}", index + 1),
                notes: request.preferred_training_goal.clone(),
                exercises: starter_exercises(day_id, &caution_notes),
            }
        })
        .collect();

    let plan = WorkoutPlanView {
        id: plan_id,
        start_date: request.start_date,
        end_date: request.end_date,
        status: "active".to_string(),
        class_selection,
        preferred_training_goal: request.preferred_training_goal,
        warnings,
        days,
    };

    store.save_workout_plan(user_id, plan).await
}

pub async fn plans(
    store: &AppStore,
    user_id: &UserId,
) -> Result<Vec<WorkoutPlanView>, StorageError> {
    store.workout_plans(user_id).await
}

pub async fn create_session(
    store: &AppStore,
    user_id: &UserId,
    request: WorkoutSessionCreateRequest,
) -> Result<WorkoutSessionView, StorageError> {
    store.create_workout_session_v0(user_id, request).await
}

pub async fn sessions(
    store: &AppStore,
    user_id: &UserId,
) -> Result<Vec<WorkoutSessionView>, StorageError> {
    store.workout_sessions_v0(user_id).await
}

pub async fn session(
    store: &AppStore,
    user_id: &UserId,
    session_id: Uuid,
) -> Result<WorkoutSessionView, StorageError> {
    store.workout_session_v0(user_id, session_id).await
}

pub async fn patch_session(
    store: &AppStore,
    user_id: &UserId,
    session_id: Uuid,
    request: WorkoutSessionPatchRequest,
) -> Result<WorkoutSessionView, StorageError> {
    let Some(status) = request.status else {
        return store.workout_session_v0(user_id, session_id).await;
    };
    store
        .patch_workout_session_status(user_id, session_id, status)
        .await
}

pub async fn finish_session(
    store: &AppStore,
    user_id: &UserId,
    session_id: Uuid,
    request: WorkoutSessionFinishRequest,
) -> Result<WorkoutSessionView, StorageError> {
    let finished_at = request.finished_at.unwrap_or_else(Utc::now);
    let xp_awarded = xp_for_completion(&request.exercises);
    store
        .finish_workout_session_v0(
            user_id,
            session_id,
            request.exercises,
            finished_at,
            xp_awarded,
        )
        .await
}

fn starter_exercises(day_id: Uuid, caution_notes: &[String]) -> Vec<WorkoutExerciseView> {
    [
        ("bodyweight_squat", "Bodyweight squat"),
        ("push_up", "Push-up"),
        ("dumbbell_row", "Dumbbell row"),
    ]
    .into_iter()
    .map(|(exercise_slug, name)| WorkoutExerciseView {
        id: Uuid::new_v4(),
        workout_day_id: day_id,
        exercise_slug: exercise_slug.to_string(),
        name: name.to_string(),
        sets: 3,
        reps: 8,
        caution_notes: caution_notes.to_vec(),
        prescription: None,
    })
    .collect()
}

fn xp_for_completion(exercises: &[WorkoutSessionExerciseInput]) -> i32 {
    let base = if exercises
        .iter()
        .any(|exercise| matches!(exercise.status.as_str(), "completed" | "partial"))
    {
        20
    } else {
        0
    };
    let completed = exercises
        .iter()
        .filter(|exercise| exercise.status == "completed")
        .count() as i32;
    base + (completed * 5)
}
