use core_domain::UserId;
use shared_types::{GoalPatchRequest, GoalRequest, GoalView};
use storage::{AppStore, StorageError};
use uuid::Uuid;

pub async fn create(
    store: &AppStore,
    user_id: &UserId,
    request: GoalRequest,
) -> Result<GoalView, StorageError> {
    store.add_goal(user_id, request.title, request.target).await
}

pub async fn patch(
    store: &AppStore,
    user_id: &UserId,
    goal_id: Uuid,
    request: GoalPatchRequest,
) -> Result<GoalView, StorageError> {
    store.patch_goal(user_id, goal_id, request.completed).await
}

pub async fn list(store: &AppStore, user_id: &UserId) -> Result<Vec<GoalView>, StorageError> {
    store.goals(user_id).await
}
