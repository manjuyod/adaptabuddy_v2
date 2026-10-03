use core_domain::{HealthEventKind, UserId};
use shared_types::ProgressionState;
use storage::{AppStore, StorageError};

pub async fn state(store: &AppStore, user_id: &UserId) -> Result<ProgressionState, StorageError> {
    let xp_events = store.xp_events(user_id).await?;
    if !xp_events.is_empty() {
        let xp = xp_events
            .iter()
            .fold(0_i32, |total, event| total.saturating_add(event.amount));
        return Ok(ProgressionState {
            xp,
            level: (xp / 100) + 1,
            streak: streak_from_events(xp_events.len()),
        });
    }

    let events = store.events(user_id).await?;
    let xp = events.iter().fold(0_i32, |total, event| {
        total.saturating_add(xp_for(&event.kind))
    });
    Ok(ProgressionState {
        xp,
        level: (xp / 100) + 1,
        streak: streak_from_events(events.len()),
    })
}

fn xp_for(kind: &HealthEventKind) -> i32 {
    match kind {
        HealthEventKind::WorkoutCompleted => 30,
        HealthEventKind::ExerciseLogged => 10,
        HealthEventKind::SetLogged => 5,
        HealthEventKind::FoodLogged => 5,
        HealthEventKind::CalorieTargetHit => 15,
        HealthEventKind::ProteinGoalHit => 15,
        HealthEventKind::HabitCompleted => 10,
        HealthEventKind::BodyMetricUpdated => 5,
        HealthEventKind::RecoveryDayTaken => 10,
        HealthEventKind::GoalCreated => 5,
        HealthEventKind::GoalCompleted => 50,
    }
}

fn streak_from_events(event_count: usize) -> i32 {
    if event_count == 0 {
        0
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use core_domain::{EventSource, HealthEvent};

    #[tokio::test]
    async fn large_xp_totals_do_not_overflow() {
        let store = AppStore::new();
        let user_id = UserId(uuid::Uuid::new_v4());
        for _ in 0..2 {
            store
                .add_xp_event(&user_id, i32::MAX, "earned", Utc::now())
                .await
                .unwrap();
        }
        let state = state(&store, &user_id).await.unwrap();
        assert_eq!(state.xp, i32::MAX);
        assert_eq!(state.level, 21_474_837);
    }

    #[tokio::test]
    async fn derives_progress_from_health_events() {
        let store = AppStore::new();
        let user_id = UserId(uuid::Uuid::new_v4());

        store
            .append_event(HealthEvent::new(
                user_id.clone(),
                HealthEventKind::FoodLogged,
                Utc::now(),
                EventSource::Api,
                "food",
            ))
            .await
            .expect("food event should save");
        store
            .append_event(HealthEvent::new(
                user_id.clone(),
                HealthEventKind::WorkoutCompleted,
                Utc::now(),
                EventSource::Api,
                "workout",
            ))
            .await
            .expect("workout event should save");

        let state = state(&store, &user_id)
            .await
            .expect("progression should derive");
        assert_eq!(state.xp, 35);
        assert_eq!(state.level, 1);
        assert_eq!(state.streak, 1);
    }
}
