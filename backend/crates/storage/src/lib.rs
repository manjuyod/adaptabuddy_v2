use chrono::{DateTime, NaiveDate, Utc};
use core_domain::{EventSource, HealthEvent, HealthEventKind, UserId};
use serde_json::Value;
use shared_types::{
    BodyMetricView, ExerciseReplacementCandidate, ExerciseStatRequest, ExerciseStatView,
    FoodEntryPatchRequest, FoodEntryQuery, FoodEntryRequest, FoodEntryView, FoodLogRequest,
    GoalView, HabitView, MuscleGroupStatView, Profile, ProfilePatchRequest,
    ReplaceWorkoutExerciseRequest, WorkoutDayView, WorkoutExerciseView, WorkoutPlanView,
    WorkoutSessionCreateRequest, WorkoutSessionExerciseInput, WorkoutSessionExerciseView,
    WorkoutSessionRequest, WorkoutSessionView, XpEventView,
};
use sqlx::{postgres::PgPoolOptions, PgConnection, PgPool};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("store lock is poisoned")]
    Poisoned,
    #[error("record was not found")]
    NotFound,
    #[error("record state conflicts with the requested operation")]
    Conflict,
    #[error("database error")]
    Database(#[from] sqlx::Error),
    #[error("database contained unknown health event kind: {0}")]
    InvalidEventKind(String),
    #[error("database contained unknown event source: {0}")]
    InvalidEventSource(String),
}

#[derive(Clone)]
pub struct AppStore {
    backend: StoreBackend,
}

#[derive(Clone)]
enum StoreBackend {
    Memory(Arc<Mutex<StoreInner>>),
    Postgres(PgPool),
}

#[derive(Default)]
struct StoreInner {
    profiles: HashMap<UserId, Profile>,
    food_entries: HashMap<UserId, Vec<FoodEntryView>>,
    workouts: HashMap<UserId, Vec<WorkoutSessionRequest>>,
    exercise_stats: HashMap<UserId, Vec<ExerciseStatView>>,
    muscle_group_stats: HashMap<UserId, Vec<MuscleGroupStatView>>,
    xp_events: HashMap<UserId, Vec<XpEventView>>,
    workout_plans: HashMap<UserId, Vec<WorkoutPlanView>>,
    workout_sessions: HashMap<UserId, Vec<WorkoutSessionView>>,
    habits: HashMap<UserId, Vec<HabitView>>,
    body_metrics: HashMap<UserId, Vec<BodyMetricView>>,
    goals: HashMap<UserId, Vec<GoalView>>,
    events: HashMap<UserId, Vec<HealthEvent>>,
}

type FoodEntryRow = (
    Uuid,
    String,
    String,
    i32,
    Option<i32>,
    Option<i32>,
    Option<i32>,
    DateTime<Utc>,
    Value,
);

impl Default for AppStore {
    fn default() -> Self {
        Self::new()
    }
}

impl AppStore {
    pub fn new() -> Self {
        Self {
            backend: StoreBackend::Memory(Arc::new(Mutex::new(StoreInner::default()))),
        }
    }

    pub fn postgres(pool: PgPool) -> Self {
        Self {
            backend: StoreBackend::Postgres(pool),
        }
    }

