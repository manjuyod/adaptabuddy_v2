package com.adaptabuddy.mobile

import com.adaptabuddy.mobile.data.models.DashboardResponse
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DashboardResponseTest {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    @Test
    fun decodesMobileDashboardResponse() {
        val decoded = json.decodeFromString<DashboardResponse>(
            """
            {
              "user": {
                "id": "00000000-0000-0000-0000-000000000001",
                "display_name": null
              },
              "today": {
                "calories_consumed": 0,
                "protein_g": 0,
                "carbs_g": 0,
                "fat_g": 0
              },
              "body": {
                "latest_weight": null,
                "weight_unit": "lb",
                "last_updated": null
              },
              "workout": {
                "next_workout_date": null,
                "next_workout_name": null,
                "recommendation": "No workout generated yet"
              },
              "habits": {
                "food_logged_today": false,
                "workout_completed_today": false,
                "stats_stale": true
              }
            }
            """.trimIndent(),
        )

        assertEquals("00000000-0000-0000-0000-000000000001", decoded.user.id)
        assertNull(decoded.user.displayName)
        assertEquals(0, decoded.today.caloriesConsumed)
        assertEquals(0, decoded.today.proteinG)
        assertEquals("lb", decoded.body.weightUnit)
        assertNull(decoded.body.latestWeight)
        assertEquals("No workout generated yet", decoded.workout.recommendation)
        assertEquals(false, decoded.habits.foodLoggedToday)
        assertEquals(true, decoded.habits.statsStale)
    }
}
