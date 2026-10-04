use api_server::{app, AppState};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
    Router,
};
use chrono::Utc;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::{json, Value};
use storage::AppStore;
use tower::ServiceExt;
use uuid::Uuid;

fn token(secret: &str, id: Uuid) -> String {
    encode(&Header::new(Algorithm::HS256), &json!({"sub":id,"exp":Utc::now().timestamp()+300,"aud":"authenticated","role":"authenticated","session_id":Uuid::new_v4()}), &EncodingKey::from_secret(secret.as_bytes())).unwrap()
}
async fn call(
    app: &Router,
    token: &str,
    method: Method,
    uri: &str,
    body: Value,
) -> (StatusCode, Value) {
    let r = app
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
    let s = r.status();
    (
        s,
        serde_json::from_slice(
            &axum::body::to_bytes(r.into_body(), usize::MAX)
                .await
                .unwrap(),
        )
        .unwrap_or(Value::Null),
    )
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to the disposable replacement database"]
async fn catalog_replacements_are_owned_equipment_filtered_and_history_safe() {
    let url = std::env::var("STORAGE_TEST_DATABASE_URL").unwrap();
    let pool = sqlx::PgPool::connect(&url).await.unwrap();
    let owner = Uuid::new_v4();
    let other = Uuid::new_v4();
    sqlx::query("insert into auth.users(id) values($1),($2)")
        .bind(owner)
        .bind(other)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("update public.exercises set category='strength',tracking_mode='reps',replacement_family='squat',equipment_options='[[\"bodyweight\"]]',variant_group='source',replacement_status='eligible',replacement_reason=null where slug='bodyweight_squat'").execute(&pool).await.unwrap();
    for (slug, name, opts, variant, status) in [
        (
            "replacement_test_chair_squat",
            "Chair squat",
            json!([["chair"]]),
            "chair",
            "eligible",
        ),
        (
            "replacement_test_inactive_squat",
            "Inactive",
            json!([["bodyweight"]]),
            "other",
            "unreviewed",
        ),
        (
            "replacement_test_combo_squat",
            "Combo squat",
            json!([["band", "anchor"], ["dumbbell", "bench"]]),
            "combo",
            "eligible",
        ),
    ] {
        sqlx::query("insert into public.exercises(slug,name,movement_pattern,equipment,is_bodyweight,aliases,tags,media,contraindications,is_active,category,tracking_mode,instructions,source_urls,review_status,replacement_family,equipment_options,variant_group,replacement_status) values($1,$2,'squat','[]',true,'[]','[]','{}','[]',true,'strength','reps','[]','[]','reviewed','squat',$3,$4,$5)").bind(slug).bind(name).bind(opts).bind(variant).bind(status).execute(&pool).await.unwrap();
    }
    sqlx::query("insert into public.exercises(slug,name,movement_pattern,equipment,is_bodyweight,aliases,tags,media,contraindications,is_active,category,tracking_mode,instructions,source_urls,review_status,replacement_family,equipment_options,variant_group,replacement_status) values('replacement_test_duration','Duration','squat','[]',true,'[]','[]','{}','[]',true,'strength','duration','[]','[]','reviewed','squat','[[\"chair\"]]','duration','eligible')").execute(&pool).await.unwrap();
    let plan = Uuid::new_v4();
    let day = Uuid::new_v4();
    let exercise = Uuid::new_v4();
    sqlx::query("insert into public.workout_plans(id,user_id,start_date,end_date) values($1,$2,current_date,current_date)").bind(plan).bind(owner).execute(&pool).await.unwrap();
    sqlx::query("insert into public.workout_days(id,user_id,workout_plan_id,scheduled_date,status,name) values($1,$2,$3,current_date,'planned','Test')").bind(day).bind(owner).bind(plan).execute(&pool).await.unwrap();
    sqlx::query("insert into public.workout_exercises(id,user_id,workout_day_id,exercise_slug,name,sets,reps) values($1,$2,$3,'bodyweight_squat','Squat',3,8)").bind(exercise).bind(owner).bind(day).execute(&pool).await.unwrap();
    let secret = "replacement-test";
    let api = app(AppState::new(
        AppStore::postgres(pool.clone()),
        auth::AuthConfig::with_local_jwt_secret(secret),
    ));
    let mine = token(secret, owner);
    let theirs = token(secret, other);
    let path =
        format!("/api/v0/me/workouts/exercises/{exercise}/replacements?availableEquipment=chair");
    let (s, candidates) = call(&api, &mine, Method::GET, &path, Value::Null).await;
    assert_eq!(s, StatusCode::OK);
    assert!(candidates
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["slug"] == "replacement_test_chair_squat"));
    let (_, missing) = call(
        &api,
        &mine,
        Method::GET,
        &format!("/api/v0/me/workouts/exercises/{exercise}/replacements?availableEquipment=band"),
        Value::Null,
    )
    .await;
    assert!(!missing
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["slug"] == "replacement_test_combo_squat"));
    let (_, complete) = call(
        &api,
        &mine,
        Method::GET,
        &format!(
            "/api/v0/me/workouts/exercises/{exercise}/replacements?availableEquipment=band,anchor"
        ),
        Value::Null,
    )
    .await;
    assert!(complete
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["slug"] == "replacement_test_combo_squat"));
    let (s, _) = call(
        &api,
        &mine,
        Method::GET,
        &format!(
            "/api/v0/me/workouts/exercises/{exercise}/replacements?availableEquipment=barbell"
        ),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    let body = json!({"replacementSlug":"replacement_test_chair_squat","availableEquipment":["chair"],"prescription":{"trackingMode":"reps","sets":3,"reps":10}});
    let (s, _) = call(
        &api,
        &theirs,
        Method::POST,
        &format!("/api/v0/me/workouts/exercises/{exercise}/replacements"),
        body.clone(),
    )
    .await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, swapped) = call(
        &api,
        &mine,
        Method::POST,
        &format!("/api/v0/me/workouts/exercises/{exercise}/replacements"),
        body,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(swapped["exerciseSlug"], "replacement_test_chair_squat");
    let (s, timed) = call(&api, &mine, Method::POST, &format!("/api/v0/me/workouts/exercises/{exercise}/replacements"), json!({"replacementSlug":"replacement_test_duration","availableEquipment":["chair"],"prescription":{"trackingMode":"duration","durationSeconds":45}})).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(timed["prescription"]["durationSeconds"], 45);
    assert!(timed["prescription"]["reps"].is_null());
    let (s, _) = call(&api, &mine, Method::POST, &format!("/api/v0/me/workouts/exercises/{exercise}/replacements"), json!({"replacementSlug":"replacement_test_duration","availableEquipment":["chair"],"prescription":{"trackingMode":"duration","durationSeconds":999999}})).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call(&api, &mine, Method::POST, &format!("/api/v0/me/workouts/exercises/{exercise}/replacements"), json!({"replacementSlug":"bodyweight_squat","availableEquipment":["bodyweight"],"prescription":{"trackingMode":"duration","durationSeconds":0}})).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    sqlx::query("insert into public.workout_sessions(user_id,workout_day_id,name,duration_minutes) values($1,$2,'started',0)").bind(owner).bind(day).execute(&pool).await.unwrap();
    let (s,_) = call(&api,&mine,Method::POST,&format!("/api/v0/me/workouts/exercises/{exercise}/replacements"),json!({"replacementSlug":"bodyweight_squat","availableEquipment":["bodyweight"],"prescription":{"trackingMode":"reps","sets":3,"reps":8}})).await;
    assert_eq!(s, StatusCode::CONFLICT);
}
