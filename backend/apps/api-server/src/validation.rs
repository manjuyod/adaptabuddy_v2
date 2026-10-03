use chrono::Utc;
use shared_types::*;

pub(crate) trait ValidateRequest {
    fn validate(&self) -> Result<(), &'static str>;
}

fn require(condition: bool, message: &'static str) -> Result<(), &'static str> {
    if condition {
        Ok(())
    } else {
        Err(message)
    }
}

fn text(value: &str) -> bool {
    !value.trim().is_empty() && value.len() <= 500
}

fn nonnegative(value: Option<i32>) -> bool {
    value.is_none_or(|value| value >= 0)
}

fn meal(value: &str) -> bool {
    matches!(value, "breakfast" | "lunch" | "dinner" | "snack" | "other")
}

impl ValidateRequest for Profile {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            matches!(self.unit_system.as_str(), "lbs" | "kg"),
            "unitSystem must be lbs or kg",
        )?;
        require(
            self.display_name.as_deref().is_none_or(text),
            "displayName must contain at most 500 nonblank characters",
        )?;
        require(
            self.calorie_target.is_none_or(|value| value > 0)
                && self.protein_target_grams.is_none_or(|value| value > 0),
            "nutrition targets must be positive",
        )?;
        require(
            self.formula_sex
                .as_deref()
                .is_none_or(|value| matches!(value, "male" | "female")),
            "formulaSex must be male or female",
        )?;
        require(
            self.birth_date
                .is_none_or(|value| value < Utc::now().date_naive()),
            "birthDate must be in the past",
        )
    }
}

impl ValidateRequest for FoodLogRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            text(&self.food_name),
            "foodName must contain at most 500 nonblank characters",
        )?;
        require(
            self.calories >= 0 && self.protein_grams >= 0,
            "calories and macros cannot be negative",
        )
    }
}

impl ValidateRequest for ProfilePatchRequest {
    fn validate(&self) -> Result<(), &'static str> {
        Profile {
            display_name: self.display_name.clone().flatten(),
            unit_system: self
                .unit_system
                .clone()
                .unwrap_or_else(|| "lbs".to_string()),
            calorie_target: self.calorie_target.flatten(),
            protein_target_grams: self.protein_target_grams.flatten(),
            birth_date: self.birth_date.flatten(),
            formula_sex: self.formula_sex.clone().flatten(),
        }
        .validate()
    }
}

impl ValidateRequest for FoodEntryRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            text(&self.food_name),
            "foodName must contain at most 500 nonblank characters",
        )?;
        require(meal(&self.meal_type), "invalid mealType")?;
        require(
            self.calories >= 0
                && nonnegative(self.protein_grams)
                && nonnegative(self.carbs_grams)
                && nonnegative(self.fat_grams),
            "calories and macros cannot be negative",
        )
    }
}

impl ValidateRequest for FoodEntryPatchRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            self.food_name.as_deref().is_none_or(text),
            "foodName must contain at most 500 nonblank characters",
        )?;
        require(
            self.meal_type.as_deref().is_none_or(meal),
            "invalid mealType",
        )?;
        require(
            nonnegative(self.calories)
                && nonnegative(self.protein_grams)
                && nonnegative(self.carbs_grams)
                && nonnegative(self.fat_grams),
            "calories and macros cannot be negative",
        )
    }
}

impl ValidateRequest for FoodEntryQuery {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            self.meal_type.as_deref().is_none_or(meal),
            "invalid mealType",
        )?;
        require(
            self.sort.as_deref().is_none_or(|value| {
                matches!(
                    value,
                    "logged_at_asc" | "logged_at_desc" | "calories_asc" | "calories_desc"
                )
            }),
            "invalid sort order",
        )
    }
}

impl ValidateRequest for NutritionTargetsRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            self.calorie_target.is_none_or(|value| value > 0)
                && self.protein_target_grams.is_none_or(|value| value > 0),
            "nutrition targets must be positive",
        )
    }
}

impl ValidateRequest for BodyMetricRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            text(&self.metric) && text(&self.unit),
            "metric and unit are required",
        )?;
        require(
            self.value.is_finite() && self.value > 0.0,
            "body metric value must be finite and positive",
        )?;
        let valid_unit = match self.metric.as_str() {
            "weight" => matches!(self.unit.as_str(), "kg" | "lbs" | "lb"),
            "height" => matches!(self.unit.as_str(), "cm" | "in" | "inch" | "inches"),
            _ => true,
        };
        require(valid_unit, "unit is invalid for this metric")
    }
}

impl ValidateRequest for ExerciseStatRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(text(&self.exercise_slug), "exerciseSlug is required")?;
        require(
            self.estimated_one_rep_max
                .is_none_or(|value| value.is_finite() && value >= 0.0)
                && self
                    .weight
                    .is_none_or(|value| value.is_finite() && value >= 0.0)
                && nonnegative(self.reps),
            "exercise measurements must be finite and nonnegative",
        )
    }
}

impl ValidateRequest for WorkoutPlanGenerateRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            (1..=7).contains(&self.available_days_per_week),
            "availableDaysPerWeek must be between 1 and 7",
        )?;
        require(
            (0..366).contains(&(self.end_date - self.start_date).num_days()),
            "workout plan must cover between 1 and 366 days",
        )?;
        require(
            self.program_selection.iter().all(|program| {
                text(&program.program_slug)
                    && program
                        .weight
                        .is_none_or(|value| value.is_finite() && value > 0.0)
            }),
            "program selections need a name and positive finite weight",
        )
    }
}

impl ValidateRequest for WorkoutSessionPatchRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            self.status.as_deref().is_none_or(|value| {
                matches!(value, "planned" | "started" | "skipped" | "cancelled")
            }),
            "invalid status; use finish to complete a session",
        )
    }
}

impl ValidateRequest for WorkoutSessionFinishRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            self.exercises.len() <= 100,
            "a session may contain at most 100 exercises",
        )?;
        for exercise in &self.exercises {
            require(text(&exercise.exercise_slug), "exerciseSlug is required")?;
            require(
                matches!(
                    exercise.status.as_str(),
                    "completed" | "partial" | "skipped" | "failed"
                ),
                "invalid exercise status",
            )?;
            require(
                nonnegative(exercise.sets_completed),
                "setsCompleted cannot be negative",
            )?;
        }
        Ok(())
    }
}

impl ValidateRequest for WorkoutSessionRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            text(&self.name) && self.duration_minutes >= 0,
            "workout needs a name and nonnegative duration",
        )
    }
}

impl ValidateRequest for HabitRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            text(&self.name) && text(&self.cadence),
            "habit name and cadence are required",
        )
    }
}

impl ValidateRequest for GoalRequest {
    fn validate(&self) -> Result<(), &'static str> {
        require(
            text(&self.title) && text(&self.target),
            "goal title and target are required",
        )
    }
}
