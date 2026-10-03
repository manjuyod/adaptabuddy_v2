use chrono::{Duration, Utc};
use core_domain::UserId;
use shared_types::{
    Profile, WorkoutDayView, WorkoutExerciseView, WorkoutPlanView, WorkoutSessionCreateRequest,
    WorkoutSessionExerciseInput,
};
use storage::AppStore;
use uuid::Uuid;

fn plan() -> WorkoutPlanView {
    let plan_id = Uuid::new_v4();
    let day_id = Uuid::new_v4();
    WorkoutPlanView {
        id: plan_id,
        start_date: Utc::now().date_naive(),
        end_date: Utc::now().date_naive(),
        status: "active".into(),
        class_selection: "no_class".into(),
        preferred_training_goal: None,
        warnings: vec![],
        days: vec![WorkoutDayView {
            id: day_id,
            workout_plan_id: plan_id,
            scheduled_date: Utc::now().date_naive(),
            status: "planned".into(),
            name: "Test day".into(),
            notes: None,
            exercises: vec![WorkoutExerciseView {
                id: Uuid::new_v4(),
                workout_day_id: day_id,
                exercise_slug: "squat".into(),
                name: "Squat".into(),
                sets: 3,
                reps: 8,
                caution_notes: vec![],
            }],
        }],
    }
}

fn exercise(id: Option<Uuid>) -> Vec<WorkoutSessionExerciseInput> {
    vec![WorkoutSessionExerciseInput {
        workout_exercise_id: id,
        exercise_slug: "squat".into(),
        status: "completed".into(),
        sets_completed: Some(3),
        notes: None,
    }]
}

async fn completion_contract(store: AppStore, user: UserId, other: UserId) {
    let workout_plan = store.save_workout_plan(&user, plan()).await.unwrap();
    let day = &workout_plan.days[0];
    assert!(
        store
            .create_workout_session_v0(
                &other,
                WorkoutSessionCreateRequest {
                    workout_day_id: Some(day.id),
                    started_at: None,
                }
            )
            .await
            .is_err(),
        "a session must not link another owner's day"
    );

    let started_at = Utc::now() - Duration::minutes(30);
    let session = store
        .create_workout_session_v0(
            &user,
            WorkoutSessionCreateRequest {
                workout_day_id: Some(day.id),
                started_at: Some(started_at),
            },
        )
        .await
        .unwrap();
    assert!(
        store.workouts(&user).await.unwrap().is_empty(),
        "started sessions are not completed history"
    );

    assert!(store
        .finish_workout_session_v0(&other, session.id, exercise(None), Utc::now(), 25)
        .await
        .is_err());
    assert!(store.xp_events(&other).await.unwrap().is_empty());

    let unrelated_plan = store.save_workout_plan(&user, plan()).await.unwrap();
    assert!(
        store
            .finish_workout_session_v0(
                &user,
                session.id,
                exercise(Some(unrelated_plan.days[0].exercises[0].id)),
                Utc::now(),
                25
            )
            .await
            .is_err(),
        "a linked exercise must belong to the session day"
    );
    assert!(store
        .workout_session_v0(&user, session.id)
        .await
        .unwrap()
        .finished_at
        .is_none());

    let finished_at = started_at + Duration::minutes(30);
    let (first, retry) = tokio::join!(
        store.finish_workout_session_v0(
            &user,
            session.id,
            exercise(Some(day.exercises[0].id)),
            finished_at,
            25
        ),
        store.finish_workout_session_v0(
            &user,
            session.id,
            exercise(Some(day.exercises[0].id)),
            finished_at,
            25
        )
    );
    let first = first.unwrap();
    let retry = retry.unwrap();
    assert_eq!(first.exercises.len(), 1);
    assert_eq!(
        first.exercises[0].id, retry.exercises[0].id,
        "retries return the saved completion"
    );
    assert_eq!(store.xp_events(&user).await.unwrap().len(), 1);
    assert_eq!(store.events(&user).await.unwrap().len(), 1);
    assert_eq!(store.workouts(&user).await.unwrap().len(), 1);
    assert_eq!(store.workouts(&user).await.unwrap()[0].duration_minutes, 30);
    assert!(
        store
            .patch_workout_session_status(&user, session.id, "started".into())
            .await
            .is_err(),
        "finished sessions cannot be reopened for another award"
    );
    assert_eq!(
        store
            .workout_plans(&user)
            .await
            .unwrap()
            .iter()
            .find(|p| p.id == workout_plan.id)
            .unwrap()
            .days[0]
            .status,
        "completed"
    );
}