    pub async fn connect(database_url: &str) -> Result<Self, StorageError> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;
        Ok(Self::postgres(pool))
    }

    pub async fn profile(&self, user_id: &UserId) -> Result<Profile, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner.profiles.get(user_id).cloned().unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => postgres_profile(pool, user_id).await,
        }
    }

    pub async fn upsert_profile(
        &self,
        user_id: &UserId,
        profile: Profile,
    ) -> Result<Profile, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner.profiles.insert(user_id.clone(), profile.clone());
                Ok(profile)
            }
            StoreBackend::Postgres(pool) => postgres_upsert_profile(pool, user_id, profile).await,
        }
    }

    /// Applies only present profile fields, including explicit nulls, atomically.
    /// Serializes profile and nutrition changes without a read-merge-write race.
    pub async fn patch_profile(
        &self,
        user_id: &UserId,
        patch: ProfilePatchRequest,
    ) -> Result<Profile, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let profile = inner.profiles.entry(user_id.clone()).or_default();
                if let Some(value) = patch.display_name {
                    profile.display_name = value;
                }
                if let Some(value) = patch.unit_system {
                    profile.unit_system = value;
                }
                if let Some(value) = patch.calorie_target {
                    profile.calorie_target = value;
                }
                if let Some(value) = patch.protein_target_grams {
                    profile.protein_target_grams = value;
                }
                if let Some(value) = patch.birth_date {
                    profile.birth_date = value;
                }
                if let Some(value) = patch.formula_sex {
                    profile.formula_sex = value;
                }
                Ok(profile.clone())
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                sqlx::query(
                    "insert into public.users (id) values ($1) on conflict (id) do nothing",
                )
                .bind(user_id.0)
                .execute(&mut *transaction)
                .await?;
                // This row lock is also held by full-profile upserts. Every writer
                // updates users before nutrition_targets to keep one lock order.
                let user = sqlx::query_as::<
                    _,
                    (Option<String>, String, Option<NaiveDate>, Option<String>),
                >(
                    r#"
                    update public.users
                    set display_name = case when $2 then $3 else display_name end,
                        unit_system = coalesce($4, unit_system),
                        birth_date = case when $5 then $6 else birth_date end,
                        formula_sex = case when $7 then $8 else formula_sex end,
                        updated_at = now()
                    where id = $1
                    returning display_name, unit_system, birth_date, formula_sex
                    "#,
                )
                .bind(user_id.0)
                .bind(patch.display_name.is_some())
                .bind(patch.display_name.flatten())
                .bind(patch.unit_system)
                .bind(patch.birth_date.is_some())
                .bind(patch.birth_date.flatten())
                .bind(patch.formula_sex.is_some())
                .bind(patch.formula_sex.flatten())
                .fetch_one(&mut *transaction)
                .await?;
                let targets = sqlx::query_as::<_, (Option<i32>, Option<i32>)>(
                    r#"
                    insert into public.nutrition_targets (user_id, calorie_target, protein_target_grams)
                    values ($1, $3, $5)
                    on conflict (user_id) do update
                    set calorie_target = case when $2 then excluded.calorie_target else nutrition_targets.calorie_target end,
                        protein_target_grams = case when $4 then excluded.protein_target_grams else nutrition_targets.protein_target_grams end,
                        updated_at = now()
                    returning calorie_target, protein_target_grams
                    "#
                ).bind(user_id.0)
                    .bind(patch.calorie_target.is_some()).bind(patch.calorie_target.flatten())
                    .bind(patch.protein_target_grams.is_some()).bind(patch.protein_target_grams.flatten())
                    .fetch_one(&mut *transaction).await?;
                transaction.commit().await?;
                Ok(Profile {
                    display_name: user.0,
                    unit_system: user.1,
                    birth_date: user.2,
                    formula_sex: user.3,
                    calorie_target: targets.0,
                    protein_target_grams: targets.1,
                })
            }
        }
    }

    /// Records a legacy food log with its FoodLogged event and five XP atomically.
    pub async fn add_food_log(
        &self,
        user_id: &UserId,
        log: FoodLogRequest,
    ) -> Result<FoodLogRequest, StorageError> {
        let entry = FoodEntryRequest {
            food_name: log.food_name.clone(),
            meal_type: "other".to_string(),
            calories: log.calories,
            protein_grams: Some(log.protein_grams),
            carbs_grams: None,
            fat_grams: None,
            logged_at: None,
            metadata: Value::Object(Default::default()),
        };
        self.create_food_entry(user_id, entry).await?;
        Ok(log)
    }

    /// Records food, its FoodLogged event, and five XP in one atomic write.
    pub async fn create_food_entry(
        &self,
        user_id: &UserId,
        request: FoodEntryRequest,
    ) -> Result<FoodEntryView, StorageError> {
        let entry = FoodEntryView {
            id: Uuid::new_v4(),
            food_name: request.food_name,
            meal_type: normalize_meal_type(request.meal_type),
            calories: request.calories,
            protein_grams: request.protein_grams,
            carbs_grams: request.carbs_grams,
            fat_grams: request.fat_grams,
            logged_at: request.logged_at.unwrap_or_else(Utc::now),
            metadata: request.metadata,
        };
        let event = HealthEvent::new(
            user_id.clone(),
            HealthEventKind::FoodLogged,
            entry.logged_at,
            EventSource::Api,
            format!("Food logged: {}", entry.food_name),
        );
        let xp = XpEventView {
            id: Uuid::new_v4(),
            amount: 5,
            reason: "food_logged".into(),
            occurred_at: entry.logged_at,
        };

        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .food_entries
                    .entry(user_id.clone())
                    .or_default()
                    .push(entry.clone());
                record_memory_activity(&mut inner, event, Some(xp));
                Ok(entry)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                let row = sqlx::query_as::<_, FoodEntryRow>(
                    r#"
                    insert into public.nutrition_food_logs
                      (id, user_id, food_name, meal_type, calories, protein_grams, carbs_grams, fat_grams, logged_at, metadata)
                    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    returning id, food_name, meal_type, calories, protein_grams, carbs_grams, fat_grams, logged_at, metadata
                    "#,
                )
                .bind(entry.id)
                .bind(user_id.0)
                .bind(&entry.food_name)
                .bind(&entry.meal_type)
                .bind(entry.calories)
                .bind(entry.protein_grams)
                .bind(entry.carbs_grams)
                .bind(entry.fat_grams)
                .bind(entry.logged_at)
                .bind(&entry.metadata)
                .fetch_one(&mut *transaction)
                .await?;
                record_postgres_activity(&mut transaction, &event, Some(&xp)).await?;
                transaction.commit().await?;
                Ok(food_entry_from_row(row))
            }
        }
    }

    pub async fn food_logs(&self, user_id: &UserId) -> Result<Vec<FoodLogRequest>, StorageError> {
        Ok(self
            .food_entries(user_id, FoodEntryQuery::default())
            .await?
            .into_iter()
            .map(|entry| FoodLogRequest {
                food_name: entry.food_name,
                calories: entry.calories,
                protein_grams: entry.protein_grams.unwrap_or_default(),
            })
            .collect())
    }

    pub async fn food_entries(
        &self,
        user_id: &UserId,
        query: FoodEntryQuery,
    ) -> Result<Vec<FoodEntryView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let mut entries = inner.food_entries.get(user_id).cloned().unwrap_or_default();
                if let Some(meal_type) = query.meal_type {
                    entries.retain(|entry| entry.meal_type == meal_type);
                }
                sort_food_entries(&mut entries, query.sort.as_deref());
                Ok(entries)
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, FoodEntryRow>(
                    r#"
                    select id, food_name, meal_type, calories, protein_grams, carbs_grams, fat_grams, logged_at, metadata
                    from public.nutrition_food_logs
                    where user_id = $1 and ($2::text is null or meal_type = $2)
                    order by logged_at desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .bind(query.meal_type)
                .fetch_all(pool)
                .await?;
                let mut entries: Vec<_> = rows.into_iter().map(food_entry_from_row).collect();
                sort_food_entries(&mut entries, query.sort.as_deref());
                Ok(entries)
            }
        }
    }

    pub async fn patch_food_entry(
        &self,
        user_id: &UserId,
        entry_id: Uuid,
        patch: FoodEntryPatchRequest,
    ) -> Result<FoodEntryView, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let entries = inner.food_entries.entry(user_id.clone()).or_default();
                let entry = entries
                    .iter_mut()
                    .find(|candidate| candidate.id == entry_id)
                    .ok_or(StorageError::NotFound)?;
                apply_food_patch(entry, patch);
                Ok(entry.clone())
            }
            StoreBackend::Postgres(pool) => {
                let row = sqlx::query_as::<_, FoodEntryRow>(
                    r#"
                    update public.nutrition_food_logs
                    set food_name = coalesce($3, food_name),
                        meal_type = coalesce($4, meal_type),
                        calories = coalesce($5, calories),
                        protein_grams = coalesce($6, protein_grams),
                        carbs_grams = coalesce($7, carbs_grams),
                        fat_grams = coalesce($8, fat_grams),
                        logged_at = coalesce($9, logged_at),
                        metadata = coalesce($10, metadata)
                    where user_id = $1 and id = $2
                    returning id, food_name, meal_type, calories, protein_grams, carbs_grams, fat_grams, logged_at, metadata
                    "#,
                )
                .bind(user_id.0)
                .bind(entry_id)
                .bind(patch.food_name)
                .bind(patch.meal_type.map(normalize_meal_type))
                .bind(patch.calories)
                .bind(patch.protein_grams)
                .bind(patch.carbs_grams)
                .bind(patch.fat_grams)
                .bind(patch.logged_at)
                .bind(patch.metadata)
                .fetch_optional(pool)
                .await?
                .ok_or(StorageError::NotFound)?;
                Ok(food_entry_from_row(row))
            }
        }
    }

    pub async fn delete_food_entry(
        &self,
        user_id: &UserId,
        entry_id: Uuid,
    ) -> Result<(), StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let entries = inner.food_entries.entry(user_id.clone()).or_default();
                let before = entries.len();
                entries.retain(|entry| entry.id != entry_id);
                if entries.len() == before {
                    return Err(StorageError::NotFound);
                }
                Ok(())
            }
            StoreBackend::Postgres(pool) => {
                let result = sqlx::query(
                    r#"
                    delete from public.nutrition_food_logs
                    where user_id = $1 and id = $2
                    "#,
                )
                .bind(user_id.0)
                .bind(entry_id)
                .execute(pool)
                .await?;
                if result.rows_affected() == 0 {
                    return Err(StorageError::NotFound);
                }
                Ok(())
            }
        }
    }

    /// Records a legacy completed workout, its activity event, and 30 XP atomically.
    pub async fn add_workout(
        &self,
        user_id: &UserId,
        session: WorkoutSessionRequest,
    ) -> Result<WorkoutSessionRequest, StorageError> {
        let event = HealthEvent::new(
            user_id.clone(),
            HealthEventKind::WorkoutCompleted,
            session.completed_at,
            EventSource::Api,
            format!("Workout completed: {}", session.name),
        );
        let xp = XpEventView {
            id: Uuid::new_v4(),
            amount: 30,
            reason: "workout_completed".into(),
            occurred_at: session.completed_at,
        };
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .workouts
                    .entry(user_id.clone())
                    .or_default()
                    .push(session.clone());
                record_memory_activity(&mut inner, event, Some(xp));
                Ok(session)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                sqlx::query(
                    r#"
                    insert into public.workout_sessions (user_id, name, duration_minutes, completed_at)
                    values ($1, $2, $3, $4)
                    "#,
                )
                .bind(user_id.0)
                .bind(&session.name)
                .bind(session.duration_minutes)
                .bind(session.completed_at)
                .execute(&mut *transaction)
                .await?;
                record_postgres_activity(&mut transaction, &event, Some(&xp)).await?;
                transaction.commit().await?;
                Ok(session)
            }
        }
    }

    pub async fn add_exercise_stat(
        &self,
        user_id: &UserId,
        request: ExerciseStatRequest,
    ) -> Result<ExerciseStatView, StorageError> {
        let stat = ExerciseStatView {
            id: Uuid::new_v4(),
            exercise_slug: request.exercise_slug,
            estimated_one_rep_max: request.estimated_one_rep_max,
            weight: request.weight,
            reps: request.reps,
            unit: request.unit,
            recorded_at: request.recorded_at.unwrap_or_else(Utc::now),
        };

        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .exercise_stats
                    .entry(user_id.clone())
                    .or_default()
                    .push(stat.clone());
                Ok(stat)
            }
            StoreBackend::Postgres(pool) => {
                let row = sqlx::query_as::<
                    _,
                    (Uuid, String, Option<f64>, Option<f64>, Option<i32>, Option<String>, DateTime<Utc>),
                >(
                    r#"
                    insert into public.exercise_stats
                      (id, user_id, exercise_slug, estimated_one_rep_max, weight, reps, unit, recorded_at)
                    values ($1, $2, $3, $4, $5, $6, $7, $8)
                    returning id, exercise_slug, estimated_one_rep_max, weight, reps, unit, recorded_at
                    "#,
                )
                .bind(stat.id)
                .bind(user_id.0)
                .bind(&stat.exercise_slug)
                .bind(stat.estimated_one_rep_max)
                .bind(stat.weight)
                .bind(stat.reps)
                .bind(&stat.unit)
                .bind(stat.recorded_at)
                .fetch_one(pool)
                .await?;
                Ok(ExerciseStatView {
                    id: row.0,
                    exercise_slug: row.1,
                    estimated_one_rep_max: row.2,
                    weight: row.3,
                    reps: row.4,
                    unit: row.5,
                    recorded_at: row.6,
                })
            }
        }
    }

    pub async fn exercise_stats(
        &self,
        user_id: &UserId,
    ) -> Result<Vec<ExerciseStatView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner
                    .exercise_stats
                    .get(user_id)
                    .cloned()
                    .unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<
                    _,
                    (
                        Uuid,
                        String,
                        Option<f64>,
                        Option<f64>,
                        Option<i32>,
                        Option<String>,
                        DateTime<Utc>,
                    ),
                >(
                    r#"
                    select id, exercise_slug, estimated_one_rep_max, weight, reps, unit, recorded_at
                    from public.exercise_stats
                    where user_id = $1
                    order by recorded_at desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(|row| ExerciseStatView {
                        id: row.0,
                        exercise_slug: row.1,
                        estimated_one_rep_max: row.2,
                        weight: row.3,
                        reps: row.4,
                        unit: row.5,
                        recorded_at: row.6,
                    })
                    .collect())
            }
        }
    }

    pub async fn muscle_group_stats(
        &self,
        user_id: &UserId,
    ) -> Result<Vec<MuscleGroupStatView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner
                    .muscle_group_stats
                    .get(user_id)
                    .cloned()
                    .unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, (String, i32, i32, Option<String>)>(
                    r#"
                    select muscle_group, score, training_frequency, caution
                    from public.muscle_group_stats
                    where user_id = $1
                    order by score desc, muscle_group asc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(|row| MuscleGroupStatView {
                        muscle_group: row.0,
                        score: row.1,
                        training_frequency: row.2,
                        caution: row.3,
                    })
                    .collect())
            }
        }
    }

    pub async fn add_xp_event(
        &self,
        user_id: &UserId,
        amount: i32,
        reason: impl Into<String>,
        occurred_at: DateTime<Utc>,
    ) -> Result<XpEventView, StorageError> {
        let event = XpEventView {
            id: Uuid::new_v4(),
            amount,
            reason: reason.into(),
            occurred_at,
        };

        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .xp_events
                    .entry(user_id.clone())
                    .or_default()
                    .push(event.clone());
                Ok(event)
            }
            StoreBackend::Postgres(pool) => {
                let row = sqlx::query_as::<_, (Uuid, i32, String, DateTime<Utc>)>(
                    r#"
                    insert into public.xp_events (id, user_id, amount, reason, occurred_at)
                    values ($1, $2, $3, $4, $5)
                    returning id, amount, reason, occurred_at
                    "#,
                )
                .bind(event.id)
                .bind(user_id.0)
                .bind(event.amount)
                .bind(&event.reason)
                .bind(event.occurred_at)
                .fetch_one(pool)
                .await?;
                Ok(XpEventView {
                    id: row.0,
                    amount: row.1,
                    reason: row.2,
                    occurred_at: row.3,
                })
            }
        }
    }

    pub async fn xp_events(&self, user_id: &UserId) -> Result<Vec<XpEventView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner.xp_events.get(user_id).cloned().unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, (Uuid, i32, String, DateTime<Utc>)>(
                    r#"
                    select id, amount, reason, occurred_at
                    from public.xp_events
                    where user_id = $1
                    order by occurred_at desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(|row| XpEventView {
                        id: row.0,
                        amount: row.1,
                        reason: row.2,
                        occurred_at: row.3,
                    })
                    .collect())
            }
        }
    }

    pub async fn workouts(
        &self,
        user_id: &UserId,
    ) -> Result<Vec<WorkoutSessionRequest>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let mut workouts = inner.workouts.get(user_id).cloned().unwrap_or_default();
                workouts.extend(
                    inner
                        .workout_sessions
                        .get(user_id)
                        .into_iter()
                        .flatten()
                        .filter(|session| {
                            matches!(session.status.as_str(), "completed" | "partially_completed")
                        })
                        .filter_map(|session| {
                            session
                                .finished_at
                                .map(|completed_at| WorkoutSessionRequest {
                                    name: "Mobile workout".to_string(),
                                    duration_minutes: (completed_at - session.started_at)
                                        .num_minutes()
                                        .clamp(0, i32::MAX as i64)
                                        as i32,
                                    completed_at,
                                })
                        }),
                );
                Ok(workouts)
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, (String, i32, DateTime<Utc>)>(
                    r#"
                    select name, duration_minutes, completed_at
                    from public.workout_sessions
                    where user_id = $1 and status in ('completed', 'partially_completed')
                    order by completed_at desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(
                        |(name, duration_minutes, completed_at)| WorkoutSessionRequest {
                            name,
                            duration_minutes,
                            completed_at,
                        },
                    )
                    .collect())
            }
        }
    }

    pub async fn save_workout_plan(
        &self,
        user_id: &UserId,
        plan: WorkoutPlanView,
    ) -> Result<WorkoutPlanView, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .workout_plans
                    .entry(user_id.clone())
                    .or_default()
                    .push(plan.clone());
                Ok(plan)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                sqlx::query(
                    r#"
                    insert into public.workout_plans
                      (id, user_id, start_date, end_date, status, class_selection, preferred_training_goal, warnings)
                    values ($1, $2, $3, $4, $5, $6, $7, $8)
                    "#,
                )
                .bind(plan.id)
                .bind(user_id.0)
                .bind(plan.start_date)
                .bind(plan.end_date)
                .bind(&plan.status)
                .bind(&plan.class_selection)
                .bind(&plan.preferred_training_goal)
                .bind(&plan.warnings)
                .execute(&mut *transaction)
                .await?;

                for day in &plan.days {
                    sqlx::query(
                        r#"
                        insert into public.workout_days
                          (id, user_id, workout_plan_id, scheduled_date, status, name, notes)
                        values ($1, $2, $3, $4, $5, $6, $7)
                        "#,
                    )
                    .bind(day.id)
                    .bind(user_id.0)
                    .bind(day.workout_plan_id)
                    .bind(day.scheduled_date)
                    .bind(&day.status)
                    .bind(&day.name)
                    .bind(&day.notes)
                    .execute(&mut *transaction)
                    .await?;

                    for exercise in &day.exercises {
                        sqlx::query(
                            r#"
                            insert into public.workout_exercises
                              (id, user_id, workout_day_id, exercise_slug, name, sets, reps, caution_notes)
                            values ($1, $2, $3, $4, $5, $6, $7, $8)
                            "#,
                        )
                        .bind(exercise.id)
                        .bind(user_id.0)
                        .bind(exercise.workout_day_id)
                        .bind(&exercise.exercise_slug)
                        .bind(&exercise.name)
                        .bind(exercise.sets)
                        .bind(exercise.reps)
                        .bind(&exercise.caution_notes)
                        .execute(&mut *transaction)
                        .await?;
                    }
                }

                transaction.commit().await?;
                Ok(plan)
            }
        }
    }

    pub async fn workout_plans(
        &self,
        user_id: &UserId,
    ) -> Result<Vec<WorkoutPlanView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner
                    .workout_plans
                    .get(user_id)
                    .cloned()
                    .unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let plans = sqlx::query_as::<_, (Uuid, NaiveDate, NaiveDate, String, String, Option<String>, Vec<String>)>(
                    r#"
                    select id, start_date, end_date, status, class_selection, preferred_training_goal, warnings
                    from public.workout_plans
                    where user_id = $1
                    order by start_date desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;

                let mut result = Vec::with_capacity(plans.len());
                for plan in plans {
                    result.push(WorkoutPlanView {
                        id: plan.0,
                        start_date: plan.1,
                        end_date: plan.2,
                        status: plan.3,
                        class_selection: plan.4,
                        preferred_training_goal: plan.5,
                        warnings: plan.6,
                        days: postgres_workout_days(pool, user_id, plan.0).await?,
                    });
                }
                Ok(result)
            }
        }
    }

    /// Reference catalog for browsing. Replacement eligibility is a separate
    /// filter applied by the candidate operation.
    pub async fn catalog_exercise_slugs(&self) -> Result<Vec<String>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(_) => Ok(Vec::new()),
            StoreBackend::Postgres(pool) => Ok(sqlx::query_scalar(
                "select slug from public.exercises where is_active order by name, slug",
            )
            .fetch_all(pool)
            .await?),
        }
    }

    pub async fn replacement_candidates(
        &self,
        user_id: &UserId,
        workout_exercise_id: Uuid,
        available_equipment: Vec<String>,
        excluded_slugs: Vec<String>,
        excluded_families: Vec<String>,
        excluded_muscles: Vec<String>,
    ) -> Result<Vec<ExerciseReplacementCandidate>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(_) => Err(StorageError::NotFound),
            StoreBackend::Postgres(pool) => {
                let source_slug =
                    owned_catalog_source_slug(pool, user_id, workout_exercise_id).await?;
                catalog_candidates(
                    pool,
                    &source_slug,
                    &available_equipment,
                    &excluded_slugs,
                    &excluded_families,
                    &excluded_muscles,
                )
                .await
            }
        }
    }

    pub async fn replace_planned_workout_exercise(
        &self,
        user_id: &UserId,
        workout_exercise_id: Uuid,
        request: ReplaceWorkoutExerciseRequest,
    ) -> Result<WorkoutExerciseView, StorageError> {
        let StoreBackend::Postgres(pool) = &self.backend else {
            return Err(StorageError::NotFound);
        };
        let mut tx = pool.begin().await?;
        let current = sqlx::query_as::<_, (Uuid, String)>("select we.workout_day_id, we.exercise_slug from public.workout_exercises we join public.workout_days wd on wd.id=we.workout_day_id and wd.user_id=we.user_id where we.id=$1 and we.user_id=$2 and wd.status='planned' for update")
            .bind(workout_exercise_id).bind(user_id.0).fetch_optional(&mut *tx).await?.ok_or(StorageError::NotFound)?;
        let has_session: bool = sqlx::query_scalar("select exists(select 1 from public.workout_sessions where user_id=$1 and workout_day_id=$2)")
            .bind(user_id.0).bind(current.0).fetch_one(&mut *tx).await?;
        if has_session {
            return Err(StorageError::Conflict);
        }
        let source_slug = canonical_catalog_slug(&current.1).to_string();
        let candidates = catalog_candidates_tx(
            &mut tx,
            &source_slug,
            &request.available_equipment,
            &request.excluded_exercise_slugs,
            &request.excluded_families,
            &request.excluded_muscles,
        )
        .await?;
        let selected = candidates
            .into_iter()
            .find(|candidate| candidate.slug == request.replacement_slug)
            .ok_or(StorageError::NotFound)?;
        if request.prescription.tracking_mode != selected.tracking_mode {
            return Err(StorageError::Conflict);
        }
        let prescription_json =
            serde_json::to_value(&request.prescription).map_err(|_| StorageError::Conflict)?;
        let result = sqlx::query_as::<_, (Uuid, Uuid, String, String, i32, i32, Vec<String>, Option<Value>)>(
            "update public.workout_exercises set exercise_slug=$3,name=$4,sets=$5,reps=$6,prescription=$7 where id=$1 and user_id=$2 returning id,workout_day_id,exercise_slug,name,sets,reps,caution_notes,prescription")
            .bind(workout_exercise_id).bind(user_id.0).bind(&selected.slug).bind(&selected.name)
            .bind(request.prescription.sets.unwrap_or(0)).bind(request.prescription.reps.unwrap_or(0))
            .bind(prescription_json).fetch_one(&mut *tx).await?;
        tx.commit().await?;
        Ok(WorkoutExerciseView {
            id: result.0,
            workout_day_id: result.1,
            exercise_slug: result.2,
            name: result.3,
            sets: result.4,
            reps: result.5,
            caution_notes: result.6,
            prescription: result.7.and_then(|v| serde_json::from_value(v).ok()),
        })
    }

    pub async fn create_workout_session_v0(
        &self,
        user_id: &UserId,
        request: WorkoutSessionCreateRequest,
    ) -> Result<WorkoutSessionView, StorageError> {
        let session = WorkoutSessionView {
            id: Uuid::new_v4(),
            workout_day_id: request.workout_day_id,
            status: "started".to_string(),
            started_at: request.started_at.unwrap_or_else(Utc::now),
            finished_at: None,
            exercises: Vec::new(),
            xp_awarded: 0,
        };

        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                if let Some(day_id) = session.workout_day_id {
                    if !inner
                        .workout_plans
                        .get(user_id)
                        .into_iter()
                        .flatten()
                        .flat_map(|plan| &plan.days)
                        .any(|day| day.id == day_id)
                    {
                        return Err(StorageError::NotFound);
                    }
                }
                inner
                    .workout_sessions
                    .entry(user_id.clone())
                    .or_default()
                    .push(session.clone());
                Ok(session)
            }
            StoreBackend::Postgres(pool) => {
                let row = sqlx::query_as::<_, (Uuid, Option<Uuid>, String, DateTime<Utc>, Option<DateTime<Utc>>, i32)>(
                    r#"
                    insert into public.workout_sessions
                      (id, user_id, workout_day_id, status, started_at, xp_awarded, name, duration_minutes, completed_at)
                    select $1, $2, $3, $4, $5, $6, 'Mobile workout', 0, $5
                    where $3::uuid is null or exists (
                      select 1 from public.workout_days where id = $3 and user_id = $2
                    )
                    returning id, workout_day_id, status, started_at, finished_at, xp_awarded
                    "#,
                )
                .bind(session.id)
                .bind(user_id.0)
                .bind(session.workout_day_id)
                .bind(&session.status)
                .bind(session.started_at)
                .bind(session.xp_awarded)
                .fetch_optional(pool)
                .await?
                .ok_or(StorageError::NotFound)?;
                Ok(WorkoutSessionView {
                    id: row.0,
                    workout_day_id: row.1,
                    status: row.2,
                    started_at: row.3,
                    finished_at: row.4,
                    exercises: Vec::new(),
                    xp_awarded: row.5,
                })
            }
        }
    }

    pub async fn workout_sessions_v0(
        &self,
        user_id: &UserId,
    ) -> Result<Vec<WorkoutSessionView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner
                    .workout_sessions
                    .get(user_id)
                    .cloned()
                    .unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<
                    _,
                    (
                        Uuid,
                        Option<Uuid>,
                        String,
                        DateTime<Utc>,
                        Option<DateTime<Utc>>,
                        i32,
                    ),
                >(
                    r#"
                    select id, workout_day_id, status, started_at, finished_at, xp_awarded
                    from public.workout_sessions
                    where user_id = $1
                    order by started_at desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                let mut sessions = Vec::with_capacity(rows.len());
                for row in rows {
                    sessions.push(WorkoutSessionView {
                        id: row.0,
                        workout_day_id: row.1,
                        status: row.2,
                        started_at: row.3,
                        finished_at: row.4,
                        exercises: postgres_session_exercises(pool, user_id, row.0).await?,
                        xp_awarded: row.5,
                    });
                }
                Ok(sessions)
            }
        }
    }

    pub async fn workout_session_v0(
        &self,
        user_id: &UserId,
        session_id: Uuid,
    ) -> Result<WorkoutSessionView, StorageError> {
        self.workout_sessions_v0(user_id)
            .await?
            .into_iter()
            .find(|session| session.id == session_id)
            .ok_or(StorageError::NotFound)
    }

    pub async fn patch_workout_session_status(
        &self,
        user_id: &UserId,
        session_id: Uuid,
        status: String,
    ) -> Result<WorkoutSessionView, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let sessions = inner.workout_sessions.entry(user_id.clone()).or_default();
                let session = sessions
                    .iter_mut()
                    .find(|candidate| candidate.id == session_id)
                    .ok_or(StorageError::NotFound)?;
                if (session.finished_at.is_some()
                    || !matches!(session.status.as_str(), "planned" | "started"))
                    && session.status != status
                {
                    return Err(StorageError::Conflict);
                }
                session.status = status;
                Ok(session.clone())
            }
            StoreBackend::Postgres(pool) => {
                let result = sqlx::query(
                    r#"
                    update public.workout_sessions
                    set status = $3
                    where user_id = $1 and id = $2
                      and ((finished_at is null and status in ('planned', 'started')) or status = $3)
                    "#,
                )
                .bind(user_id.0)
                .bind(session_id)
                .bind(status)
                .execute(pool)
                .await?;
                if result.rows_affected() == 0 {
                    self.workout_session_v0(user_id, session_id).await?;
                    return Err(StorageError::Conflict);
                }
                self.workout_session_v0(user_id, session_id).await
            }
        }
    }

    pub async fn finish_workout_session_v0(
        &self,
        user_id: &UserId,
        session_id: Uuid,
        exercises: Vec<WorkoutSessionExerciseInput>,
        finished_at: DateTime<Utc>,
        xp_awarded: i32,
    ) -> Result<WorkoutSessionView, StorageError> {
        let status = workout_status_from_exercises(&exercises);
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let current = inner
                    .workout_sessions
                    .get(user_id)
                    .into_iter()
                    .flatten()
                    .find(|candidate| candidate.id == session_id)
                    .ok_or(StorageError::NotFound)?;
                if current.finished_at.is_some() {
                    return Ok(current.clone());
                }
                if !matches!(current.status.as_str(), "planned" | "started")
                    || finished_at < current.started_at
                {
                    return Err(StorageError::Conflict);
                }
                let day_id = current.workout_day_id;
                for exercise in &exercises {
                    if let Some(exercise_id) = exercise.workout_exercise_id {
                        let owned = inner
                            .workout_plans
                            .get(user_id)
                            .into_iter()
                            .flatten()
                            .flat_map(|plan| &plan.days)
                            .filter(|day| Some(day.id) == day_id)
                            .flat_map(|day| &day.exercises)
                            .any(|candidate| {
                                candidate.id == exercise_id
                                    && candidate.exercise_slug == exercise.exercise_slug
                            });
                        if !owned {
                            return Err(StorageError::NotFound);
                        }
                    }
                }
                let session = inner
                    .workout_sessions
                    .get_mut(user_id)
                    .expect("session owner exists")
                    .iter_mut()
                    .find(|candidate| candidate.id == session_id)
                    .expect("session exists");
                session.status = status;
                session.finished_at = Some(finished_at);
                session.xp_awarded = xp_awarded;
                session.exercises = exercises
                    .into_iter()
                    .map(|exercise| WorkoutSessionExerciseView {
                        id: Uuid::new_v4(),
                        workout_session_id: session_id,
                        workout_exercise_id: exercise.workout_exercise_id,
                        exercise_slug: exercise.exercise_slug,
                        status: exercise.status,
                        sets_completed: exercise.sets_completed,
                        notes: exercise.notes,
                    })
                    .collect();
                let saved = session.clone();
                if let Some(day_id) = day_id {
                    for day in inner
                        .workout_plans
                        .get_mut(user_id)
                        .into_iter()
                        .flatten()
                        .flat_map(|plan| &mut plan.days)
                    {
                        if day.id == day_id {
                            day.status = saved.status.clone();
                        }
                    }
                }
                inner
                    .xp_events
                    .entry(user_id.clone())
                    .or_default()
                    .push(XpEventView {
                        id: Uuid::new_v4(),
                        amount: xp_awarded,
                        reason: "workout_session_finished".into(),
                        occurred_at: finished_at,
                    });
                inner
                    .events
                    .entry(user_id.clone())
                    .or_default()
                    .push(HealthEvent::new(
                        user_id.clone(),
                        HealthEventKind::WorkoutCompleted,
                        finished_at,
                        EventSource::Api,
                        "Workout session finished",
                    ));
                Ok(saved)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                let current = sqlx::query_as::<_, (Option<Uuid>, String, DateTime<Utc>, Option<DateTime<Utc>>)>(
                    "select workout_day_id, status, started_at, finished_at from public.workout_sessions where user_id = $1 and id = $2 for update"
                ).bind(user_id.0).bind(session_id).fetch_optional(&mut *transaction).await?
                    .ok_or(StorageError::NotFound)?;
                if current.3.is_some() {
                    transaction.commit().await?;
                    return self.workout_session_v0(user_id, session_id).await;
                }
                if !matches!(current.1.as_str(), "planned" | "started") || finished_at < current.2 {
                    return Err(StorageError::Conflict);
                }
                for exercise in &exercises {
                    if let Some(exercise_id) = exercise.workout_exercise_id {
                        let owned: bool = sqlx::query_scalar(
                            "select exists (select 1 from public.workout_exercises where id = $1 and user_id = $2 and workout_day_id = $3 and exercise_slug = $4)"
                        ).bind(exercise_id).bind(user_id.0).bind(current.0).bind(&exercise.exercise_slug)
                            .fetch_one(&mut *transaction).await?;
                        if !owned {
                            return Err(StorageError::NotFound);
                        }
                    }
                }
                sqlx::query(
                    r#"
                    update public.workout_sessions
                    set status = $3,
                        finished_at = $4,
                        completed_at = $4,
                        xp_awarded = $5,
                        duration_minutes = $6
                    where user_id = $1 and id = $2
                    "#,
                )
                .bind(user_id.0)
                .bind(session_id)
                .bind(&status)
                .bind(finished_at)
                .bind(xp_awarded)
                .bind(
                    (finished_at - current.2)
                        .num_minutes()
                        .clamp(0, i32::MAX as i64) as i32,
                )
                .execute(&mut *transaction)
                .await?;

                for exercise in exercises {
                    sqlx::query(
                        r#"
                        insert into public.workout_session_exercises
                          (id, user_id, workout_session_id, workout_exercise_id, exercise_slug, status, sets_completed, notes)
                        values ($1, $2, $3, $4, $5, $6, $7, $8)
                        "#,
                    )
                    .bind(Uuid::new_v4())
                    .bind(user_id.0)
                    .bind(session_id)
                    .bind(exercise.workout_exercise_id)
                    .bind(&exercise.exercise_slug)
                    .bind(&exercise.status)
                    .bind(exercise.sets_completed)
                    .bind(&exercise.notes)
                    .execute(&mut *transaction)
                    .await?;
                }
                sqlx::query(
                    "update public.workout_days set status = $3 where user_id = $1 and id = $2",
                )
                .bind(user_id.0)
                .bind(current.0)
                .bind(&status)
                .execute(&mut *transaction)
                .await?;
                sqlx::query("insert into public.xp_events (user_id, amount, reason, occurred_at) values ($1, $2, 'workout_session_finished', $3)")
                    .bind(user_id.0).bind(xp_awarded).bind(finished_at).execute(&mut *transaction).await?;
                sqlx::query("insert into public.health_events (user_id, event_name, source, occurred_at, summary) values ($1, 'WorkoutCompleted', 'api', $2, 'Workout session finished')")
                    .bind(user_id.0).bind(finished_at).execute(&mut *transaction).await?;
                transaction.commit().await?;
                self.workout_session_v0(user_id, session_id).await
            }
        }
    }

    pub async fn add_habit(
        &self,
        user_id: &UserId,
        name: String,
        cadence: String,
    ) -> Result<HabitView, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let habit = HabitView {
                    id: Uuid::new_v4(),
                    name,
                    cadence,
                    completions: 0,
                };
                inner
                    .habits
                    .entry(user_id.clone())
                    .or_default()
                    .push(habit.clone());
                Ok(habit)
            }
            StoreBackend::Postgres(pool) => {
                let row = sqlx::query_as::<_, (Uuid, String, String)>(
                    r#"
                    insert into public.habits (user_id, name, cadence)
                    values ($1, $2, $3)
                    returning id, name, cadence
                    "#,
                )
                .bind(user_id.0)
                .bind(name)
                .bind(cadence)
                .fetch_one(pool)
                .await?;
                Ok(HabitView {
                    id: row.0,
                    name: row.1,
                    cadence: row.2,
                    completions: 0,
                })
            }
        }
    }

    /// Records a check-in and its HabitCompleted event atomically; no explicit XP.
    pub async fn complete_habit(
        &self,
        user_id: &UserId,
        habit_id: Uuid,
        completed_at: DateTime<Utc>,
    ) -> Result<HabitView, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let habits = inner.habits.entry(user_id.clone()).or_default();
                let habit = habits
                    .iter_mut()
                    .find(|candidate| candidate.id == habit_id)
                    .ok_or(StorageError::NotFound)?;
                habit.completions += 1;
                let saved = habit.clone();
                let event = HealthEvent::new(
                    user_id.clone(),
                    HealthEventKind::HabitCompleted,
                    completed_at,
                    EventSource::Api,
                    format!("Habit completed: {}", saved.name),
                );
                record_memory_activity(&mut inner, event, None);
                Ok(saved)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                let inserted = sqlx::query_as::<_, (Uuid,)>(
                    r#"
                    insert into public.habit_check_ins (user_id, habit_id, completed_at)
                    select $1, id, $3
                    from public.habits
                    where id = $2 and user_id = $1 and archived_at is null
                    returning habit_id
                    "#,
                )
                .bind(user_id.0)
                .bind(habit_id)
                .bind(completed_at)
                .fetch_optional(&mut *transaction)
                .await?;
                if inserted.is_none() {
                    return Err(StorageError::NotFound);
                }
                let habit = postgres_habit(&mut transaction, user_id, habit_id).await?;
                let event = HealthEvent::new(
                    user_id.clone(),
                    HealthEventKind::HabitCompleted,
                    completed_at,
                    EventSource::Api,
                    format!("Habit completed: {}", habit.name),
                );
                record_postgres_activity(&mut transaction, &event, None).await?;
                transaction.commit().await?;
                Ok(habit)
            }
        }
    }

    pub async fn habits(&self, user_id: &UserId) -> Result<Vec<HabitView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner.habits.get(user_id).cloned().unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, (Uuid, String, String, i64)>(
                    r#"
                    select h.id, h.name, h.cadence, count(c.id)::bigint as completions
                    from public.habits h
                    left join public.habit_check_ins c
                      on c.habit_id = h.id and c.user_id = h.user_id
                    where h.user_id = $1 and h.archived_at is null
                    group by h.id, h.name, h.cadence, h.created_at
                    order by h.created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(|(id, name, cadence, completions)| HabitView {
                        id,
                        name,
                        cadence,
                        completions: completions as usize,
                    })
                    .collect())
            }
        }
    }

    /// Records a body measurement and its BodyMetricUpdated event atomically.
    pub async fn add_body_metric(
        &self,
        user_id: &UserId,
        metric: BodyMetricView,
    ) -> Result<BodyMetricView, StorageError> {
        let event = HealthEvent::new(
            user_id.clone(),
            HealthEventKind::BodyMetricUpdated,
            metric.measured_at,
            EventSource::Api,
            format!("Body metric updated: {}", metric.metric),
        );
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .body_metrics
                    .entry(user_id.clone())
                    .or_default()
                    .push(metric.clone());
                record_memory_activity(&mut inner, event, None);
                Ok(metric)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                sqlx::query(
                    r#"
                    insert into public.body_metrics (user_id, metric, value, unit, measured_at)
                    values ($1, $2, $3, $4, $5)
                    "#,
                )
                .bind(user_id.0)
                .bind(&metric.metric)
                .bind(metric.value)
                .bind(&metric.unit)
                .bind(metric.measured_at)
                .execute(&mut *transaction)
                .await?;
                record_postgres_activity(&mut transaction, &event, None).await?;
                transaction.commit().await?;
                Ok(metric)
            }
        }
    }

    pub async fn body_metrics(
        &self,
        user_id: &UserId,
    ) -> Result<Vec<BodyMetricView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner.body_metrics.get(user_id).cloned().unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, (String, f64, String, DateTime<Utc>)>(
                    r#"
                    select metric, value, unit, measured_at
                    from public.body_metrics
                    where user_id = $1
                    order by measured_at desc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(|(metric, value, unit, measured_at)| BodyMetricView {
                        metric,
                        value,
                        unit,
                        measured_at,
                    })
                    .collect())
            }
        }
    }

    /// Creates a goal and its GoalCreated activity event atomically.
    pub async fn add_goal(
        &self,
        user_id: &UserId,
        title: String,
        target: String,
    ) -> Result<GoalView, StorageError> {
        let event = HealthEvent::new(
            user_id.clone(),
            HealthEventKind::GoalCreated,
            Utc::now(),
            EventSource::Api,
            format!("Goal created: {title}"),
        );
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let goal = GoalView {
                    id: Uuid::new_v4(),
                    title,
                    target,
                    completed: false,
                };
                inner
                    .goals
                    .entry(user_id.clone())
                    .or_default()
                    .push(goal.clone());
                record_memory_activity(&mut inner, event, None);
                Ok(goal)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                let row = sqlx::query_as::<_, (Uuid, String, String, bool)>(
                    r#"
                    insert into public.goals (user_id, title, target)
                    values ($1, $2, $3)
                    returning id, title, target, completed
                    "#,
                )
                .bind(user_id.0)
                .bind(title)
                .bind(target)
                .fetch_one(&mut *transaction)
                .await?;
                record_postgres_activity(&mut transaction, &event, None).await?;
                transaction.commit().await?;
                Ok(GoalView {
                    id: row.0,
                    title: row.1,
                    target: row.2,
                    completed: row.3,
                })
            }
        }
    }

    /// Updates a goal atomically with an event for each false-to-true transition.
    /// Retrying an already completed goal does not add another completion event.
    pub async fn patch_goal(
        &self,
        user_id: &UserId,
        goal_id: Uuid,
        completed: Option<bool>,
    ) -> Result<GoalView, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                let goals = inner.goals.entry(user_id.clone()).or_default();
                let goal = goals
                    .iter_mut()
                    .find(|candidate| candidate.id == goal_id)
                    .ok_or(StorageError::NotFound)?;
                let newly_completed = !goal.completed && completed == Some(true);
                if let Some(completed) = completed {
                    goal.completed = completed;
                }
                let saved = goal.clone();
                if newly_completed {
                    record_memory_activity(
                        &mut inner,
                        HealthEvent::new(
                            user_id.clone(),
                            HealthEventKind::GoalCompleted,
                            Utc::now(),
                            EventSource::Api,
                            format!("Goal completed: {}", saved.title),
                        ),
                        None,
                    );
                }
                Ok(saved)
            }
            StoreBackend::Postgres(pool) => {
                let mut transaction = pool.begin().await?;
                let current = sqlx::query_as::<_, (Uuid, String, String, bool)>(
                    "select id, title, target, completed from public.goals where user_id = $1 and id = $2 for update"
                ).bind(user_id.0).bind(goal_id).fetch_optional(&mut *transaction).await?
                    .ok_or(StorageError::NotFound)?;
                if completed.is_none_or(|value| value == current.3) {
                    transaction.commit().await?;
                    return Ok(GoalView {
                        id: current.0,
                        title: current.1,
                        target: current.2,
                        completed: current.3,
                    });
                }
                let occurred_at = Utc::now();
                let row = sqlx::query_as::<_, (Uuid, String, String, bool)>(
                    r#"
                    update public.goals
                    set completed = coalesce($3, completed),
                        completed_at = case
                          when $3 = true then $4
                          when $3 = false then null
                          else completed_at
                        end,
                        updated_at = now()
                    where user_id = $1 and id = $2
                    returning id, title, target, completed
                    "#,
                )
                .bind(user_id.0)
                .bind(goal_id)
                .bind(completed)
                .bind(occurred_at)
                .fetch_optional(&mut *transaction)
                .await?
                .ok_or(StorageError::NotFound)?;
                if row.3 {
                    let event = HealthEvent::new(
                        user_id.clone(),
                        HealthEventKind::GoalCompleted,
                        occurred_at,
                        EventSource::Api,
                        format!("Goal completed: {}", row.1),
                    );
                    record_postgres_activity(&mut transaction, &event, None).await?;
                }
                transaction.commit().await?;
                Ok(GoalView {
                    id: row.0,
                    title: row.1,
                    target: row.2,
                    completed: row.3,
                })
            }
        }
    }

    pub async fn goals(&self, user_id: &UserId) -> Result<Vec<GoalView>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner.goals.get(user_id).cloned().unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows = sqlx::query_as::<_, (Uuid, String, String, bool)>(
                    r#"
                    select id, title, target, completed
                    from public.goals
                    where user_id = $1
                    order by completed asc, created_at desc
                    "#,
                )
                .bind(user_id.0)
                .fetch_all(pool)
                .await?;
                Ok(rows
                    .into_iter()
                    .map(|(id, title, target, completed)| GoalView {
                        id,
                        title,
                        target,
                        completed,
                    })
                    .collect())
            }
        }
    }

    pub async fn append_event(&self, event: HealthEvent) -> Result<HealthEvent, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let mut inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                inner
                    .events
                    .entry(event.user_id.clone())
                    .or_default()
                    .push(event.clone());
                Ok(event)
            }
            StoreBackend::Postgres(pool) => {
                sqlx::query(
                    r#"
                    insert into public.health_events
                      (id, user_id, event_name, source, occurred_at, summary)
                    values ($1, $2, $3, $4, $5, $6)
                    "#,
                )
                .bind(event.id)
                .bind(event.user_id.0)
                .bind(event.kind.as_str())
                .bind(event.source.as_str())
                .bind(event.occurred_at)
                .bind(&event.summary)
                .execute(pool)
                .await?;
                Ok(event)
            }
        }
    }

    pub async fn events(&self, user_id: &UserId) -> Result<Vec<HealthEvent>, StorageError> {
        match &self.backend {
            StoreBackend::Memory(inner) => {
                let inner = inner.lock().map_err(|_| StorageError::Poisoned)?;
                Ok(inner.events.get(user_id).cloned().unwrap_or_default())
            }
            StoreBackend::Postgres(pool) => {
                let rows =
                    sqlx::query_as::<_, (Uuid, Uuid, String, DateTime<Utc>, String, String)>(
                        r#"
                    select id, user_id, event_name, occurred_at, source, summary
                    from public.health_events
                    where user_id = $1
                    order by occurred_at desc, created_at desc
                    "#,
                    )
                    .bind(user_id.0)
                    .fetch_all(pool)
                    .await?;

                rows.into_iter()
                    .map(|(id, user_id, event_name, occurred_at, source, summary)| {
                        let kind = HealthEventKind::from_database_value(&event_name)
                            .ok_or(StorageError::InvalidEventKind(event_name))?;
                        let source = EventSource::from_database_value(&source)
                            .ok_or(StorageError::InvalidEventSource(source))?;
                        Ok(HealthEvent {
                            id,
                            user_id: UserId(user_id),
                            kind,
                            occurred_at,
                            source,
                            summary,
                        })
                    })
                    .collect()
            }
        }
    }
}

