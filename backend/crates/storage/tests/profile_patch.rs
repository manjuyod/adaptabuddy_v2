use core_domain::UserId;
use shared_types::{Profile, ProfilePatchRequest};
use sqlx::PgPool;
use storage::AppStore;
use uuid::Uuid;

fn profile() -> Profile {
    Profile {
        display_name: Some("Original".into()),
        unit_system: "kg".into(),
        calorie_target: Some(2100),
        protein_target_grams: Some(120),
        birth_date: Some("1990-01-02".parse().unwrap()),
        formula_sex: Some("female".into()),
    }
}

fn patch(value: serde_json::Value) -> ProfilePatchRequest {
    serde_json::from_value(value).unwrap()
}

async fn profile_contract(store: AppStore, user: UserId, other: UserId) {
    store.upsert_profile(&user, profile()).await.unwrap();
    let changed = store
        .patch_profile(&user, patch(serde_json::json!({"displayName":"Renamed"})))
        .await
        .unwrap();
    assert_eq!(changed.display_name.as_deref(), Some("Renamed"));
    assert_eq!(changed.unit_system, "kg");
    assert_eq!(changed.calorie_target, Some(2100));
    assert_eq!(changed.protein_target_grams, Some(120));
    assert_eq!(changed.birth_date, Some("1990-01-02".parse().unwrap()));
    assert_eq!(changed.formula_sex.as_deref(), Some("female"));

    let (name, targets) = tokio::join!(
        store.patch_profile(
            &user,
            patch(serde_json::json!({"displayName":"Concurrent"}))
        ),
        store.patch_profile(&user, patch(serde_json::json!({"calorieTarget":2300})))
    );
    name.unwrap();
    targets.unwrap();
    let saved = store.profile(&user).await.unwrap();
    assert_eq!(saved.display_name.as_deref(), Some("Concurrent"));
    assert_eq!(saved.calorie_target, Some(2300));
    assert_eq!(saved.protein_target_grams, Some(120));

    let cleared = store
        .patch_profile(
            &user,
            patch(serde_json::json!({
                "displayName":null, "calorieTarget":null, "birthDate":null, "formulaSex":null
            })),
        )
        .await
        .unwrap();
    assert!(cleared.display_name.is_none());
    assert!(cleared.calorie_target.is_none());
    assert!(cleared.birth_date.is_none());
    assert!(cleared.formula_sex.is_none());
    assert_eq!(cleared.protein_target_grams, Some(120));
    assert_eq!(cleared.unit_system, "kg");
    let unchanged = store
        .patch_profile(&user, ProfilePatchRequest::default())
        .await
        .unwrap();
    assert_eq!(
        serde_json::to_value(unchanged).unwrap(),
        serde_json::to_value(cleared).unwrap()
    );
    assert_eq!(
        serde_json::to_value(store.profile(&other).await.unwrap()).unwrap(),
        serde_json::to_value(Profile::default()).unwrap()
    );
}

async fn fixture() -> (AppStore, PgPool, UserId, UserId) {
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
async fn memory_profile_patch_preserves_omissions_and_clears_explicit_nulls() {
    profile_contract(
        AppStore::new(),
        UserId(Uuid::new_v4()),
        UserId(Uuid::new_v4()),
    )
    .await;
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_profile_patch_preserves_omissions_and_clears_explicit_nulls() {
    let (store, pool, user, other) = fixture().await;
    profile_contract(store, user.clone(), other.clone()).await;
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_concurrent_profile_patches_preserve_both_writes() {
    let (store, pool, user, other) = fixture().await;
    store.upsert_profile(&user, profile()).await.unwrap();
    let mut blocker = pool.begin().await.unwrap();
    sqlx::query("select id from public.users where id = $1 for update")
        .bind(user.0)
        .fetch_one(&mut *blocker)
        .await
        .unwrap();
    let a_store = store.clone();
    let a_user = user.clone();
    let first = tokio::spawn(async move {
        a_store
            .patch_profile(
                &a_user,
                patch(serde_json::json!({"displayName":"Concurrent"})),
            )
            .await
    });
    let b_store = store.clone();
    let b_user = user.clone();
    let second = tokio::spawn(async move {
        b_store
            .patch_profile(&b_user, patch(serde_json::json!({"calorieTarget":2300})))
            .await
    });
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
    let both_waiting = loop {
        let waiting: i64 = sqlx::query_scalar("select count(*) from pg_stat_activity where pid <> pg_backend_pid() and state = 'active' and wait_event_type = 'Lock' and query like '%public.users%'").fetch_one(&pool).await.unwrap();
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
    assert!(both_waiting);
    let saved = store.profile(&user).await.unwrap();
    assert_eq!(saved.display_name.as_deref(), Some("Concurrent"));
    assert_eq!(saved.calorie_target, Some(2300));
    assert_eq!(saved.protein_target_grams, Some(120));
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_profile_patch_target_failure_rolls_back_user_fields() {
    let (store, pool, user, other) = fixture().await;
    store.upsert_profile(&user, profile()).await.unwrap();
    let result = store
        .patch_profile(
            &user,
            patch(serde_json::json!({"displayName":"Must roll back", "calorieTarget":-1})),
        )
        .await;
    assert!(result.is_err());
    let saved = store.profile(&user).await.unwrap();
    assert_eq!(
        serde_json::to_value(saved).unwrap(),
        serde_json::to_value(profile()).unwrap()
    );
    sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(user.0)
        .bind(other.0)
        .execute(&pool)
        .await
        .unwrap();
}
