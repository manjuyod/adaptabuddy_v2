//! Requires a disposable database with all migrations applied. Fixtures are
//! uniquely named and are never intended for a user's local Supabase database.
use api_server::{app, AppState};
use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
    Router,
};
use chrono::Utc;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde_json::{json, Value};
use sqlx::PgPool;
use storage::AppStore;
use tower::ServiceExt;
use uuid::Uuid;

struct Fixture {
    pool: PgPool,
    api: Router,
    token: String,
    other: String,
    owner: Uuid,
    day: Uuid,
    exercise: Uuid,
    prefix: String,
}
impl Fixture {
    async fn new() -> Self {
        let pool = PgPool::connect(&std::env::var("STORAGE_TEST_DATABASE_URL").unwrap())
            .await
            .unwrap();
        let owner = Uuid::new_v4();
        let other = Uuid::new_v4();
        let day = Uuid::new_v4();
        let plan = Uuid::new_v4();
        let exercise = Uuid::new_v4();
        let prefix = format!("boundary_{}", Uuid::new_v4().simple());
        sqlx::query("insert into auth.users(id) values($1),($2)")
            .bind(owner)
            .bind(other)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("insert into public.workout_plans(id,user_id,start_date,end_date) values($1,$2,current_date,current_date)").bind(plan).bind(owner).execute(&pool).await.unwrap();
        sqlx::query("insert into public.workout_days(id,user_id,workout_plan_id,scheduled_date,status,name) values($1,$2,$3,current_date,'planned','Boundary')").bind(day).bind(owner).bind(plan).execute(&pool).await.unwrap();
        let secret = "disposable-boundary-test";
        let jwt = |id| {
            encode(&Header::new(Algorithm::HS256), &json!({"sub":id,"exp":Utc::now().timestamp()+300,"aud":"authenticated","role":"authenticated","session_id":Uuid::new_v4()}), &EncodingKey::from_secret(secret.as_bytes())).unwrap()
        };
        let f = Self {
            api: app(AppState::new(
                AppStore::postgres(pool.clone()),
                auth::AuthConfig::with_local_jwt_secret(secret),
            )),
            pool,
            token: jwt(owner),
            other: jwt(other),
            owner,
            day,
            exercise,
            prefix,
        };
        f.add("source", "reps", json!([["machine"]]), "source")
            .await;
        sqlx::query("insert into public.workout_exercises(id,user_id,workout_day_id,exercise_slug,name,sets,reps) values($1,$2,$3,$4,'Source',3,8)").bind(exercise).bind(owner).bind(day).bind(f.slug("source")).execute(&f.pool).await.unwrap();
        f
    }
    fn slug(&self, suffix: &str) -> String {
        format!("{}_{}", self.prefix, suffix)
    }
    fn path(&self) -> String {
        format!(
            "/api/v0/me/workouts/exercises/{}/replacements",
            self.exercise
        )
    }
    async fn add(&self, suffix: &str, mode: &str, gear: Value, variant: &str) {
        sqlx::query("insert into public.exercises(slug,name,movement_pattern,category,tracking_mode,equipment_options,replacement_family,variant_group,replacement_status) values($1,$1,'test','strength',$2,$3,$4,$5,'eligible')")
            .bind(self.slug(suffix)).bind(mode).bind(gear).bind(&self.prefix).bind(self.slug(variant)).execute(&self.pool).await.unwrap();
    }
    fn body(&self, suffix: &str, p: Value) -> Value {
        json!({"replacementSlug":self.slug(suffix),"availableEquipment":["bodyweight","band","anchor"],"prescription":p})
    }
    async fn current(&self) -> (String, Option<Value>) {
        sqlx::query_as(
            "select exercise_slug,prescription from public.workout_exercises where id=$1",
        )
        .bind(self.exercise)
        .fetch_one(&self.pool)
        .await
        .unwrap()
    }
    async fn request(&self, method: Method, path: &str, body: Value) -> (StatusCode, Value) {
        request(&self.api, &self.token, method, path, body).await
    }
}
async fn request(
    api: &Router,
    token: &str,
    method: Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let response = api
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
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
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable database"]
async fn muscle_exclusion_cannot_be_bypassed_by_an_alias_without_anatomy() {
    let f = Fixture::new().await;
    f.add("mapped", "reps", json!([["bodyweight"]]), "shared")
        .await;
    f.add("alias", "reps", json!([["bodyweight"]]), "shared")
        .await;
    sqlx::query("insert into public.exercise_muscle_map(exercise_id,muscle_group_id,role,contribution) select e.id,m.id,'primary',1 from public.exercises e cross join public.muscle_groups m where e.slug=$1 and m.slug='quads'").bind(f.slug("mapped")).execute(&f.pool).await.unwrap();
    let (s, rows) = f
        .request(
            Method::GET,
            &format!(
                "{}?availableEquipment=bodyweight&excludedMuscles=quads",
                f.path()
            ),
            Value::Null,
        )
        .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(rows, json!([]));
    let mut body = f.body("alias", json!({"trackingMode":"reps","sets":3,"reps":8}));
    body["excludedMuscles"] = json!(["quads"]);
    let (s, _) = f.request(Method::POST, &f.path(), body).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    assert_eq!(f.current().await.0, f.slug("source"));
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable database"]
async fn replacement_preserves_existing_cautions_and_exercise_identity() {
    let f = Fixture::new().await;
    f.add(
        "replacement",
        "reps",
        json!([["bodyweight"]]),
        "replacement",
    )
    .await;
    let notes = vec!["Existing shoulder caution".to_string()];
    sqlx::query("update public.workout_exercises set caution_notes=$2 where id=$1")
        .bind(f.exercise)
        .bind(&notes)
        .execute(&f.pool)
        .await
        .unwrap();
    let (s, row) = f
        .request(
            Method::POST,
            &f.path(),
            f.body(
                "replacement",
                json!({"trackingMode":"reps","sets":2,"reps":8}),
            ),
        )
        .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(row["id"], f.exercise.to_string());
    assert_eq!(row["cautionNotes"], json!(notes));
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable database"]
async fn filters_exclusions_aliases_and_owner_are_enforced() {
    let f = Fixture::new().await;
    f.add(
        "combo",
        "reps",
        json!([["band", "anchor"], ["dumbbell", "bench"]]),
        "combo",
    )
    .await;
    f.add("combo_alias", "reps", json!([["bodyweight"]]), "combo")
        .await;
    f.add("same", "reps", json!([["bodyweight"]]), "source")
        .await;
    for name in ["inactive", "unreviewed", "category", "family", "muscle"] {
        f.add(name, "reps", json!([["bodyweight"]]), name).await;
    }
    sqlx::query("update public.exercises set is_active=false where slug=$1")
        .bind(f.slug("inactive"))
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query("update public.exercises set replacement_status='unreviewed' where slug=$1")
        .bind(f.slug("unreviewed"))
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query("update public.exercises set category='pilates' where slug=$1")
        .bind(f.slug("category"))
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query("update public.exercises set replacement_family='different' where slug=$1")
        .bind(f.slug("family"))
        .execute(&f.pool)
        .await
        .unwrap();
    sqlx::query("insert into public.exercise_muscle_map(exercise_id,muscle_group_id,role,contribution) select e.id,m.id,'primary',1 from public.exercises e cross join public.muscle_groups m where e.slug=$1 and m.slug='quads'").bind(f.slug("muscle")).execute(&f.pool).await.unwrap();
    let (s, rows) = f
        .request(
            Method::GET,
            &format!("{}?availableEquipment=bodyweight,band,anchor", f.path()),
            Value::Null,
        )
        .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(rows.as_array().unwrap().len(), 2, "{rows}");
    // Source needs a machine, but only candidate equipment is filtered.
    for gear in ["band,anchor", "dumbbell,bench"] {
        let (s, rows) = f
            .request(
                Method::GET,
                &format!("{}?availableEquipment={gear}", f.path()),
                Value::Null,
            )
            .await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(rows.as_array().unwrap().len(), 1);
        assert_eq!(rows[0]["slug"], f.slug("combo"));
    }
    let (_, rows) = f
        .request(
            Method::GET,
            &format!("{}?availableEquipment=band", f.path()),
            Value::Null,
        )
        .await;
    assert_eq!(rows, json!([]));
    for query in [
        format!("excludedFamilies={}", f.prefix),
        format!(
            "excludedExerciseSlugs={},{},{}",
            f.slug("combo"),
            f.slug("combo_alias"),
            f.slug("muscle")
        ),
        format!(
            "excludedMuscles=quads&excludedExerciseSlugs={},{}",
            f.slug("combo"),
            f.slug("combo_alias")
        ),
    ] {
        let (s, rows) = f
            .request(
                Method::GET,
                &format!(
                    "{}?availableEquipment=bodyweight,band,anchor&{query}",
                    f.path()
                ),
                Value::Null,
            )
            .await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(rows, json!([]));
    }
    for method in [Method::GET, Method::POST] {
        let path = if method == Method::GET {
            format!("{}?availableEquipment=bodyweight", f.path())
        } else {
            f.path()
        };
        let (s, _) = request(
            &f.api,
            &f.other,
            method,
            &path,
            f.body("muscle", json!({"trackingMode":"reps","sets":3,"reps":8})),
        )
        .await;
        assert_eq!(s, StatusCode::NOT_FOUND);
    }
    let (s, _) = request(
        &f.api,
        "invalid",
        Method::GET,
        &format!("{}?availableEquipment=bodyweight", f.path()),
        Value::Null,
    )
    .await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    assert_eq!(f.current().await.0, f.slug("source"));
    let mut excluded = f.body("muscle", json!({"trackingMode":"reps","sets":3,"reps":8}));
    excluded["excludedMuscles"] = json!(["quads"]);
    let (s, _) = f.request(Method::POST, &f.path(), excluded).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    assert_eq!(f.current().await.0, f.slug("source"));
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable database"]
async fn prescriptions_round_trip_without_unit_coercion_and_reject_invalid_fields() {
    let f = Fixture::new().await;
    for (name, mode, prescription) in [
        (
            "timed",
            "duration",
            json!({"trackingMode":"duration","durationSeconds":45}),
        ),
        (
            "sided",
            "duration_each_side",
            json!({"trackingMode":"duration_each_side","sets":2,"durationSeconds":30}),
        ),
        (
            "distance",
            "duration_distance",
            json!({"trackingMode":"duration_distance","durationSeconds":600,"distanceMeters":1000}),
        ),
        (
            "reps",
            "reps_each_side",
            json!({"trackingMode":"reps_each_side","sets":3,"reps":8}),
        ),
    ] {
        f.add(name, mode, json!([["bodyweight"]]), name).await;
        let (s, response) = f
            .request(Method::POST, &f.path(), f.body(name, prescription.clone()))
            .await;
        assert_eq!(s, StatusCode::OK, "{response}");
        let stored = f.current().await;
        assert_eq!(stored.0, f.slug(name));
        assert_eq!(stored.1.as_ref().unwrap(), &response["prescription"]);
        for (key, value) in prescription.as_object().unwrap() {
            assert_eq!(&response["prescription"][key], value);
        }
        if mode.starts_with("duration") {
            assert_eq!(response["reps"], 0);
            assert!(response["prescription"]["reps"].is_null());
        }
        let (s, plans) = f
            .request(Method::GET, "/api/v0/me/workouts/plan", Value::Null)
            .await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(
            plans[0]["days"][0]["exercises"][0]["prescription"],
            response["prescription"]
        );
    }
    let before = f.current().await;
    for invalid in [
        json!({"trackingMode":"duration","durationSeconds":0}),
        json!({"trackingMode":"duration","durationSeconds":-1}),
        json!({"trackingMode":"duration","durationSeconds":86401}),
        json!({"trackingMode":"duration","durationSeconds":10,"distanceMeters":5}),
        json!({"trackingMode":"duration_each_side","durationSeconds":10,"distanceMeters":5}),
        json!({"trackingMode":"duration","durationSeconds":10,"reps":3}),
        json!({"trackingMode":"duration_distance","durationSeconds":10}),
        json!({"trackingMode":"duration_distance","durationSeconds":10,"distanceMeters":1000001}),
        json!({"trackingMode":"reps","sets":0,"reps":8}),
        json!({"trackingMode":"reps","sets":101,"reps":8}),
        json!({"trackingMode":"reps","sets":3,"reps":1001}),
        json!({"trackingMode":"reps","sets":3,"reps":8,"durationSeconds":10}),
        json!({"trackingMode":"unknown","durationSeconds":10}),
    ] {
        let (s, response) = f
            .request(Method::POST, &f.path(), f.body("timed", invalid))
            .await;
        assert_eq!(s, StatusCode::BAD_REQUEST, "{response}");
    }
    let (s, _) = f
        .request(
            Method::POST,
            &f.path(),
            f.body("timed", json!({"trackingMode":"reps","sets":3,"reps":8})),
        )
        .await;
    assert_eq!(s, StatusCode::CONFLICT); // well-shaped but incompatible with the selected catalog record
    assert_eq!(f.current().await, before);
}

async fn wait_for_lock(pool: &PgPool, needle: &str) {
    for _ in 0..200 {
        let count:i64=sqlx::query_scalar("select count(*) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and wait_event_type='Lock' and position($1 in query)>0").bind(needle).fetch_one(pool).await.unwrap();
        if count > 0 {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    panic!("Expected an actual PostgreSQL lock wait for {needle}");
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable database"]
async fn exercise_browsing_reads_the_active_catalog_on_both_routes() {
    let f = Fixture::new().await;
    f.add("inactive", "reps", json!([["bodyweight"]]), "inactive")
        .await;
    sqlx::query("update public.exercises set is_active=false where slug=$1")
        .bind(f.slug("inactive"))
        .execute(&f.pool)
        .await
        .unwrap();
    for path in [
        "/api/v0/me/workouts/exercises",
        "/api/v0/workouts/exercises",
    ] {
        let (s, rows) = f.request(Method::GET, path, Value::Null).await;
        assert_eq!(s, StatusCode::OK);
        let rows = rows.as_array().unwrap();
        assert!(rows.contains(&json!(f.slug("source"))));
        assert!(!rows.contains(&json!(f.slug("inactive"))));
        assert!(
            rows.contains(&json!("pilates_bridge"))
                || rows
                    .iter()
                    .any(|r| r.as_str().unwrap().starts_with("pilates_"))
        );
        let (s, _) = request(&f.api, "invalid", Method::GET, path, Value::Null).await;
        assert_eq!(s, StatusCode::UNAUTHORIZED);
    }
}

#[tokio::test]
#[ignore = "requires STORAGE_TEST_DATABASE_URL pointing to a disposable database"]
async fn session_creation_race_and_concurrent_swaps_preserve_history() {
    let f = Fixture::new().await;
    f.add("a", "reps", json!([["bodyweight"]]), "a").await;
    f.add("b", "reps", json!([["bodyweight"]]), "b").await;
    // Two full replacements serialize; no mixed slug/prescription result.
    let a = f.body("a", json!({"trackingMode":"reps","sets":2,"reps":11}));
    let b = f.body("b", json!({"trackingMode":"reps","sets":4,"reps":7}));
    let path = f.path();
    let (ra, rb) = tokio::join!(
        f.request(Method::POST, &path, a),
        f.request(Method::POST, &path, b)
    );
    assert_eq!(ra.0, StatusCode::OK);
    assert_eq!(rb.0, StatusCode::OK);
    let current = f.current().await;
    let expected = if current.0 == f.slug("a") {
        &ra.1
    } else {
        assert_eq!(current.0, f.slug("b"));
        &rb.1
    };
    assert_eq!(current.1.as_ref().unwrap(), &expected["prescription"]);
    // Queue a session first behind a day lock, then queue a swap behind it.
    // This exercises the FK key-share/UPDATE lock interaction deterministically.
    let mut lock = f.pool.begin().await.unwrap();
    sqlx::query("select id from public.workout_days where id=$1 for update")
        .bind(f.day)
        .execute(&mut *lock)
        .await
        .unwrap();
    let api = f.api.clone();
    let token = f.token.clone();
    let day = f.day;
    let session = tokio::spawn(async move {
        request(
            &api,
            &token,
            Method::POST,
            "/api/v0/me/workouts/sessions",
            json!({"workoutDayId":day}),
        )
        .await
    });
    wait_for_lock(&f.pool, "insert into public.workout_sessions").await;
    let api = f.api.clone();
    let token = f.token.clone();
    let body = f.body("source", json!({"trackingMode":"reps","sets":3,"reps":8}));
    let swap = tokio::spawn(async move { request(&api, &token, Method::POST, &path, body).await });
    wait_for_lock(&f.pool, "select we.workout_day_id").await;
    lock.commit().await.unwrap();
    assert_eq!(session.await.unwrap().0, StatusCode::CREATED);
    assert_eq!(swap.await.unwrap().0, StatusCode::CONFLICT);
    assert_eq!(f.current().await, current);
    let sessions: i64 = sqlx::query_scalar(
        "select count(*) from public.workout_sessions where workout_day_id=$1 and user_id=$2",
    )
    .bind(f.day)
    .bind(f.owner)
    .fetch_one(&f.pool)
    .await
    .unwrap();
    assert_eq!(sessions, 1);
}
