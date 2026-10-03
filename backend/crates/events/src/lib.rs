use chrono::{DateTime, Utc};
use core_domain::{EventSource, HealthEvent, HealthEventKind, UserId};
use storage::{AppStore, StorageError};

pub async fn record_event(
    store: &AppStore,
    user_id: &UserId,
    kind: HealthEventKind,
    summary: impl Into<String>,
    occurred_at: DateTime<Utc>,
) -> Result<HealthEvent, StorageError> {
    store
        .append_event(HealthEvent::new(
            user_id.clone(),
            kind,
            occurred_at,
            EventSource::Api,
            summary,
        ))
        .await
}

pub async fn recent_events(
    store: &AppStore,
    user_id: &UserId,
) -> Result<Vec<HealthEvent>, StorageError> {
    let mut events = store.events(user_id).await?;
    events.sort_by_key(|event| std::cmp::Reverse(event.occurred_at));
    Ok(events.into_iter().take(25).collect())
}