fn record_memory_activity(inner: &mut StoreInner, event: HealthEvent, xp: Option<XpEventView>) {
    if let Some(xp) = xp {
        inner
            .xp_events
            .entry(event.user_id.clone())
            .or_default()
            .push(xp);
    }
    inner
        .events
        .entry(event.user_id.clone())
        .or_default()
        .push(event);
}

async fn record_postgres_activity(
    connection: &mut PgConnection,
    event: &HealthEvent,
    xp: Option<&XpEventView>,
) -> Result<(), StorageError> {
    sqlx::query("insert into public.health_events (id, user_id, event_name, source, occurred_at, summary) values ($1, $2, $3, $4, $5, $6)")
        .bind(event.id).bind(event.user_id.0).bind(event.kind.as_str()).bind(event.source.as_str())
        .bind(event.occurred_at).bind(&event.summary).execute(&mut *connection).await?;
    if let Some(xp) = xp {
        sqlx::query("insert into public.xp_events (id, user_id, amount, reason, occurred_at) values ($1, $2, $3, $4, $5)")
            .bind(xp.id).bind(event.user_id.0).bind(xp.amount).bind(&xp.reason).bind(xp.occurred_at)
            .execute(connection).await?;
    }
    Ok(())
}

async fn postgres_profile(pool: &PgPool, user_id: &UserId) -> Result<Profile, StorageError> {
    let row = sqlx::query_as::<
        _,
        (
            Option<String>,
            String,
            Option<i32>,
            Option<i32>,
            Option<NaiveDate>,
            Option<String>,
        ),
    >(
        r#"
        select u.display_name,
               u.unit_system,
               t.calorie_target,
               t.protein_target_grams,
               u.birth_date,
               u.formula_sex
        from public.users u
        left join public.nutrition_targets t on t.user_id = u.id
        where u.id = $1
        "#,
    )
    .bind(user_id.0)
    .fetch_optional(pool)
    .await?;

    Ok(row
        .map(
            |(
                display_name,
                unit_system,
                calorie_target,
                protein_target_grams,
                birth_date,
                formula_sex,
            )| Profile {
                display_name,
                unit_system,
                calorie_target,
                protein_target_grams,
                birth_date,
                formula_sex,
            },
        )
        .unwrap_or_default())
}

