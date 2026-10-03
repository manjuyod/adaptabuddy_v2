use chrono::{Datelike, Utc};
use core_domain::UserId;
use shared_types::{
    BodyMetricView, FoodEntryPatchRequest, FoodEntryQuery, FoodEntryRequest, FoodEntryView,
    FoodLogRequest, NutritionSummary, NutritionTargetsRequest, Profile, ProfilePatchRequest,
};
use storage::{AppStore, StorageError};

pub async fn log_food(
    store: &AppStore,
    user_id: &UserId,
    request: FoodLogRequest,
) -> Result<FoodLogRequest, StorageError> {
    store.add_food_log(user_id, request).await
}

pub async fn create_food_entry(
    store: &AppStore,
    user_id: &UserId,
    request: FoodEntryRequest,
) -> Result<FoodEntryView, StorageError> {
    store.create_food_entry(user_id, request).await
}

pub async fn food_entries(
    store: &AppStore,
    user_id: &UserId,
    query: FoodEntryQuery,
) -> Result<Vec<FoodEntryView>, StorageError> {
    store.food_entries(user_id, query).await
}

pub async fn patch_food_entry(
    store: &AppStore,
    user_id: &UserId,
    entry_id: uuid::Uuid,
    request: FoodEntryPatchRequest,
) -> Result<FoodEntryView, StorageError> {
    store.patch_food_entry(user_id, entry_id, request).await
}

pub async fn delete_food_entry(
    store: &AppStore,
    user_id: &UserId,
    entry_id: uuid::Uuid,
) -> Result<(), StorageError> {
    store.delete_food_entry(user_id, entry_id).await
}

pub async fn set_targets(
    store: &AppStore,
    user_id: &UserId,
    request: NutritionTargetsRequest,
) -> Result<NutritionSummary, StorageError> {
    store
        .patch_profile(
            user_id,
            ProfilePatchRequest {
                calorie_target: Some(request.calorie_target),
                protein_target_grams: Some(request.protein_target_grams),
                ..ProfilePatchRequest::default()
            },
        )
        .await?;
    summary(store, user_id).await
}

pub async fn summary(store: &AppStore, user_id: &UserId) -> Result<NutritionSummary, StorageError> {
    let profile = store.profile(user_id).await?;
    let logs = store.food_logs(user_id).await?;
    let body_metrics = store.body_metrics(user_id).await?;
    Ok(NutritionSummary {
        calories_logged: logs
            .iter()
            .fold(0_i32, |total, entry| total.saturating_add(entry.calories)),
        protein_grams: logs.iter().fold(0_i32, |total, entry| {
            total.saturating_add(entry.protein_grams)
        }),
        calorie_target: profile.calorie_target,
        protein_target_grams: profile.protein_target_grams,
        bmr_estimate: bmr_estimate(&profile, &body_metrics),
    })
}

fn bmr_estimate(profile: &Profile, body_metrics: &[BodyMetricView]) -> Option<i32> {
    let sex = profile.formula_sex.as_deref()?;
    let birth_date = profile.birth_date?;
    let today = Utc::now().date_naive();
    let mut age = today.year() - birth_date.year();
    if today.ordinal() < birth_date.ordinal() {
        age -= 1;
    }
    if age <= 0 {
        return None;
    }

    let weight_kg = latest_metric(body_metrics, "weight").and_then(metric_to_kg)?;
    let height_cm = latest_metric(body_metrics, "height").and_then(metric_to_cm)?;

    let value = match sex {
        "male" => 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age as f64),
        "female" => 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age as f64),
        _ => return None,
    };

    Some(value.round() as i32)
}

fn latest_metric<'a>(metrics: &'a [BodyMetricView], metric: &str) -> Option<&'a BodyMetricView> {
    metrics
        .iter()
        .filter(|entry| entry.metric == metric)
        .max_by(|left, right| left.measured_at.cmp(&right.measured_at))
}

fn metric_to_kg(metric: &BodyMetricView) -> Option<f64> {
    match metric.unit.as_str() {
        "kg" => Some(metric.value),
        "lbs" | "lb" => Some(metric.value * 0.453_592_37),
        _ => None,
    }
}

fn metric_to_cm(metric: &BodyMetricView) -> Option<f64> {
    match metric.unit.as_str() {
        "cm" => Some(metric.value),
        "in" | "inch" | "inches" => Some(metric.value * 2.54),
        _ => None,
    }
}
