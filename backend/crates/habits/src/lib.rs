use core_domain::UserId;
use shared_types::{HabitCheckInRequest, HabitRequest, HabitView};
use storage::{AppStore, StorageError};

pub async fn create(
    store: &AppStore,
    user_id: &UserId,
    request: HabitRequest,
) -> Result<HabitView, StorageError> {
    store
        .add_habit(user_id, request.name, request.cadence)
        .await
}

pub async fn check_in(
    store: &AppStore,
    user_id: &UserId,
    request: HabitCheckInRequest,
) -> Result<HabitView, StorageError> {
    store
        .complete_habit(user_id, request.habit_id, request.completed_at)
        .await
}

pub async fn list(store: &AppStore, user_id: &UserId) -> Result<Vec<HabitView>, StorageError> {
    store.habits(user_id).await
}