async fn postgres_upsert_profile(
    pool: &PgPool,
    user_id: &UserId,
    profile: Profile,
) -> Result<Profile, StorageError> {
    let mut transaction = pool.begin().await?;
    sqlx::query(
        r#"
        insert into public.users (id, display_name, unit_system, birth_date, formula_sex)
        values ($1, $2, $3, $4, $5)
        on conflict (id) do update
        set display_name = excluded.display_name,
            unit_system = excluded.unit_system,
            birth_date = excluded.birth_date,
            formula_sex = excluded.formula_sex,
            updated_at = now()
        "#,
    )
    .bind(user_id.0)
    .bind(&profile.display_name)
    .bind(&profile.unit_system)
    .bind(profile.birth_date)
    .bind(&profile.formula_sex)
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"
        insert into public.nutrition_targets (user_id, calorie_target, protein_target_grams)
        values ($1, $2, $3)
        on conflict (user_id) do update
        set calorie_target = excluded.calorie_target,
            protein_target_grams = excluded.protein_target_grams,
            updated_at = now()
        "#,
    )
    .bind(user_id.0)
    .bind(profile.calorie_target)
    .bind(profile.protein_target_grams)
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;
    Ok(profile)
}

async fn postgres_habit(
    connection: &mut PgConnection,
    user_id: &UserId,
    habit_id: Uuid,
) -> Result<HabitView, StorageError> {
    let row = sqlx::query_as::<_, (Uuid, String, String, i64)>(
        r#"
        select h.id, h.name, h.cadence, count(c.id)::bigint as completions
        from public.habits h
        left join public.habit_check_ins c
          on c.habit_id = h.id and c.user_id = h.user_id
        where h.user_id = $1 and h.id = $2 and h.archived_at is null
        group by h.id, h.name, h.cadence
        "#,
    )
    .bind(user_id.0)
    .bind(habit_id)
    .fetch_optional(connection)
    .await?
    .ok_or(StorageError::NotFound)?;

    Ok(HabitView {
        id: row.0,
        name: row.1,
        cadence: row.2,
        completions: row.3 as usize,
    })
}

