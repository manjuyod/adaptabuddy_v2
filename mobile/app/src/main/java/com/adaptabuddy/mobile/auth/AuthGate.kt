package com.adaptabuddy.mobile.auth

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

@Composable
fun AuthGate(
    state: AuthUiState,
    onSignIn: (email: String, password: String) -> Unit,
    loggedInContent: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    when {
        state.loading -> {
            AuthBackground(modifier = modifier) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }
        }

        state.isLoggedIn -> loggedInContent()

        else -> LoginScreen(
            state = state,
            onSignIn = onSignIn,
            modifier = modifier,
        )
    }
}
