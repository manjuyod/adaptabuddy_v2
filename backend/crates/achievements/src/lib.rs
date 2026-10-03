use core_domain::{HealthEventKind, UserId};
use shared_types::AchievementView;
use storage::{AppStore, StorageError};

pub async fn list(
    store: &AppStore,
    user_id: &UserId,
) -> Result<Vec<AchievementView>, StorageError> {
    let events = store.events(user_id).await?;
    let logged_food = events
        .iter()
        .any(|event| event.kind == HealthEventKind::FoodLogged);
    let completed_workout = events
        .iter()
        .any(|event| event.kind == HealthEventKind::WorkoutCompleted);
    let completed_goal = events
        .iter()
        .any(|event| event.kind == HealthEventKind::GoalCompleted);

    Ok(vec![
        AchievementView {
            id: "first-food-log".to_string(),
            title: "First food log".to_string(),
            unlocked: logged_food,
        },
        AchievementView {
            id: "first-workout".to_string(),
            title: "First workout".to_string(),
            unlocked: completed_workout,
        },
        AchievementView {
            id: "goal-finished".to_string(),
            title: "Goal finished".to_string(),
            unlocked: completed_goal,
        },
    ])
}