fn normalize_meal_type(value: String) -> String {
    match value.as_str() {
        "breakfast" | "lunch" | "dinner" | "snack" | "other" => value,
        _ => "other".to_string(),
    }
}

fn food_entry_from_row(row: FoodEntryRow) -> FoodEntryView {
    FoodEntryView {
        id: row.0,
        food_name: row.1,
        meal_type: row.2,
        calories: row.3,
        protein_grams: row.4,
        carbs_grams: row.5,
        fat_grams: row.6,
        logged_at: row.7,
        metadata: row.8,
    }
}

fn sort_food_entries(entries: &mut [FoodEntryView], sort: Option<&str>) {
    match sort {
        Some("logged_at_asc") => entries.sort_by_key(|entry| entry.logged_at),
        Some("calories_desc") => entries.sort_by_key(|entry| std::cmp::Reverse(entry.calories)),
        Some("calories_asc") => entries.sort_by_key(|entry| entry.calories),
        _ => entries.sort_by_key(|entry| std::cmp::Reverse(entry.logged_at)),
    }
}

fn apply_food_patch(entry: &mut FoodEntryView, patch: FoodEntryPatchRequest) {
    if let Some(food_name) = patch.food_name {
        entry.food_name = food_name;
    }
    if let Some(meal_type) = patch.meal_type {
        entry.meal_type = normalize_meal_type(meal_type);
    }
    if let Some(calories) = patch.calories {
        entry.calories = calories;
    }
    if patch.protein_grams.is_some() {
        entry.protein_grams = patch.protein_grams;
    }
    if patch.carbs_grams.is_some() {
        entry.carbs_grams = patch.carbs_grams;
    }
    if patch.fat_grams.is_some() {
        entry.fat_grams = patch.fat_grams;
    }
    if let Some(logged_at) = patch.logged_at {
        entry.logged_at = logged_at;
    }
    if let Some(metadata) = patch.metadata {
        entry.metadata = metadata;
    }
}

