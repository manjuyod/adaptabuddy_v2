package com.adaptabuddy.mobile.auth

import androidx.lifecycle.ViewModelStore
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.annotations.SupabaseInternal
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.MemoryCodeVerifierCache
import io.github.jan.supabase.auth.MemorySessionManager
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.user.UserSession
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.logging.LogLevel
import io.ktor.client.engine.mock.MockEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class, SupabaseInternal::class)
class AuthViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val store = ViewModelStore()
    private val sessions = MemorySessionManager()
    private lateinit var client: SupabaseClient

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        client = createSupabaseClient("https://auth.example.test", "public-test-key") {
            httpEngine = MockEngine { throw IOException("Offline") }
            coroutineDispatcher = dispatcher
            defaultLogLevel = LogLevel.NONE
            install(Auth) {
                autoLoadFromStorage = false
                alwaysAutoRefresh = false
                autoSetupPlatform = false
                sessionManager = sessions
                codeVerifierCache = MemoryCodeVerifierCache()
            }
        }
    }

    @After
    fun tearDown() = runTest(dispatcher) {
        store.clear()
        client.close()
        Dispatchers.resetMain()
    }

    @Test
    fun offlineSignOutClearsCurrentAndPersistedSession() = runTest(dispatcher) {
        val viewModel = signedInViewModel()

        viewModel.signOut()
        viewModel.uiState.first { !it.loading && !it.isLoggedIn }

        assertFalse(viewModel.uiState.value.isLoggedIn)
        assertNull(viewModel.currentAccessToken())
        assertNull(sessions.loadSessionOrNull())
    }

    @Test
    fun rejectedApiSessionCannotBeRestoredAfterRequiringLogin() = runTest(dispatcher) {
        val viewModel = signedInViewModel()

        viewModel.requireLogin()
        advanceUntilIdle()

        assertFalse(viewModel.uiState.value.isLoggedIn)
        assertNull(viewModel.currentAccessToken())
        assertNull(sessions.loadSessionOrNull())
    }

    @Test
    fun sdkSessionRemovalLeavesAuthenticatedUi() = runTest(dispatcher) {
        val viewModel = signedInViewModel()

        client.auth.clearSession()
        advanceUntilIdle()

        assertFalse(viewModel.uiState.value.isLoggedIn)
        assertFalse(viewModel.uiState.value.loading)
    }

    private suspend fun signedInViewModel(): AuthViewModel {
        client.auth.importSession(
            UserSession(
                accessToken = "test-access-token",
                refreshToken = "test-refresh-token",
                expiresIn = 3600,
                tokenType = "bearer",
            ),
        )
        val viewModel = AuthViewModel(client)
        store.put("auth", viewModel)
        dispatcher.scheduler.advanceUntilIdle()
        assertTrue(viewModel.uiState.value.isLoggedIn)
        return viewModel
    }
}
