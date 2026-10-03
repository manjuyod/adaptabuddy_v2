use api_server::{app, AppState};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
    Router,
};
use chrono::{DateTime, Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::{json, Value};
use storage::AppStore;
use tower::ServiceExt;
use uuid::Uuid;

fn user_token(secret: &str, user_id: Uuid) -> String {
    encode(
        &Header::new(Algorithm::HS256),
        &json!({
            "sub": user_id,
            "exp": Utc::now().timestamp() + 300,
            "aud": "authenticated",
            "role": "authenticated",
            "session_id": Uuid::new_v4(),
        }),
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("test user token should sign")
}

async fn request(
    app: &Router,
    token: &str,
    method: Method,
    uri: &str,
    body: Value,
    expected_status: StatusCode,
) -> Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let value = serde_json::from_slice::<Value>(&bytes).unwrap_or(Value::Null);
    assert_eq!(status, expected_status, "{uri}: {value}");
    value
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_authenticated_food_and_workout_api_preserve_ownership_and_retry_safety() {
    let database_url = std::env::var("STORAGE_TEST_DATABASE_URL")
        .expect("set STORAGE_TEST_DATABASE_URL to a disposable migrated database");
    let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
    let owner = Uuid::new_v4();
    let other = Uuid::new_v4();
    sqlx::query("insert into auth.users (id) values ($1), ($2)")
        .bind(owner)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();

    let secret = "postgres-api-integration-test-secret";
    let owner_token = user_token(secret, owner);
    let other_token = user_token(secret, other);
    let app = app(AppState::new(
        AppStore::postgres(pool.clone()),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));
    let now = DateTime::<Utc>::from_timestamp(Utc::now().timestamp(), 0).unwrap();

    let food = request(
        &app,
        &owner_token,
        Method::POST,
        "/api/v0/me/food/entries",
        json!({"foodName":"Integration meal", "calories":200, "loggedAt":now}),
        StatusCode::CREATED,
    )
    .await;
    for field in ["proteinGrams", "carbsGrams", "fatGrams"] {
        assert!(food[field].is_null(), "omitted {field} should stay unknown");
    }
    let food_uri = format!("/api/v0/me/food/entries/{}", food["id"].as_str().unwrap());
    let patched = request(
        &app,
        &owner_token,
        Method::PATCH,
        &food_uri,
        json!({"calories":250, "proteinGrams":15, "carbsGrams":20, "fatGrams":7}),
        StatusCode::OK,
    )
    .await;
    assert_eq!(patched["foodName"], "Integration meal");
    assert_eq!(patched["proteinGrams"], 15);
    request(
        &app,
        &other_token,
        Method::PATCH,
        &food_uri,
        json!({"calories":999}),
        StatusCode::NOT_FOUND,
    )
    .await;
    request(
        &app,
        &other_token,
        Method::DELETE,
        &food_uri,
        Value::Null,
        StatusCode::NOT_FOUND,
    )
    .await;
    assert_eq!(
        request(
            &app,
            &other_token,
            Method::GET,
            "/api/v0/me/food/entries",
            Value::Null,
            StatusCode::OK,
        )
        .await,
        json!([])
    );

    let dashboard = request(
        &app,
        &owner_token,
        Method::GET,
        "/api/v0/me/dashboard",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(dashboard["user"]["id"], owner.to_string());
    assert_eq!(
        dashboard["today"],
        json!({"calories_consumed":250, "protein_g":15, "carbs_g":20, "fat_g":7})
    );
    assert_eq!(dashboard["habits"]["food_logged_today"], true);
    assert_eq!(dashboard["habits"]["workout_completed_today"], false);

    let plan = request(
        &app,
        &owner_token,
        Method::POST,
        "/api/v0/me/workouts/plan/generate",
        json!({
            "startDate":now.date_naive(),
            "endDate":(now + Duration::days(6)).date_naive(),
            "availableDaysPerWeek":3,
        }),
        StatusCode::CREATED,
    )
    .await;
    assert_eq!(plan["days"].as_array().unwrap().len(), 3);
    let day = &plan["days"][0];
    request(
        &app,
        &other_token,
        Method::POST,
        "/api/v0/me/workouts/sessions",
        json!({"workoutDayId":day["id"]}),
        StatusCode::NOT_FOUND,
    )
    .await;
    let session = request(
        &app,
        &owner_token,
        Method::POST,
        "/api/v0/me/workouts/sessions",
        json!({"workoutDayId":day["id"], "startedAt":now - Duration::minutes(30)}),
        StatusCode::CREATED,
    )
    .await;
    assert_eq!(session["status"], "started");
    let session_uri = format!(
        "/api/v0/me/workouts/sessions/{}",
        session["id"].as_str().unwrap()
    );
    let finish_uri = format!("{session_uri}/finish");
    let exercises: Vec<_> = day["exercises"]
        .as_array()
        .unwrap()
        .iter()
        .map(|exercise| {
            json!({
                "workoutExerciseId":exercise["id"],
                "exerciseSlug":exercise["exerciseSlug"],
                "status":"completed",
                "setsCompleted":3,
            })
        })
        .collect();
    let completion = json!({"finishedAt":now, "exercises":exercises});
    request(
        &app,
        &other_token,
        Method::GET,
        &session_uri,
        Value::Null,
        StatusCode::NOT_FOUND,
    )
    .await;
    request(
        &app,
        &other_token,
        Method::POST,
        &finish_uri,
        completion.clone(),
        StatusCode::NOT_FOUND,
    )
    .await;
    let finished = request(
        &app,
        &owner_token,
        Method::POST,
        &finish_uri,
        completion.clone(),
        StatusCode::OK,
    )
    .await;
    assert_eq!(finished["status"], "completed");
    assert_eq!(finished["xpAwarded"], 35);
    assert_eq!(finished["exercises"].as_array().unwrap().len(), 3);
    let retry = request(
        &app,
        &owner_token,
        Method::POST,
        &finish_uri,
        completion,
        StatusCode::OK,
    )
    .await;
    assert_eq!(retry, finished, "retries must return the saved completion");
    let awards: (i64, i64) = sqlx::query_as(
        "select count(*), coalesce(sum(amount), 0) from public.xp_events where user_id = $1 and reason = 'workout_session_finished'",
    )
    .bind(owner)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(awards, (1, 35));
    let completion_events: i64 = sqlx::query_scalar(
        "select count(*) from public.health_events where user_id = $1 and event_name = 'WorkoutCompleted'",
    )
    .bind(owner)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(completion_events, 1);
    let progression = request(
        &app,
        &owner_token,
        Method::GET,
        "/api/v0/progression/state",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(
        progression["xp"], 40,
        "one food award plus one workout award"
    );
    let dashboard = request(
        &app,
        &owner_token,
        Method::GET,
        "/api/v0/me/dashboard",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(dashboard["habits"]["workout_completed_today"], true);
    assert_eq!(
        dashboard["workout"]["next_workout_date"],
        plan["days"][1]["scheduledDate"]
    );
    let foreign_dashboard = request(
        &app,
        &other_token,
        Method::GET,
        &format!("/api/v0/me/dashboard?user_id={owner}"),
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(foreign_dashboard["user"]["id"], other.to_string());
    assert_eq!(foreign_dashboard["today"]["calories_consumed"], 0);
    assert_eq!(
        foreign_dashboard["habits"]["workout_completed_today"],
        false
    );

    let deleted = sqlx::query("delete from auth.users where id = $1 or id = $2")
        .bind(owner)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(deleted.rows_affected(), 2);
    pool.close().await;
}
#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable migrated PostgreSQL database"]
async fn postgres_food_api_rolls_back_when_activity_event_cannot_be_saved() {
    let database_url = std::env::var("STORAGE_TEST_DATABASE_URL")
        .expect("set STORAGE_TEST_DATABASE_URL to a disposable migrated database");
    let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
    let user_id = Uuid::new_v4();
    sqlx::query("insert into auth.users (id) values ($1)")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();
    let constraint = format!("reject_test_event_{}", user_id.simple());
    sqlx::query(&format!(
        "alter table public.health_events add constraint {constraint} check (user_id <> '{user_id}'::uuid) not valid"
    )).execute(&pool).await.unwrap();
    let secret = "postgres-api-failed-activity-secret";
    let app = app(AppState::new(
        AppStore::postgres(pool.clone()),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));
    let error = request(
        &app,
        &user_token(secret, user_id),
        Method::POST,
        "/api/v0/me/food/entries",
        json!({"foodName":"Must roll back", "calories":100}),
        StatusCode::INTERNAL_SERVER_ERROR,
    )
    .await;
    let saved: (i64, i64, i64) = sqlx::query_as(
        "select (select count(*) from public.nutrition_food_logs where user_id = $1), (select count(*) from public.health_events where user_id = $1), (select count(*) from public.xp_events where user_id = $1)"
    ).bind(user_id).fetch_one(&pool).await.unwrap();
    sqlx::query(&format!(
        "alter table public.health_events drop constraint {constraint}"
    ))
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("delete from auth.users where id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
    assert_eq!(error["error"]["code"], "internal_error");
    assert_eq!(
        saved,
        (0, 0, 0),
        "a rejected activity event must roll back the food row and XP"
    );
}