fn canonical_catalog_slug(slug: &str) -> &str {
    match slug {
        "squat" => "bodyweight_squat",
        "row" => "dumbbell_row",
        "bench_press" => "barbell_bench_press",
        "deadlift" => "conventional_deadlift",
        other => other,
    }
}

async fn owned_catalog_source_slug(
    pool: &PgPool,
    user_id: &UserId,
    exercise_id: Uuid,
) -> Result<String, StorageError> {
    let slug: String = sqlx::query_scalar("select we.exercise_slug from public.workout_exercises we join public.workout_days wd on wd.id=we.workout_day_id and wd.user_id=we.user_id where we.id=$1 and we.user_id=$2 and wd.status='planned'")
        .bind(exercise_id).bind(user_id.0).fetch_optional(pool).await?.ok_or(StorageError::NotFound)?;
    Ok(canonical_catalog_slug(&slug).to_owned())
}

async fn catalog_candidates(
    pool: &PgPool,
    source_slug: &str,
    equipment: &[String],
    excluded_slugs: &[String],
    excluded_families: &[String],
    excluded_muscles: &[String],
) -> Result<Vec<ExerciseReplacementCandidate>, StorageError> {
    catalog_candidates_query(
        pool,
        source_slug,
        equipment,
        excluded_slugs,
        excluded_families,
        excluded_muscles,
    )
    .await
}

