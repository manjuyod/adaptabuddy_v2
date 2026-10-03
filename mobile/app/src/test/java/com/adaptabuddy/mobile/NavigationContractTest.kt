package com.adaptabuddy.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationContractTest {
    @Test
    fun exposesMvpTopLevelDestinationsInOrder() {
        assertEquals(
            listOf("Home", "Habits", "Add", "Workout", "Food"),
            topLevelDestinationLabels,
        )
    }
}
