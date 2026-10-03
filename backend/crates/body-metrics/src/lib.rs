use core_domain::UserId;
use shared_types::{BodyMetricRequest, BodyMetricView};
use storage::{AppStore, StorageError};

pub async fn record(
    store: &AppStore,
    user_id: &UserId,
    request: BodyMetricRequest,
) -> Result<BodyMetricView, StorageError> {
    let metric = BodyMetricView {
        metric: request.metric,
        value: request.value,
        unit: request.unit,
        measured_at: request.measured_at,
    };
    store.add_body_metric(user_id, metric).await
}

pub async fn list(store: &AppStore, user_id: &UserId) -> Result<Vec<BodyMetricView>, StorageError> {
    store.body_metrics(user_id).await
}