async fn catalog_candidates_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    source_slug: &str,
    equipment: &[String],
    excluded_slugs: &[String],
    excluded_families: &[String],
    excluded_muscles: &[String],
) -> Result<Vec<ExerciseReplacementCandidate>, StorageError> {
    catalog_candidates_query(
        &mut **tx,
        source_slug,
        equipment,
        excluded_slugs,
        excluded_families,
        excluded_muscles,
    )
    .await
}

async fn catalog_candidates_query<'e, E>(
    executor: E,
    source_slug: &str,
    equipment: &[String],
    excluded_slugs: &[String],
    excluded_families: &[String],
    excluded_muscles: &[String],
) -> Result<Vec<ExerciseReplacementCandidate>, StorageError>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    let equipment = serde_json::to_value(equipment).map_err(|_| StorageError::Conflict)?;
    let rows = sqlx::query_as::<_, (String,String,String,String,Value,Value,String,Value,String)>(r#"
      with source as (
        select category, replacement_family, coalesce(variant_group, slug) variant_group
        from public.exercises where slug=$1 and is_active and replacement_status='eligible'
      )
      select distinct on (coalesce(e.variant_group,e.slug)) e.slug,e.name,e.category,e.tracking_mode,e.instructions,e.source_urls,e.replacement_family,e.equipment_options,coalesce(e.variant_group,e.slug)
      from public.exercises e cross join source s
      where e.is_active and e.replacement_status='eligible'
        and e.category=s.category and e.replacement_family=s.replacement_family
        and coalesce(e.variant_group,e.slug)<>s.variant_group
        and not (e.slug = any($2)) and not (e.replacement_family = any($3))
        and exists (select 1 from jsonb_array_elements(e.equipment_options) opt where opt <@ $4::jsonb)
        and not exists (
          select 1 from public.exercises alias
          join public.exercise_muscle_map em on em.exercise_id=alias.id
          join public.muscle_groups mg on mg.id=em.muscle_group_id
          where alias.is_active and alias.replacement_status='eligible'
            and alias.category=e.category and alias.replacement_family=e.replacement_family
            and coalesce(alias.variant_group,alias.slug)=coalesce(e.variant_group,e.slug)
            and mg.slug=any($5)
        )
      order by coalesce(e.variant_group,e.slug),e.name,e.slug limit 50
    "#).bind(source_slug).bind(excluded_slugs).bind(excluded_families).bind(equipment).bind(excluded_muscles).fetch_all(executor).await?;
    Ok(rows
        .into_iter()
        .map(|r| ExerciseReplacementCandidate {
            slug: r.0,
            name: r.1,
            category: r.2,
            tracking_mode: r.3,
            instructions: r.4,
            source_urls: r.5,
            replacement_family: r.6,
            equipment_options: r.7,
            variant_group: r.8,
        })
        .collect())
}

