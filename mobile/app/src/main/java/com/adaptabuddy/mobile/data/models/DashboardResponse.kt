package com.adaptabuddy.mobile.data.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DashboardResponse(
    val user: DashboardUser,
    val today: DashboardToday,
    val body: DashboardBody,
    val workout: DashboardWorkout,
    val habits: DashboardHabits,
)

@Serializable
data class DashboardUser(
    val id: String,
    @SerialName("display_name")
    val displayName: String? = null,
)

@Serializable
data class DashboardToday(
    @SerialName("calories_consumed")
    val caloriesConsumed: Int,
    @SerialName("protein_g")
    val proteinG: Int,
    @SerialName("carbs_g")
    val carbsG: Int,
    @SerialName("fat_g")
    val fatG: Int,
)

@Serializable
data class DashboardBody(
    @SerialName("latest_weight")
    val latestWeight: Double? = null,
    @SerialName("weight_unit")
    val weightUnit: String,
    @SerialName("last_updated")
    val lastUpdated: String? = null,
)

@Serializable
data class DashboardWorkout(
    @SerialName("next_workout_date")
    val nextWorkoutDate: String? = null,
    @SerialName("next_workout_name")
    val nextWorkoutName: String? = null,
    val recommendation: String,
)

@Serializable
data class DashboardHabits(
    @SerialName("food_logged_today")
    val foodLoggedToday: Boolean,
    @SerialName("workout_completed_today")
    val workoutCompletedToday: Boolean,
    @SerialName("stats_stale")
    val statsStale: Boolean,
)
