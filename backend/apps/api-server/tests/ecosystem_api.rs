use api_server::{app, AppState};
use axum::body::Body;
use axum::http::{header, Method, Request, StatusCode};
use chrono::Utc;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::Serialize;
use storage::AppStore;
use tower::ServiceExt;
use uuid::Uuid;

fn authed_request(method: Method, uri: &str, body: &'static str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, "Bearer local-dev-token")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .expect("request should build")
}

fn unauthenticated_request(method: Method, uri: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .body(Body::empty())
        .expect("request should build")
}

fn bearer_request(method: Method, uri: &str, bearer: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {bearer}"))
        .body(Body::empty())
        .expect("request should build")
}

async fn read_json(response: axum::response::Response) -> serde_json::Value {
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should read");
    serde_json::from_slice(&body).expect("response should return json")
}

#[derive(Serialize)]
struct TestClaims {
    sub: String,
    exp: usize,
    aud: String,
    role: String,
    session_id: String,
}

fn signed_token(secret: &str, user_id: Uuid, expires_in_seconds: i64) -> String {
    let exp = (Utc::now().timestamp() + expires_in_seconds) as usize;
    encode(
        &Header::new(Algorithm::HS256),
        &TestClaims {
            sub: user_id.to_string(),
            exp,
            aud: "authenticated".to_string(),
            role: "authenticated".to_string(),
            session_id: Uuid::new_v4().to_string(),
        },
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("test token should sign")
}

#[tokio::test]
async fn health_dashboard_derives_progress_from_health_events() {
    let app = app(AppState::for_tests());

    let food_response = app
        .clone()
        .oneshot(authed_request(
            Method::POST,
            "/nutrition/food-logs",
            r#"{"foodName":"Greek yogurt","calories":220,"proteinGrams":28}"#,
        ))
        .await
        .expect("food log request should complete");
    assert_eq!(food_response.status(), StatusCode::CREATED);

    let workout_response = app
        .clone()
        .oneshot(authed_request(
            Method::POST,
            "/workouts/sessions",
            r#"{"name":"Strength A","durationMinutes":45,"completedAt":"2026-06-12T12:00:00Z"}"#,
        ))
        .await
        .expect("workout request should complete");
    assert_eq!(workout_response.status(), StatusCode::CREATED);

    let dashboard_response = app
        .clone()
        .oneshot(authed_request(Method::GET, "/health/dashboard", ""))
        .await
        .expect("dashboard request should complete");
    assert_eq!(dashboard_response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(dashboard_response.into_body(), usize::MAX)
        .await
        .expect("body should read");
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("dashboard should return json");

    assert_eq!(json["nutrition"]["caloriesLogged"], 220);
    assert_eq!(json["nutrition"]["proteinGrams"], 28);
    assert_eq!(json["workouts"]["completedSessions"], 1);
    assert_eq!(json["progression"]["xp"], 35);
    assert_eq!(json["progression"]["level"], 1);
}

#[tokio::test]
async fn unity_projection_is_derived_from_backend_progression_state() {
    let app = app(AppState::for_tests());

    let response = app
        .clone()
        .oneshot(authed_request(
            Method::GET,
            "/clients/unity/player-state",
            "",
        ))
        .await
        .expect("unity projection request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should read");
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("unity projection should return json");

    assert_eq!(json["source"], "backend");
    assert_eq!(json["progression"]["xp"], 0);
    assert!(json["presentationHints"].is_array());
}

#[tokio::test]
async fn protected_routes_reject_missing_auth() {
    let app = app(AppState::for_tests());
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/health/dashboard")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("dashboard request should complete");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn health_routes_return_ok_without_auth() {
    let app = app(AppState::for_tests());

    for uri in ["/health", "/api/v0/health"] {
        let response = app
            .clone()
            .oneshot(unauthenticated_request(Method::GET, uri))
            .await
            .expect("health request should complete");

        assert_eq!(response.status(), StatusCode::OK);
        let json = read_json(response).await;
        assert_eq!(json["status"], "ok");
    }
}

#[tokio::test]
async fn mobile_dashboard_rejects_missing_token_with_error_object() {
    let app = app(AppState::for_tests());

    let response = app
        .oneshot(unauthenticated_request(Method::GET, "/api/v0/me/dashboard"))
        .await
        .expect("dashboard request should complete");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let json = read_json(response).await;
    assert_eq!(json["error"]["code"], "unauthorized");
    assert_eq!(json["error"]["message"], "Missing or invalid access token");
}

#[tokio::test]
async fn mobile_dashboard_rejects_malformed_bearer_header() {
    let app = app(AppState::for_tests());

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v0/me/dashboard")
                .header(header::AUTHORIZATION, "Token not-a-bearer-token")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("dashboard request should complete");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let json = read_json(response).await;
    assert_eq!(json["error"]["code"], "unauthorized");
    assert_eq!(json["error"]["message"], "Missing or invalid access token");
}

#[tokio::test]
async fn mobile_dashboard_uses_verified_user_and_mobile_shell_shape() {
    let secret = "local-test-secret";
    let user_id = Uuid::new_v4();
    let token = signed_token(secret, user_id, 300);
    let app = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));

    let response = app
        .oneshot(bearer_request(
            Method::GET,
            "/api/v0/me/dashboard?user_id=00000000-0000-0000-0000-000000000999",
            &token,
        ))
        .await
        .expect("dashboard request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    let json = read_json(response).await;
    assert_eq!(json["user"]["id"], user_id.to_string());
    assert!(json["user"]["display_name"].is_null());
    assert_eq!(json["today"]["calories_consumed"], 0);
    assert_eq!(json["today"]["protein_g"], 0);
    assert_eq!(json["today"]["carbs_g"], 0);
    assert_eq!(json["today"]["fat_g"], 0);
    assert!(json["body"]["latest_weight"].is_null());
    assert_eq!(json["body"]["weight_unit"], "lb");
    assert!(json["body"]["last_updated"].is_null());
    assert!(json["workout"]["next_workout_date"].is_null());
    assert!(json["workout"]["next_workout_name"].is_null());
    assert_eq!(
        json["workout"]["recommendation"],
        "No workout generated yet"
    );
    assert_eq!(json["habits"]["food_logged_today"], false);
    assert_eq!(json["habits"]["workout_completed_today"], false);
    assert_eq!(json["habits"]["stats_stale"], true);
}

#[tokio::test]
async fn auth_session_accepts_valid_supabase_jwt_secret_token() {
    let secret = "local-test-secret";
    let user_id = Uuid::new_v4();
    let token = signed_token(secret, user_id, 300);
    let app = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));

    let response = app
        .oneshot(bearer_request(Method::GET, "/auth/session", &token))
        .await
        .expect("auth request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("body should read");
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("session should return json");
    assert_eq!(json["userId"], user_id.to_string());
    assert_eq!(json["authProvider"], "supabase");
}