fn workout_status_from_exercises(exercises: &[WorkoutSessionExerciseInput]) -> String {
    if exercises.is_empty() {
        return "cancelled".to_string();
    }

    if exercises
        .iter()
        .all(|exercise| exercise.status == "completed")
    {
        "completed".to_string()
    } else if exercises
        .iter()
        .all(|exercise| exercise.status == "skipped")
    {
        "skipped".to_string()
    } else {
        "partially_completed".to_string()
    }
}

async fn postgres_workout_days(
    pool: &PgPool,
    user_id: &UserId,
    plan_id: Uuid,
) -> Result<Vec<WorkoutDayView>, StorageError> {
    let rows = sqlx::query_as::<_, (Uuid, Uuid, NaiveDate, String, String, Option<String>)>(
        r#"
        select id, workout_plan_id, scheduled_date, status, name, notes
        from public.workout_days
        where user_id = $1 and workout_plan_id = $2
        order by scheduled_date asc, created_at asc
        "#,
    )
    .bind(user_id.0)
    .bind(plan_id)
    .fetch_all(pool)
    .await?;

    let mut days = Vec::with_capacity(rows.len());
    for row in rows {
        days.push(WorkoutDayView {
            id: row.0,
            workout_plan_id: row.1,
            scheduled_date: row.2,
            status: row.3,
            name: row.4,
            notes: row.5,
            exercises: postgres_workout_exercises(pool, user_id, row.0).await?,
        });
    }
    Ok(days)
}

async fn postgres_workout_exercises(
    pool: &PgPool,
    user_id: &UserId,
    workout_day_id: Uuid,
) -> Result<Vec<WorkoutExerciseView>, StorageError> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Uuid,
            String,
            String,
            i32,
            i32,
            Vec<String>,
            Option<Value>,
        ),
    >(
        r#"
        select id, workout_day_id, exercise_slug, name, sets, reps, caution_notes, prescription
        from public.workout_exercises
        where user_id = $1 and workout_day_id = $2
        order by created_at asc
        "#,
    )
    .bind(user_id.0)
    .bind(workout_day_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| WorkoutExerciseView {
            id: row.0,
            workout_day_id: row.1,
            exercise_slug: row.2,
            name: row.3,
            sets: row.4,
            reps: row.5,
            caution_notes: row.6,
            prescription: row.7.and_then(|value| serde_json::from_value(value).ok()),
        })
        .collect())
}

async fn postgres_session_exercises(
    pool: &PgPool,
    user_id: &UserId,
    session_id: Uuid,
) -> Result<Vec<WorkoutSessionExerciseView>, StorageError> {
    let rows = sqlx::query_as::<_, (Uuid, Uuid, Option<Uuid>, String, String, Option<i32>, Option<String>)>(
        r#"
        select id, workout_session_id, workout_exercise_id, exercise_slug, status, sets_completed, notes
        from public.workout_session_exercises
        where user_id = $1 and workout_session_id = $2
        order by created_at asc
        "#,
    )
    .bind(user_id.0)
    .bind(session_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| WorkoutSessionExerciseView {
            id: row.0,
            workout_session_id: row.1,
            workout_exercise_id: row.2,
            exercise_slug: row.3,
            status: row.4,
            sets_completed: row.5,
            notes: row.6,
        })
        .collect())
}
