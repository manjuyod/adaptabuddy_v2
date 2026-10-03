use chrono::{DateTime, Utc};
use core_domain::{EventSource, HealthEventKind, UserId};
use shared_types::{BodyMetricView, FoodEntryRequest, FoodLogRequest, WorkoutSessionRequest};
use sqlx::PgPool;
use storage::{AppStore, StorageError};
use uuid::Uuid;

fn occurred_at() -> DateTime<Utc> {
    "2026-01-02T03:04:05Z".parse().unwrap()
}

fn food() -> FoodEntryRequest {
    serde_json::from_value(serde_json::json!({
        "foodName": "Apple", "calories": 80, "loggedAt": occurred_at()
    }))
    .unwrap()
}

fn workout() -> WorkoutSessionRequest {
    WorkoutSessionRequest {
        name: "Walk".into(),
        duration_minutes: 20,
        completed_at: occurred_at(),
    }
}

fn metric() -> BodyMetricView {
    BodyMetricView {
        metric: "weight".into(),
        value: 70.0,
        unit: "kg".into(),
        measured_at: occurred_at(),
    }
}

async fn activity_contract(store: AppStore, user: UserId, other: UserId) {
    store.create_food_entry(&user, food()).await.unwrap();
    store
        .add_food_log(
            &user,
            FoodLogRequest {
                food_name: "Toast".into(),
                calories: 100,
                protein_grams: 5,
            },
        )
        .await
        .unwrap();
    store.add_workout(&user, workout()).await.unwrap();
    let habit = store
        .add_habit(&user, "Stretch".into(), "daily".into())
        .await
        .unwrap();
    store
        .complete_habit(&user, habit.id, occurred_at())
        .await
        .unwrap();
    store.add_body_metric(&user, metric()).await.unwrap();
    let goal = store
        .add_goal(&user, "Walk farther".into(), "5km".into())
        .await
        .unwrap();
    let (first, retry) = tokio::join!(
        store.patch_goal(&user, goal.id, Some(true)),
        store.patch_goal(&user, goal.id, Some(true))
    );
    assert!(first.unwrap().completed && retry.unwrap().completed);
    store.patch_goal(&user, goal.id, None).await.unwrap();
    store.patch_goal(&user, goal.id, Some(true)).await.unwrap();
    assert!(matches!(
        store.patch_goal(&other, goal.id, Some(true)).await,
        Err(StorageError::NotFound)
    ));
    assert!(matches!(
        store.complete_habit(&other, habit.id, occurred_at()).await,
        Err(StorageError::NotFound)
    ));
    assert!(store.events(&other).await.unwrap().is_empty());

    let events = store.events(&user).await.unwrap();
    assert_eq!(
        events.len(),
        7,
        "exactly one event per successful operation, including a retried goal completion"
    );
    for (kind, summary) in [
        (HealthEventKind::FoodLogged, "Food logged: Apple"),
        (HealthEventKind::WorkoutCompleted, "Workout completed: Walk"),
        (HealthEventKind::HabitCompleted, "Habit completed: Stretch"),
        (
            HealthEventKind::BodyMetricUpdated,
            "Body metric updated: weight",
        ),
    ] {
        let event = events
            .iter()
            .find(|event| event.summary == summary)
            .unwrap();
        assert_eq!(event.kind, kind);
        assert_eq!(event.source, EventSource::Api);
        assert_eq!(event.occurred_at, occurred_at());
    }
    assert_eq!(
        events
            .iter()
            .filter(|event| event.kind == HealthEventKind::GoalCreated)
            .count(),
        1
    );
    assert_eq!(
        events
            .iter()
            .filter(|event| event.kind == HealthEventKind::GoalCompleted)
            .count(),
        1
    );
    let entries = store.food_entries(&user, Default::default()).await.unwrap();
    let toast_time = entries
        .iter()
        .find(|entry| entry.food_name == "Toast")
        .unwrap()
        .logged_at;
    assert_eq!(
        events
            .iter()
            .find(|event| event.summary == "Food logged: Toast")
            .unwrap()
            .occurred_at,
        toast_time
    );
    let xp = store.xp_events(&user).await.unwrap();
    assert_eq!(
        xp.len(),
        3,
        "habits, body metrics and goals must not gain explicit XP awards"
    );
    assert!(xp.iter().any(|event| event.amount == 5
        && event.reason == "food_logged"
        && event.occurred_at == occurred_at()));
    assert!(xp.iter().any(|event| event.amount == 5
        && event.reason == "food_logged"
        && event.occurred_at == toast_time));
    assert!(xp.iter().any(|event| event.amount == 30
        && event.reason == "workout_completed"
        && event.occurred_at == occurred_at()));
    store.patch_goal(&user, goal.id, Some(false)).await.unwrap();
    store.patch_goal(&user, goal.id, Some(true)).await.unwrap();
    assert_eq!(
        store
            .events(&user)
            .await
            .unwrap()
            .iter()
            .filter(|event| event.kind == HealthEventKind::GoalCompleted)
            .count(),
        2,
        "a later false-to-true transition is a new completion"
    );
}

