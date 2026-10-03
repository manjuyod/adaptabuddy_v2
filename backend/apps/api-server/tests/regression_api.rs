use api_server::{app, AppState};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
    Router,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::{json, Value};
use storage::AppStore;
use tower::ServiceExt;
use uuid::Uuid;

async fn request(app: &Router, method: Method, uri: &str, body: Value) -> (StatusCode, Value) {
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
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn protected_routes_reject_non_user_jwt_claims() {
    let secret = "regression-secret";
    for role in [Value::Null, json!("anon"), json!("service_role")] {
        let token = encode(
            &Header::new(Algorithm::HS256),
            &json!({
                "sub": Uuid::new_v4(), "exp": Utc::now().timestamp() + 300,
                "aud": "authenticated", "role": role, "session_id": Uuid::new_v4()
            }),
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap();
        let response = app(AppState::new(
            AppStore::new(),
            auth::AuthConfig::with_local_jwt_secret(secret),
        ))
        .oneshot(
            Request::builder()
                .uri("/api/v0/me/dashboard")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "role {role}");
    }
}

#[tokio::test]
async fn protected_routes_reject_not_yet_valid_jwt() {
    let secret = "regression-secret";
    let token = encode(
        &Header::new(Algorithm::HS256),
        &json!({
            "sub": Uuid::new_v4(), "exp": Utc::now().timestamp() + 7200,
            "nbf": Utc::now().timestamp() + 3600, "aud": "authenticated",
            "role": "authenticated", "session_id": Uuid::new_v4()
        }),
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .unwrap();
    let response = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ))
    .oneshot(
        Request::builder()
            .uri("/api/v0/me/dashboard")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn mobile_dashboard_excludes_historical_activity_and_reports_all_macros() {
    let app = app(AppState::for_tests());
    let now = Utc::now();
    for (date, calories, protein, carbs, fat) in [
        (now - Duration::days(2), 900, 60, 100, 30),
        (now, 200, 15, 20, 7),
    ] {
        assert_eq!(
            request(
                &app,
                Method::POST,
                "/api/v0/me/food/entries",
                json!({
                    "foodName": "Meal", "calories": calories, "proteinGrams": protein,
                    "carbsGrams": carbs, "fatGrams": fat, "loggedAt": date,
                })
            )
            .await
            .0,
            StatusCode::CREATED
        );
    }
    assert_eq!(
        request(
            &app,
            Method::POST,
            "/workouts/sessions",
            json!({
                "name": "Old workout", "durationMinutes": 30, "completedAt": now - Duration::days(2)
            })
        )
        .await
        .0,
        StatusCode::CREATED
    );
    let (status, dashboard) = request(&app, Method::GET, "/api/v0/me/dashboard", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        dashboard["today"],
        json!({"calories_consumed":200,"protein_g":15,"carbs_g":20,"fat_g":7})
    );
    assert_eq!(dashboard["habits"]["food_logged_today"], true);
    assert_eq!(dashboard["habits"]["workout_completed_today"], false);
}

#[tokio::test]
async fn mobile_dashboard_reflects_zero_calorie_food_weight_and_generated_plan() {
    let app = app(AppState::for_tests());
    let now = Utc::now();
    assert_eq!(
        request(
            &app,
            Method::POST,
            "/api/v0/me/food/entries",
            json!({
                "foodName": "Water", "calories": 0, "loggedAt": now
            })
        )
        .await
        .0,
        StatusCode::CREATED
    );
    assert_eq!(
        request(
            &app,
            Method::POST,
            "/api/v0/me/stats/body",
            json!({
                "metric": "weight", "value": 80.0, "unit": "kg", "measuredAt": now
            })
        )
        .await
        .0,
        StatusCode::CREATED
    );
    let (status, plan) = request(
        &app,
        Method::POST,
        "/api/v0/me/workouts/plan/generate",
        json!({
            "startDate": now.date_naive(), "endDate": (now + Duration::days(6)).date_naive(),
            "availableDaysPerWeek": 3
        }),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    let (_, dashboard) = request(&app, Method::GET, "/api/v0/me/dashboard", Value::Null).await;
    assert_eq!(dashboard["habits"]["food_logged_today"], true);
    assert_eq!(dashboard["habits"]["stats_stale"], false);
    assert_eq!(
        dashboard["workout"]["next_workout_date"],
        plan["days"][0]["scheduledDate"]
    );
    assert_eq!(
        dashboard["workout"]["next_workout_name"],
        plan["days"][0]["name"]
    );
}

#[tokio::test]
async fn canonical_writes_reject_invalid_values_without_mutating_data() {
    let app = app(AppState::for_tests());
    for (method, uri, body) in [
        (
            Method::POST,
            "/api/v0/me/food/entries",
            json!({"foodName":"Meal","calories":-1}),
        ),
        (
            Method::POST,
            "/api/v0/me/food/entries",
            json!({"foodName":"  ","calories":100}),
        ),
        (
            Method::POST,
            "/api/v0/me/food/entries",
            json!({"foodName":"Meal","calories":100,"mealType":"invalid"}),
        ),
        (
            Method::POST,
            "/api/v0/me/food/entries",
            json!({"foodName":"Meal","calories":100,"proteinGrams":-1}),
        ),
        (
            Method::POST,
            "/api/v0/me/stats/body",
            json!({"metric":"weight","value":-80,"unit":"kg","measuredAt":Utc::now()}),
        ),
        (
            Method::POST,
            "/api/v0/me/stats/exercise",
            json!({"exerciseSlug":"squat","weight":80,"reps":-1}),
        ),
        (
            Method::POST,
            "/api/v0/me/workouts/plan/generate",
            json!({"startDate":"2026-10-10","endDate":"2026-10-01","availableDaysPerWeek":3}),
        ),
        (
            Method::POST,
            "/api/v0/me/workouts/plan/generate",
            json!({"startDate":"2026-10-01","endDate":"2026-10-10","availableDaysPerWeek":0}),
        ),
        (
            Method::PATCH,
            "/api/v0/me/profile",
            json!({"unitSystem":"kg","calorieTarget":-100}),
        ),
    ] {
        let (status, response) = request(&app, method, uri, body.clone()).await;
        assert_eq!(
            status,
            StatusCode::BAD_REQUEST,
            "{uri}: {body} => {response}"
        );
        assert_eq!(response["error"]["code"], "invalid_request");
    }
    assert_eq!(
        request(&app, Method::GET, "/api/v0/me/food/entries", Value::Null)
            .await
            .1,
        json!([])
    );
}

#[tokio::test]
async fn generated_workouts_stay_inside_window_and_repeat_weekly() {
    let app = app(AppState::for_tests());
    for (end_date, available, count) in [("2026-10-01", 7, 1), ("2026-10-14", 3, 6)] {
        let (status, plan) = request(
            &app,
            Method::POST,
            "/api/v0/me/workouts/plan/generate",
            json!({
                "startDate":"2026-10-01", "endDate":end_date, "availableDaysPerWeek":available
            }),
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
        let days = plan["days"].as_array().unwrap();
        assert_eq!(days.len(), count);
        assert!(days
            .iter()
            .all(|day| day["scheduledDate"].as_str().unwrap() <= end_date));
    }
}
#[tokio::test]
async fn protected_routes_reject_wrong_or_missing_jwt_audience() {
    let secret = "regression-secret";
    for audience in [Value::Null, json!("anon"), json!(["unrelated"])] {
        let token = encode(
            &Header::new(Algorithm::HS256),
            &json!({
                "sub": Uuid::new_v4(), "exp": Utc::now().timestamp() + 300,
                "aud": audience, "role": "authenticated", "session_id": Uuid::new_v4()
            }),
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap();
        let response = app(AppState::new(
            AppStore::new(),
            auth::AuthConfig::with_local_jwt_secret(secret),
        ))
        .oneshot(
            Request::builder()
                .uri("/api/v0/me/dashboard")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "audience {audience}"
        );
    }
}

#[tokio::test]
async fn empty_configured_signing_secret_cannot_authenticate() {
    let token = encode(
        &Header::new(Algorithm::HS256),
        &json!({
            "sub": Uuid::new_v4(), "exp": Utc::now().timestamp() + 300,
            "aud": "authenticated", "role": "authenticated", "session_id": Uuid::new_v4()
        }),
        &EncodingKey::from_secret(b""),
    )
    .unwrap();
    let response = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret(""),
    ))
    .oneshot(
        Request::builder()
            .uri("/api/v0/me/dashboard")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await
    .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn empty_session_patch_preserves_cancelled_state() {
    let app = app(AppState::for_tests());
    let (_, session) = request(
        &app,
        Method::POST,
        "/api/v0/me/workouts/sessions",
        json!({}),
    )
    .await;
    let uri = format!(
        "/api/v0/me/workouts/sessions/{}",
        session["id"].as_str().unwrap()
    );
    assert_eq!(
        request(&app, Method::PATCH, &uri, json!({"status":"cancelled"}))
            .await
            .0,
        StatusCode::OK
    );
    let (status, unchanged) = request(&app, Method::PATCH, &uri, json!({})).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(unchanged["status"], "cancelled");
}

#[tokio::test]
async fn skipped_exercises_do_not_award_completion_xp() {
    let app = app(AppState::for_tests());
    let (_, session) = request(
        &app,
        Method::POST,
        "/api/v0/me/workouts/sessions",
        json!({}),
    )
    .await;
    let uri = format!(
        "/api/v0/me/workouts/sessions/{}/finish",
        session["id"].as_str().unwrap()
    );
    let (status, finished) = request(
        &app,
        Method::POST,
        &uri,
        json!({
            "exercises":[{"exerciseSlug":"squat","status":"skipped"}]
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(finished["xpAwarded"], 0);
    let (_, state) = request(&app, Method::GET, "/progression/state", Value::Null).await;
    assert_eq!(state["xp"], 0);
}

#[tokio::test]
async fn workout_completion_is_idempotent_and_cannot_be_reopened() {
    let app = app(AppState::for_tests());
    let (_, session) = request(
        &app,
        Method::POST,
        "/api/v0/me/workouts/sessions",
        json!({}),
    )
    .await;
    let uri = format!(
        "/api/v0/me/workouts/sessions/{}",
        session["id"].as_str().unwrap()
    );
    let payload =
        json!({"exercises":[{"exerciseSlug":"squat","status":"completed","setsCompleted":3}]});
    let (status, finished) = request(
        &app,
        Method::POST,
        &format!("{uri}/finish"),
        payload.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, retried) = request(&app, Method::POST, &format!("{uri}/finish"), payload).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(retried, finished);
    let (_, state) = request(&app, Method::GET, "/progression/state", Value::Null).await;
    assert_eq!(state["xp"], 25);
    assert_eq!(
        request(&app, Method::PATCH, &uri, json!({"status":"started"}))
            .await
            .0,
        StatusCode::CONFLICT
    );
}

#[tokio::test]
async fn invalid_workout_exercises_and_direct_completion_status_are_rejected() {
    let app = app(AppState::for_tests());
    let (_, session) = request(
        &app,
        Method::POST,
        "/api/v0/me/workouts/sessions",
        json!({}),
    )
    .await;
    let uri = format!(
        "/api/v0/me/workouts/sessions/{}",
        session["id"].as_str().unwrap()
    );
    assert_eq!(
        request(&app, Method::PATCH, &uri, json!({"status":"completed"}))
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    for exercise in [
        json!({"exerciseSlug":"squat","status":"invalid"}),
        json!({"exerciseSlug":"squat","status":"completed","setsCompleted":-1}),
    ] {
        assert_eq!(
            request(
                &app,
                Method::POST,
                &format!("{uri}/finish"),
                json!({"exercises":[exercise]})
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(
        request(&app, Method::GET, &uri, Value::Null).await.1["status"],
        "started"
    );
}
#[tokio::test]
async fn unreachable_jwks_does_not_hang_protected_requests() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/jwks", listener.local_addr().unwrap());
    let pending_server = tokio::spawn(async move {
        let (_stream, _) = listener.accept().await.unwrap();
        std::future::pending::<()>().await;
    });
    let mut jwt_header = Header::new(Algorithm::HS256);
    jwt_header.kid = Some("missing-key".to_string());
    let token = encode(
        &jwt_header,
        &json!({
            "sub": Uuid::new_v4(), "exp": Utc::now().timestamp() + 300,
            "aud": "authenticated", "role": "authenticated"
        }),
        &EncodingKey::from_secret(b"secret"),
    )
    .unwrap();
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(8),
        app(AppState::new(
            AppStore::new(),
            auth::AuthConfig::new(Some(url), None, false),
        ))
        .oneshot(
            Request::builder()
                .uri("/api/v0/me/dashboard")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        ),
    )
    .await;
    pending_server.abort();
    assert_eq!(
        response
            .expect("JWT key fetch must have a bounded timeout")
            .unwrap()
            .status(),
        StatusCode::UNAUTHORIZED
    );
}

#[tokio::test]
async fn jwt_user_cannot_read_or_mutate_another_users_resources() {
    let secret = "ownership-regression-secret";
    let app = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));
    let tokens: Vec<_> =
        (0..2)
            .map(|_| {
                encode(&Header::new(Algorithm::HS256), &json!({
        "sub": Uuid::new_v4(), "exp": Utc::now().timestamp() + 300,
        "aud": "authenticated", "role": "authenticated", "session_id": Uuid::new_v4()
    }), &EncodingKey::from_secret(secret.as_bytes())).unwrap()
            })
            .collect();
    let send = |token: String, method: Method, uri: String, body: Value| {
        let app = app.clone();
        async move {
            let response = app
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
            (
                status,
                serde_json::from_slice::<Value>(&bytes).unwrap_or(Value::Null),
            )
        }
    };
    let (_, food) = send(
        tokens[0].clone(),
        Method::POST,
        "/api/v0/me/food/entries".into(),
        json!({"foodName":"Private meal","calories":100}),
    )
    .await;
    let food_uri = format!("/api/v0/me/food/entries/{}", food["id"].as_str().unwrap());
    assert_eq!(
        send(
            tokens[1].clone(),
            Method::PATCH,
            food_uri.clone(),
            json!({"calories":999})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(tokens[1].clone(), Method::DELETE, food_uri, Value::Null)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(
            tokens[1].clone(),
            Method::GET,
            "/api/v0/me/food/entries".into(),
            Value::Null
        )
        .await
        .1,
        json!([])
    );
    let (_, session) = send(
        tokens[0].clone(),
        Method::POST,
        "/api/v0/me/workouts/sessions".into(),
        json!({}),
    )
    .await;
    let uri = format!(
        "/api/v0/me/workouts/sessions/{}",
        session["id"].as_str().unwrap()
    );
    assert_eq!(
        send(tokens[1].clone(), Method::GET, uri.clone(), Value::Null)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(
            tokens[1].clone(),
            Method::PATCH,
            uri.clone(),
            json!({"status":"cancelled"})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(
            tokens[1].clone(),
            Method::POST,
            format!("{uri}/finish"),
            json!({"exercises":[{"exerciseSlug":"squat","status":"completed"}]})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        send(tokens[0].clone(), Method::GET, uri, Value::Null)
            .await
            .1["status"],
        "started"
    );
}
#[tokio::test]
async fn legacy_dashboard_aggregates_large_values_without_overflow() {
    let app = app(AppState::for_tests());
    for _ in 0..2 {
        assert_eq!(
            request(
                &app,
                Method::POST,
                "/api/v0/me/food/entries",
                json!({
                    "foodName":"Large meal", "calories":i32::MAX, "proteinGrams":i32::MAX
                })
            )
            .await
            .0,
            StatusCode::CREATED
        );
        assert_eq!(
            request(
                &app,
                Method::POST,
                "/workouts/sessions",
                json!({
                    "name":"Long workout", "durationMinutes":i32::MAX, "completedAt":Utc::now()
                })
            )
            .await
            .0,
            StatusCode::CREATED
        );
    }
    let (status, dashboard) =
        request(&app, Method::GET, "/api/v0/health/dashboard", Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(dashboard["nutrition"]["caloriesLogged"], i32::MAX);
    assert_eq!(dashboard["nutrition"]["proteinGrams"], i32::MAX);
    assert_eq!(dashboard["workouts"]["totalMinutes"], i32::MAX);
}
