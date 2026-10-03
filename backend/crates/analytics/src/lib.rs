use core_domain::UserId;
use shared_types::DashboardSummary;
use storage::{AppStore, StorageError};

pub async fn dashboard(
    store: &AppStore,
    user_id: &UserId,
) -> Result<DashboardSummary, StorageError> {
    Ok(DashboardSummary {
        nutrition: nutrition::summary(store, user_id).await?,
        workouts: workouts::summary(store, user_id).await?,
        habits: habits::list(store, user_id).await?,
        body_metrics: body_metrics::list(store, user_id).await?,
        goals: goals::list(store, user_id).await?,
        progression: progression::state(store, user_id).await?,
        achievements: achievements::list(store, user_id).await?,
    })
}
