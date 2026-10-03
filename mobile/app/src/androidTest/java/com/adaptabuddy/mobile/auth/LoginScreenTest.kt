package com.adaptabuddy.mobile.auth

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LoginScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun selectingEmailFocusesEmailField() {
        composeRule.setContent {
            MaterialTheme {
                LoginScreen(
                    state = AuthUiState(loading = false),
                    onSignIn = { _, _ -> },
                )
            }
        }

        composeRule.onNodeWithText("Email").performClick()

        composeRule.onNodeWithText("Email").assertIsFocused()
    }

    @Test
    fun showsBrandMarkAndSubmitsEnteredCredentials() {
        var submittedCredentials: Pair<String, String>? = null

        composeRule.setContent {
            MaterialTheme {
                LoginScreen(
                    state = AuthUiState(loading = false),
                    onSignIn = { email, password ->
                        submittedCredentials = email to password
                    },
                )
            }
        }

        composeRule
            .onNodeWithContentDescription("AdaptaBuddy brand mark")
            .assertExists()
        composeRule.onNodeWithText("Email").performTextInput("user@example.com")
        composeRule.onNodeWithText("Password").performTextInput("correct horse")
        composeRule.onNodeWithText("Sign in").performClick()

        assertEquals("user@example.com" to "correct horse", submittedCredentials)
    }
}