#[tokio::test]
async fn memory_completion_is_owned_atomic_and_idempotent() {
    completion_contract(
        AppStore::new(),
        UserId(Uuid::new_v4()),
        UserId(Uuid::new_v4()),
    )
    .await;
}

async fn postgres_store() -> (AppStore, sqlx::PgPool, UserId, UserId) {
    let url = std::env::var("STORAGE_TEST_DATABASE_URL")
        .expect("set STORAGE_TEST_DATABASE_URL to a disposable migrated database");
    let pool = sqlx::PgPool::connect(&url).await.unwrap();
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
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_completion_is_owned_atomic_and_idempotent() {
    let (store, pool, user, other) = postgres_store().await;
    completion_contract(store, user.clone(), other.clone()).await;
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_failed_plan_and_profile_writes_roll_back() {
    let (store, pool, user, other) = postgres_store().await;
    let mut invalid = plan();
    invalid.days[0].exercises[0].sets = -1;
    assert!(store.save_workout_plan(&user, invalid).await.is_err());
    assert!(
        store.workout_plans(&user).await.unwrap().is_empty(),
        "a child failure must roll back the plan"
    );
    let original = Profile {
        display_name: Some("Original".into()),
        ..Profile::default()
    };
    store.upsert_profile(&user, original).await.unwrap();
    let invalid = Profile {
        display_name: Some("Must roll back".into()),
        calorie_target: Some(-1),
        ..Profile::default()
    };
    assert!(store.upsert_profile(&user, invalid).await.is_err());
    assert_eq!(
        store.profile(&user).await.unwrap().display_name.as_deref(),
        Some("Original")
    );
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_failed_completion_rolls_back_session_and_exercises() {
    let (store, pool, user, other) = postgres_store().await;
    let session = store
        .create_workout_session_v0(
            &user,
            WorkoutSessionCreateRequest {
                workout_day_id: None,
                started_at: None,
            },
        )
        .await
        .unwrap();
    let mut invalid = exercise(None);
    invalid[0].sets_completed = Some(-1);
    assert!(store
        .finish_workout_session_v0(&user, session.id, invalid, Utc::now(), 25)
        .await
        .is_err());
    let saved = store.workout_session_v0(&user, session.id).await.unwrap();
    assert_eq!(saved.status, "started");
    assert!(saved.finished_at.is_none());
    assert!(saved.exercises.is_empty());
    assert!(store.xp_events(&user).await.unwrap().is_empty());
    assert!(store.events(&user).await.unwrap().is_empty());
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_independent_food_patches_preserve_both_changes() {
    let (store, pool, user, other) = postgres_store().await;
    let entry = store
        .create_food_entry(
            &user,
            serde_json::from_value(serde_json::json!({
                "foodName": "Original", "calories": 100, "proteinGrams": 10
            }))
            .unwrap(),
        )
        .await
        .unwrap();
    let mut blocker = pool.begin().await.unwrap();
    sqlx::query("select id from public.nutrition_food_logs where id = $1 for update")
        .bind(entry.id)
        .fetch_one(&mut *blocker)
        .await
        .unwrap();
    let first_store = store.clone();
    let first_user = user.clone();
    let first = tokio::spawn(async move {
        first_store
            .patch_food_entry(
                &first_user,
                entry.id,
                serde_json::from_value(serde_json::json!({"foodName": "Renamed"})).unwrap(),
            )
            .await
    });
    let second_store = store.clone();
    let second_user = user.clone();
    let second = tokio::spawn(async move {
        second_store
            .patch_food_entry(
                &second_user,
                entry.id,
                serde_json::from_value(serde_json::json!({"calories": 250})).unwrap(),
            )
            .await
    });
    // Both writes wait on the same row, proving the competing requests overlap.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    let both_waiting = loop {
        let waiting: i64 = sqlx::query_scalar("select count(*) from pg_stat_activity where pid <> pg_backend_pid() and state = 'active' and wait_event_type = 'Lock' and query like '%update public.nutrition_food_logs%'")
            .fetch_one(&pool).await.unwrap();
        if waiting >= 2 {
            break true;
        }
        if std::time::Instant::now() >= deadline {
            break false;
        }
        tokio::task::yield_now().await;
    };
    blocker.commit().await.unwrap();
    first.await.unwrap().unwrap();
    second.await.unwrap().unwrap();
    assert!(
        both_waiting,
        "both concurrent updates must be blocked before release"
    );
    let entries = store.food_entries(&user, Default::default()).await.unwrap();
    assert_eq!(entries[0].food_name, "Renamed");
    assert_eq!(entries[0].calories, 250);
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}
