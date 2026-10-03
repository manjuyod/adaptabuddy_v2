package com.adaptabuddy.mobile.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.adaptabuddy.mobile.core.config.AppConfig
import com.adaptabuddy.mobile.core.supabase.SupabaseClientProvider
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.user.UserSession
import io.github.jan.supabase.exceptions.RestException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import kotlin.time.Clock

data class AuthUiState(
    val loading: Boolean = true,
    val isLoggedIn: Boolean = false,
    val error: String? = null,
)

class AuthViewModel(
    private val supabaseClient: SupabaseClient = SupabaseClientProvider.client,
) : ViewModel() {
    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    private val refreshMutex = Mutex()

    init {
        checkSession()
    }

    fun checkSession() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            runCatching {
                supabaseClient.auth.awaitInitialization()
                supabaseClient.auth.sessionStatus.collect { status ->
                    _uiState.update { current ->
                        when (status) {
                            SessionStatus.Initializing -> current.copy(loading = true)
                            is SessionStatus.Authenticated -> AuthUiState(
                                loading = false,
                                isLoggedIn = true,
                            )
                            is SessionStatus.NotAuthenticated -> current.copy(
                                loading = false,
                                isLoggedIn = false,
                            )
                            is SessionStatus.RefreshFailure -> AuthUiState(
                                loading = false,
                                error = "Could not refresh your session. Check your connection.",
                            )
                        }
                    }
                }
            }.onFailure { error ->
                if (error is CancellationException) throw error
                _uiState.value = AuthUiState(
                    loading = false,
                    isLoggedIn = false,
                    error = error.friendlyAuthMessage(),
                )
            }
        }
    }

    fun signIn(email: String, password: String) {
        if (AppConfig.supabaseKeyMissing()) {
            _uiState.value = AuthUiState(
                loading = false,
                isLoggedIn = false,
                error = "Set SUPABASE_PUBLISHABLE_KEY in mobile/local.properties.",
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState(loading = true)
            runCatching {
                supabaseClient.auth.signInWith(Email) {
                    this.email = email.trim()
                    this.password = password
                }
            }.onSuccess {
                _uiState.value = AuthUiState(
                    loading = false,
                    isLoggedIn = supabaseClient.auth.currentSessionOrNull() != null,
                )
            }.onFailure { error ->
                if (error is CancellationException) throw error
                _uiState.value = AuthUiState(
                    loading = false,
                    isLoggedIn = false,
                    error = error.friendlyAuthMessage(),
                )
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            runCatching {
                supabaseClient.auth.signOut()
            }.onFailure { error ->
                if (error is CancellationException) throw error
                // Remote logout can fail offline; credentials must still leave this device.
                supabaseClient.auth.clearSession()
            }
            _uiState.value = AuthUiState(
                loading = false,
                isLoggedIn = false,
            )
        }
    }

    suspend fun currentAccessToken(): String? {
        supabaseClient.auth.awaitInitialization()
        val session = sessionForRequest() ?: return null
        return if (session.expiresAt <= Clock.System.now()) {
            refreshAccessToken(session.accessToken)
        } else {
            session.accessToken
        }
    }

    suspend fun refreshAccessToken(rejectedToken: String): String? = refreshMutex.withLock {
        supabaseClient.auth.awaitInitialization()
        val session = sessionForRequest() ?: return@withLock null
        // An SDK refresh or another request may already have replaced the rejected token.
        if (session.accessToken != rejectedToken && session.expiresAt > Clock.System.now()) {
            return@withLock session.accessToken
        }
        try {
            supabaseClient.auth.refreshCurrentSession()
        } catch (error: RestException) {
            if (error.statusCode in listOf(400, 401, 403)) return@withLock null
            throw error
        }
        sessionForRequest()?.accessToken
    }

    private fun sessionForRequest(): UserSession? {
        if (supabaseClient.auth.sessionStatus.value is SessionStatus.RefreshFailure) {
            // The SDK still owns a saved refresh token and will retry after connectivity returns.
            throw IOException("Session refresh is temporarily unavailable.")
        }
        return supabaseClient.auth.currentSessionOrNull()
    }

    fun requireLogin(message: String = "Please sign in again.") {
        viewModelScope.launch {
            supabaseClient.auth.clearSession()
            _uiState.value = AuthUiState(
                loading = false,
                isLoggedIn = false,
                error = message,
            )
        }
    }
}

private fun Throwable.friendlyAuthMessage(): String =
    message?.takeIf { it.isNotBlank() } ?: "Sign-in failed. Check your email and password."