#[tokio::test]
async fn auth_session_rejects_invalid_supabase_jwt_secret_token() {
    let app = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret("expected-secret"),
    ));

    let response = app
        .oneshot(bearer_request(Method::GET, "/auth/session", "not-a-jwt"))
        .await
        .expect("auth request should complete");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn auth_session_rejects_expired_supabase_jwt_secret_token() {
    let secret = "local-test-secret";
    let token = signed_token(secret, Uuid::new_v4(), -300);
    let app = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));

    let response = app
        .oneshot(bearer_request(Method::GET, "/auth/session", &token))
        .await
        .expect("auth request should complete");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn mobile_health_route_is_public_but_me_routes_require_auth() {
    let app = app(AppState::for_tests());

    let health_response = app
        .clone()
        .oneshot(unauthenticated_request(Method::GET, "/api/v0/health"))
        .await
        .expect("health request should complete");
    assert_eq!(health_response.status(), StatusCode::OK);

    let me_response = app
        .oneshot(unauthenticated_request(Method::GET, "/api/v0/me"))
        .await
        .expect("me request should complete");
    assert_eq!(me_response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn local_dev_token_is_rejected_when_not_explicitly_allowed() {
    let app = app(AppState::new(
        AppStore::new(),
        auth::AuthConfig::new(None, None, false),
    ));

    let response = app
        .oneshot(authed_request(Method::GET, "/api/v0/me", ""))
        .await
        .expect("me request should complete");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn me_profile_stats_and_dashboard_include_bmr_when_inputs_exist() {
    let app = app(AppState::for_tests());

    let profile_response = app
        .clone()
        .oneshot(authed_request(
            Method::PATCH,
            "/api/v0/me/profile",
            r#"{"displayName":"Ada","unitSystem":"lbs","calorieTarget":2200,"proteinTargetGrams":160,"birthDate":"1990-01-01","formulaSex":"female"}"#,
        ))
        .await
        .expect("profile request should complete");
    assert_eq!(profile_response.status(), StatusCode::OK);

    let weight_response = app
        .clone()
        .oneshot(authed_request(
            Method::POST,
            "/api/v0/me/stats/body",
            r#"{"metric":"weight","value":180,"unit":"lbs","measuredAt":"2026-06-12T12:00:00Z"}"#,
        ))
        .await
        .expect("weight request should complete");
    assert_eq!(weight_response.status(), StatusCode::CREATED);

    let height_response = app
        .clone()
        .oneshot(authed_request(
            Method::POST,
            "/api/v0/me/stats/body",
            r#"{"metric":"height","value":66,"unit":"in","measuredAt":"2026-06-12T12:00:00Z"}"#,
        ))
        .await
        .expect("height request should complete");
    assert_eq!(height_response.status(), StatusCode::CREATED);

    let stats_response = app
        .clone()
        .oneshot(authed_request(Method::GET, "/api/v0/me/stats", ""))
        .await
        .expect("stats request should complete");
    assert_eq!(stats_response.status(), StatusCode::OK);
    let stats_json = read_json(stats_response).await;
    assert_eq!(stats_json["bodyStats"].as_array().unwrap().len(), 2);
    assert_eq!(stats_json["updatePrompt"]["needsUpdate"], false);

    let dashboard_response = app
        .oneshot(authed_request(Method::GET, "/api/v0/health/dashboard", ""))
        .await
        .expect("dashboard request should complete");
    assert_eq!(dashboard_response.status(), StatusCode::OK);
    let dashboard_json = read_json(dashboard_response).await;
    assert!(dashboard_json["nutrition"]["bmrEstimate"].as_i64().unwrap() > 1200);
}

#[tokio::test]
async fn mobile_food_entries_support_crud_meal_type_macros_and_metadata() {
    let app = app(AppState::for_tests());

    let create_response = app
        .clone()
        .oneshot(authed_request(
            Method::POST,
            "/api/v0/me/food/entries",
            r#"{"foodName":"Greek yogurt","mealType":"snack","calories":220,"proteinGrams":28,"carbsGrams":12,"fatGrams":5,"loggedAt":"2026-06-12T12:00:00Z","metadata":{"brand":"plain"}}"#,
        ))
        .await
        .expect("food create request should complete");
    assert_eq!(create_response.status(), StatusCode::CREATED);
    let created = read_json(create_response).await;
    let entry_id = created["id"].as_str().expect("food entry should have id");
    assert_eq!(created["mealType"], "snack");
    assert_eq!(created["metadata"]["brand"], "plain");

    let list_response = app
        .clone()
        .oneshot(authed_request(
            Method::GET,
            "/api/v0/me/food/entries?mealType=snack&sort=logged_at_desc",
            "",
        ))
        .await
        .expect("food list request should complete");
    assert_eq!(list_response.status(), StatusCode::OK);
    let listed = read_json(list_response).await;
    assert_eq!(listed.as_array().unwrap().len(), 1);

    let patch_body = r#"{"foodName":"Greek yogurt bowl","mealType":"breakfast","calories":260,"proteinGrams":30,"carbsGrams":18,"fatGrams":6,"metadata":{"brand":"plain","source":"manual"}}"#.to_string();
    let patch_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/v0/me/food/entries/{entry_id}"))
                .header(header::AUTHORIZATION, "Bearer local-dev-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(patch_body))
                .expect("request should build"),
        )
        .await
        .expect("food patch request should complete");
    assert_eq!(patch_response.status(), StatusCode::OK);
    let patched = read_json(patch_response).await;
    assert_eq!(patched["mealType"], "breakfast");
    assert_eq!(patched["calories"], 260);

    let delete_response = app
        .clone()
        .oneshot(authed_request(
            Method::DELETE,
            &format!("/api/v0/me/food/entries/{entry_id}"),
            "",
        ))
        .await
        .expect("food delete request should complete");
    assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);

    let empty_response = app
        .oneshot(authed_request(Method::GET, "/api/v0/me/food/entries", ""))
        .await
        .expect("food list request should complete");
    assert_eq!(empty_response.status(), StatusCode::OK);
    let empty = read_json(empty_response).await;
    assert!(empty.as_array().unwrap().is_empty());
}

#[tokio::test]
async fn mobile_workout_plan_generation_and_session_finish_awards_xp() {
    let app = app(AppState::for_tests());

    let plan_response = app
        .clone()
        .oneshot(authed_request(
            Method::POST,
            "/api/v0/me/workouts/plan/generate",
            r#"{"startDate":"2026-06-22","endDate":"2026-06-28","availableDaysPerWeek":3,"preferredTrainingGoal":"strength","injuryZones":["shoulder"],"programSelection":[{"programSlug":"starter_strength","weight":1.0}]}"#,
        ))
        .await
        .expect("plan generate request should complete");
    assert_eq!(plan_response.status(), StatusCode::CREATED);
    let plan = read_json(plan_response).await;
    assert_eq!(plan["classSelection"], "no_class");
    assert_eq!(plan["days"].as_array().unwrap().len(), 3);
    assert!(plan["warnings"].as_array().unwrap()[0]
        .as_str()
        .unwrap()
        .contains("shoulder"));
    let day_id = plan["days"][0]["id"]
        .as_str()
        .expect("generated day should have id")
        .to_string();

    let plan_list_response = app
        .clone()
        .oneshot(authed_request(Method::GET, "/api/v0/me/workouts/plan", ""))
        .await
        .expect("plan list request should complete");
    assert_eq!(plan_list_response.status(), StatusCode::OK);
    let plans = read_json(plan_list_response).await;
    assert_eq!(plans.as_array().unwrap().len(), 1);

    let session_body =
        format!(r#"{{"workoutDayId":"{day_id}","startedAt":"2026-06-22T12:00:00Z"}}"#);
    let session_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v0/me/workouts/sessions")
                .header(header::AUTHORIZATION, "Bearer local-dev-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(session_body))
                .expect("request should build"),
        )
        .await
        .expect("session create request should complete");
    assert_eq!(session_response.status(), StatusCode::CREATED);
    let session = read_json(session_response).await;
    assert_eq!(session["status"], "started");
    let session_id = session["id"].as_str().expect("session should have id");

    let finish_body = r#"{"finishedAt":"2026-06-22T13:00:00Z","exercises":[{"exerciseSlug":"squat","status":"completed","setsCompleted":3},{"exerciseSlug":"push_up","status":"completed","setsCompleted":3}]}"#;
    let finish_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/api/v0/me/workouts/sessions/{session_id}/finish"))
                .header(header::AUTHORIZATION, "Bearer local-dev-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(finish_body))
                .expect("request should build"),
        )
        .await
        .expect("session finish request should complete");
    assert_eq!(finish_response.status(), StatusCode::OK);
    let finished = read_json(finish_response).await;
    assert_eq!(finished["status"], "completed");
    assert!(finished["xpAwarded"].as_i64().unwrap() >= 30);

    let dashboard_response = app
        .oneshot(authed_request(Method::GET, "/api/v0/health/dashboard", ""))
        .await
        .expect("dashboard request should complete");
    assert_eq!(dashboard_response.status(), StatusCode::OK);
    let dashboard = read_json(dashboard_response).await;
    assert!(dashboard["progression"]["xp"].as_i64().unwrap() >= 30);
}
