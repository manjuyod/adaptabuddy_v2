use api_server::{app, AppState};
use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use serde_json::Value;
use storage::AppStore;
use tower::ServiceExt;

#[tokio::test]
#[ignore = "run through scripts/supabase/verify-local-stack.mjs against local Supabase"]
async fn actual_supabase_session_authenticates_the_rust_dashboard() {
    let database_url = std::env::var("LOCAL_SUPABASE_DB_URL").unwrap();
    let token = std::env::var("LOCAL_SUPABASE_TEST_TOKEN").unwrap();
    let owner_id = std::env::var("LOCAL_SUPABASE_TEST_USER_ID").unwrap();
    let secret = std::env::var("LOCAL_SUPABASE_JWT_SECRET").unwrap();
    let supabase_url = std::env::var("LOCAL_SUPABASE_URL").unwrap();
    let store = AppStore::connect(&database_url).await.unwrap();
    let router = app(AppState::new(
        store,
        auth::AuthConfig::new(
            Some(format!(
                "{}/auth/v1/.well-known/jwks.json",
                supabase_url.trim_end_matches('/')
            )),
            Some(secret),
            false,
        ),
    ));
    let response = router
        .oneshot(
            Request::builder()
                .uri("/api/v0/me/dashboard?user_id=00000000-0000-0000-0000-000000000001")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(response.into_body(), 1024 * 1024)
        .await
        .unwrap();
    let dashboard: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(dashboard["user"]["id"], owner_id);
    assert_eq!(dashboard["today"]["calories_consumed"], 123);
    assert_eq!(dashboard["habits"]["food_logged_today"], true);
}
