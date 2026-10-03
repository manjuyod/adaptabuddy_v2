use api_server::{app, AppState};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
    Router,
};
use chrono::Utc;
use serde_json::{json, Value};
use tower::ServiceExt;

async fn request(
    app: &Router,
    method: Method,
    uri: &str,
    body: Value,
    expected: StatusCode,
) -> Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(uri)
                .header(header::AUTHORIZATION, "Bearer local-dev-token")
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
    assert_eq!(status, expected, "{uri}: {value}");
    value
}

#[tokio::test]
async fn repeated_goal_completion_records_one_completion_event() {
    let app = app(AppState::for_tests());
    let goal = request(
        &app,
        Method::POST,
        "/api/v0/goals",
        json!({"title":"Walk regularly", "target":"Ten walks"}),
        StatusCode::CREATED,
    )
    .await;
    let uri = format!("/api/v0/goals/{}", goal["id"].as_str().unwrap());
    let (first, repeated) = tokio::join!(
        request(
            &app,
            Method::PATCH,
            &uri,
            json!({"completed":true}),
            StatusCode::OK
        ),
        request(
            &app,
            Method::PATCH,
            &uri,
            json!({"completed":true}),
            StatusCode::OK
        ),
    );
    assert_eq!(first, repeated);
    let events = request(
        &app,
        Method::GET,
        "/api/v0/events/recent",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(
        events
            .as_array()
            .unwrap()
            .iter()
            .filter(|event| event["kind"] == "GoalCompleted")
            .count(),
        1
    );
    let progression = request(
        &app,
        Method::GET,
        "/api/v0/progression/state",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(progression["xp"], 55);
}

#[tokio::test]
async fn health_writes_record_each_activity_once() {
    let app = app(AppState::for_tests());
    let now = Utc::now();
    request(
        &app,
        Method::POST,
        "/api/v0/me/food/entries",
        json!({"foodName":"Meal", "calories":100}),
        StatusCode::CREATED,
    )
    .await;
    request(
        &app,
        Method::POST,
        "/api/v0/nutrition/food-logs",
        json!({"foodName":"Snack", "calories":50}),
        StatusCode::CREATED,
    )
    .await;
    request(
        &app,
        Method::POST,
        "/api/v0/workouts/sessions",
        json!({"name":"Walk", "durationMinutes":30, "completedAt":now}),
        StatusCode::CREATED,
    )
    .await;
    let habit = request(
        &app,
        Method::POST,
        "/api/v0/habits",
        json!({"name":"Walk", "cadence":"daily"}),
        StatusCode::CREATED,
    )
    .await;
    request(
        &app,
        Method::POST,
        "/api/v0/habits/check-ins",
        json!({"habitId":habit["id"], "completedAt":now}),
        StatusCode::OK,
    )
    .await;
    request(
        &app,
        Method::POST,
        "/api/v0/me/stats/body",
        json!({"metric":"weight", "value":80, "unit":"kg", "measuredAt":now}),
        StatusCode::CREATED,
    )
    .await;
    let goal = request(
        &app,
        Method::POST,
        "/api/v0/goals",
        json!({"title":"Walk regularly", "target":"Ten walks"}),
        StatusCode::CREATED,
    )
    .await;
    request(
        &app,
        Method::PATCH,
        &format!("/api/v0/goals/{}", goal["id"].as_str().unwrap()),
        json!({"completed":true}),
        StatusCode::OK,
    )
    .await;
    let events = request(
        &app,
        Method::GET,
        "/api/v0/events/recent",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    let events = events.as_array().unwrap();
    assert_eq!(events.len(), 7);
    for (kind, count) in [
        ("FoodLogged", 2),
        ("WorkoutCompleted", 1),
        ("HabitCompleted", 1),
        ("BodyMetricUpdated", 1),
        ("GoalCreated", 1),
        ("GoalCompleted", 1),
    ] {
        assert_eq!(
            events.iter().filter(|event| event["kind"] == kind).count(),
            count,
            "{kind}"
        );
    }
    let food = request(
        &app,
        Method::GET,
        "/api/v0/me/food/entries",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(food.as_array().unwrap().len(), 2);
    let workouts = request(
        &app,
        Method::GET,
        "/api/v0/workouts/history",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(workouts.as_array().unwrap().len(), 1);
}
#[tokio::test]
async fn profile_patch_preserves_omitted_fields_and_clears_explicit_nulls() {
    let app = app(AppState::for_tests());
    let original = request(
        &app,
        Method::PATCH,
        "/api/v0/me/profile",
        json!({
            "displayName":"Original", "unitSystem":"kg", "calorieTarget":2200,
            "proteinTargetGrams":160, "birthDate":"1990-01-01", "formulaSex":"female"
        }),
        StatusCode::OK,
    )
    .await;
    let renamed = request(
        &app,
        Method::PATCH,
        "/api/v0/me/profile",
        json!({"displayName":"Renamed"}),
        StatusCode::OK,
    )
    .await;
    assert_eq!(renamed["displayName"], "Renamed");
    for field in [
        "unitSystem",
        "calorieTarget",
        "proteinTargetGrams",
        "birthDate",
        "formulaSex",
    ] {
        assert_eq!(
            renamed[field], original[field],
            "omitted {field} must be preserved"
        );
    }
    let unchanged = request(
        &app,
        Method::PATCH,
        "/api/v0/me/profile",
        json!({}),
        StatusCode::OK,
    )
    .await;
    assert_eq!(unchanged, renamed);
    let cleared = request(
        &app,
        Method::PATCH,
        "/api/v0/me/profile",
        json!({
            "displayName":null, "calorieTarget":null, "birthDate":null, "formulaSex":null
        }),
        StatusCode::OK,
    )
    .await;
    for field in ["displayName", "calorieTarget", "birthDate", "formulaSex"] {
        assert!(cleared[field].is_null(), "explicit null must clear {field}");
    }
    assert_eq!(cleared["unitSystem"], "kg");
    assert_eq!(cleared["proteinTargetGrams"], 160);
}
#[tokio::test]
async fn replacing_nutrition_targets_preserves_profile_details() {
    let app = app(AppState::for_tests());
    let original = request(
        &app,
        Method::PATCH,
        "/api/v0/me/profile",
        json!({
            "displayName":"Original", "unitSystem":"kg", "calorieTarget":2200,
            "proteinTargetGrams":160, "birthDate":"1990-01-01", "formulaSex":"female"
        }),
        StatusCode::OK,
    )
    .await;
    request(
        &app,
        Method::PUT,
        "/api/v0/nutrition/targets",
        json!({
            "calorieTarget":2500, "proteinTargetGrams":null
        }),
        StatusCode::OK,
    )
    .await;
    let updated = request(
        &app,
        Method::GET,
        "/api/v0/profile",
        Value::Null,
        StatusCode::OK,
    )
    .await;
    assert_eq!(updated["calorieTarget"], 2500);
    assert!(updated["proteinTargetGrams"].is_null());
    for field in ["displayName", "unitSystem", "birthDate", "formulaSex"] {
        assert_eq!(
            updated[field], original[field],
            "unrelated {field} must be preserved"
        );
    }
}