async fn postgres_fixture() -> (AppStore, PgPool, UserId, UserId) {
    let url =
        std::env::var("STORAGE_TEST_DATABASE_URL").expect("use a disposable migrated database");
    let pool = PgPool::connect(&url).await.unwrap();
    let user = UserId(Uuid::new_v4());
    let other = UserId(Uuid::new_v4());
    sqlx::query("insert into auth.users (id) values ($1), ($2)")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
    (AppStore::postgres(pool.clone()), pool, user, other)
}

#[tokio::test]
async fn memory_writes_preserve_activity_contracts_and_goal_retry_semantics() {
    activity_contract(
        AppStore::new(),
        UserId(Uuid::new_v4()),
        UserId(Uuid::new_v4()),
    )
    .await;
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_writes_preserve_activity_contracts_and_goal_retry_semantics() {
    let (store, pool, user, other) = postgres_fixture().await;
    activity_contract(store, user.clone(), other.clone()).await;
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}

#[derive(Clone, Copy, Debug)]
enum Operation {
    FoodEntry,
    FoodLog,
    Workout,
    Habit,
    BodyMetric,
    GoalCreate,
    GoalComplete,
}

impl Operation {
    async fn run(
        self,
        store: &AppStore,
        user: &UserId,
        target_id: Uuid,
    ) -> Result<(), StorageError> {
        match self {
            Self::FoodEntry => store.create_food_entry(user, food()).await.map(|_| ()),
            Self::FoodLog => store
                .add_food_log(
                    user,
                    FoodLogRequest {
                        food_name: "Toast".into(),
                        calories: 100,
                        protein_grams: 5,
                    },
                )
                .await
                .map(|_| ()),
            Self::Workout => store.add_workout(user, workout()).await.map(|_| ()),
            Self::Habit => store
                .complete_habit(user, target_id, occurred_at())
                .await
                .map(|_| ()),
            Self::BodyMetric => store.add_body_metric(user, metric()).await.map(|_| ()),
            Self::GoalCreate => store
                .add_goal(user, "Walk farther".into(), "5km".into())
                .await
                .map(|_| ()),
            Self::GoalComplete => store
                .patch_goal(user, target_id, Some(true))
                .await
                .map(|_| ()),
        }
    }

    fn table(self) -> &'static str {
        match self {
            Self::FoodEntry | Self::FoodLog => "nutrition_food_logs",
            Self::Workout => "workout_sessions",
            Self::Habit => "habit_check_ins",
            Self::BodyMetric => "body_metrics",
            Self::GoalCreate | Self::GoalComplete => "goals",
        }
    }
}

async fn inject_failure(pool: &PgPool, user: &UserId, table: &str) -> String {
    let name = format!("audit_fail_{}", Uuid::new_v4().simple());
    sqlx::raw_sql(&format!(
        "create function public.{name}() returns trigger language plpgsql as $$begin
         if new.user_id = '{}'::uuid then raise exception 'injected activity failure'; end if;
         return new; end;$$;
         create trigger {name} before insert on public.{table} for each row execute function public.{name}();", user.0
    )).execute(pool).await.unwrap();
    name
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_activity_insert_failures_roll_back_every_primary_write() {
    let mut failures = Vec::new();
    for (operation, failing_table) in [
        (Operation::FoodEntry, "health_events"),
        (Operation::FoodLog, "health_events"),
        (Operation::Workout, "health_events"),
        (Operation::Habit, "health_events"),
        (Operation::BodyMetric, "health_events"),
        (Operation::GoalCreate, "health_events"),
        (Operation::GoalComplete, "health_events"),
        (Operation::FoodEntry, "xp_events"),
        (Operation::FoodLog, "xp_events"),
        (Operation::Workout, "xp_events"),
    ] {
        let (store, pool, user, other) = postgres_fixture().await;
        let target_id = match operation {
            Operation::Habit => {
                store
                    .add_habit(&user, "Stretch".into(), "daily".into())
                    .await
                    .unwrap()
                    .id
            }
            Operation::GoalComplete => {
                store
                    .add_goal(&user, "Walk farther".into(), "5km".into())
                    .await
                    .unwrap()
                    .id
            }
            _ => Uuid::nil(),
        };
        let events_before = store.events(&user).await.unwrap().len();
        let trigger = inject_failure(&pool, &user, failing_table).await;
        let result = operation.run(&store, &user, target_id).await;
        let remaining: i64 = sqlx::query_scalar(&format!(
            "select count(*) from public.{} where user_id = $1 {}",
            operation.table(),
            if matches!(operation, Operation::GoalComplete) {
                "and completed"
            } else {
                ""
            }
        ))
        .bind(user.0)
        .fetch_one(&pool)
        .await
        .unwrap();
        let events_after = store.events(&user).await.unwrap().len();
        let xp_after = store.xp_events(&user).await.unwrap().len();
        let injected_error = matches!(&result, Err(StorageError::Database(error)) if error.as_database_error().is_some_and(|error| error.message().contains("injected activity failure")));
        sqlx::raw_sql(&format!(
            "drop trigger {trigger} on public.{failing_table}; drop function public.{trigger}();"
        ))
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("delete from auth.users where id = $1 or id = $2")
            .bind(user.0)
            .bind(other.0)
            .execute(&pool)
            .await
            .unwrap();
        if !injected_error || remaining != 0 || events_before != events_after || xp_after != 0 {
            failures.push(format!("{operation:?}/{failing_table}: injected_error={injected_error}, primary_rows={remaining}, events={events_before}->{events_after}, xp={xp_after}"));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
}
