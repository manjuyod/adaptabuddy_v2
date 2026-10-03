package com.adaptabuddy.mobile.auth

import androidx.lifecycle.ViewModelStore
import com.adaptabuddy.mobile.data.api.ApiClient
import com.adaptabuddy.mobile.data.api.ApiResult
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.annotations.SupabaseInternal
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.MemoryCodeVerifierCache
import io.github.jan.supabase.auth.MemorySessionManager
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.RefreshFailureCause
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.auth.user.UserSession
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.logging.LogLevel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException
import kotlin.time.Clock
import kotlin.time.Duration.Companion.seconds

@OptIn(ExperimentalCoroutinesApi::class, SupabaseInternal::class)
class AuthTokenRefreshTest {
    private val dispatcher = StandardTestDispatcher()
    private val store = ViewModelStore()
    private val sessions = MemorySessionManager()
    private lateinit var client: SupabaseClient
    private var refreshOffline = false
    private var refreshCancelled = false
    private var refreshRejectedStatus: HttpStatusCode? = null
    private var refreshRequests = 0

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        client = createSupabaseClient("https://auth.example.test", "public-test-key") {
            httpEngine = MockEngine.create {
                dispatcher = this@AuthTokenRefreshTest.dispatcher
                addHandler { request ->
                    assertEquals("/auth/v1/token", request.url.encodedPath)
                    assertEquals("refresh_token", request.url.parameters["grant_type"])
                    refreshRequests += 1
                    if (refreshCancelled) throw CancellationException("Screen left during refresh")
                    if (refreshOffline) throw IOException("Offline")
                    refreshRejectedStatus?.let { status ->
                        return@addHandler respond(
                            """{"error":"refresh_failed","error_description":"Refresh failed"}""",
                            status,
                            headersOf(HttpHeaders.ContentType, "application/json"),
                        )
                    }
                    respond(
                        """{"access_token":"refreshed-token","refresh_token":"rotated-refresh-token","expires_in":3600,"token_type":"bearer"}""",
                        HttpStatusCode.OK,
                        headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                }
            }
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
    fun expiredSessionRefreshesBeforeSendingDashboardRequest() = runTest(dispatcher) {
        val viewModel = signedInViewModel(expired = true)
        HttpClient(MockEngine { request ->
            assertEquals("Bearer refreshed-token", request.headers[HttpHeaders.Authorization])
            respond("dashboard")
        }).use { apiHttp ->
            val result = ApiClient(viewModel::currentAccessToken, "https://api.example.test", apiHttp)
                .get<String>("/api/v0/me/dashboard")

            assertEquals(ApiResult.Success("dashboard"), result)
            assertEquals(1, refreshRequests)
            assertEquals("rotated-refresh-token", sessions.loadSessionOrNull()?.refreshToken)
        }
    }

    @Test
    fun expiredSessionRefreshNetworkFailureRemainsRetryable() = runTest(dispatcher) {
        val viewModel = signedInViewModel(expired = true)
        refreshOffline = true
        HttpClient(MockEngine { respond("", HttpStatusCode.Unauthorized) }).use { apiHttp ->
            val result = ApiClient(viewModel::currentAccessToken, "https://api.example.test", apiHttp)
                .get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure)
            assertFalse((result as ApiResult.Failure).requiresLogin)
            assertNotNull(sessions.loadSessionOrNull())
        }
    }

    @Test
    fun sdkRefreshFailureDoesNotDiscardRecoverableSavedSession() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        client.auth.setSessionStatus(SessionStatus.RefreshFailure(RefreshFailureCause.NetworkError(IOException("Offline"))))
        HttpClient(MockEngine { error("No API request should run without a valid token") }).use { apiHttp ->
            val result = ApiClient(viewModel::currentAccessToken, "https://api.example.test", apiHttp)
                .get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure)
            assertFalse((result as ApiResult.Failure).requiresLogin)
            assertNotNull(sessions.loadSessionOrNull())
        }
    }

    @Test
    fun tokenProviderNetworkFailureIsReturnedAsRetryableFailure() = runTest(dispatcher) {
        HttpClient(MockEngine { error("Token acquisition failed before the API request") }).use { apiHttp ->
            val result = ApiClient({ throw IOException("Offline") }, "https://api.example.test", apiHttp)
                .get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure)
            assertFalse((result as ApiResult.Failure).requiresLogin)
        }
    }

    @Test
    fun firstUnauthorizedRetriesWithRefreshedToken() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        var requests = 0
        HttpClient(MockEngine { request ->
            requests += 1
            if (requests == 1) {
                assertEquals("Bearer original-token", request.headers[HttpHeaders.Authorization])
                respond("", HttpStatusCode.Unauthorized)
            } else {
                assertEquals("Bearer refreshed-token", request.headers[HttpHeaders.Authorization])
                respond("dashboard")
            }
        }).use { apiHttp ->
            val result = ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")

            assertEquals(ApiResult.Success("dashboard"), result)
            assertEquals(2, requests)
            assertEquals(1, refreshRequests)
        }
    }

    @Test
    fun repeatedUnauthorizedStopsAfterOneRetry() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        var requests = 0
        HttpClient(MockEngine {
            requests += 1
            respond("", HttpStatusCode.Unauthorized)
        }).use { apiHttp ->
            val result = ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure && result.requiresLogin)
            assertEquals(2, requests)
            assertEquals(1, refreshRequests)
        }
    }

    @Test
    fun unauthorizedRefreshNetworkFailurePreservesSavedSession() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        refreshOffline = true
        HttpClient(MockEngine { respond("", HttpStatusCode.Unauthorized) }).use { apiHttp ->
            val result = ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure)
            assertFalse((result as ApiResult.Failure).requiresLogin)
            assertEquals("original-refresh-token", sessions.loadSessionOrNull()?.refreshToken)
        }
    }

    @Test
    fun revokedRefreshRequiresLoginWithoutRetryingApi() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        refreshRejectedStatus = HttpStatusCode.BadRequest
        var requests = 0
        HttpClient(MockEngine {
            requests += 1
            respond("", HttpStatusCode.Unauthorized)
        }).use { apiHttp ->
            val result = ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure && result.requiresLogin)
            assertEquals(1, refreshRequests)
            assertEquals(1, requests)
        }
    }

    @Test(expected = CancellationException::class)
    fun refreshCancellationPropagates() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        refreshCancelled = true
        HttpClient(MockEngine { respond("", HttpStatusCode.Unauthorized) }).use { apiHttp ->
            ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")
        }
    }

    @Test
    fun refreshServerFailurePreservesSavedSession() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        refreshRejectedStatus = HttpStatusCode.ServiceUnavailable
        HttpClient(MockEngine { respond("", HttpStatusCode.Unauthorized) }).use { apiHttp ->
            val result = ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure)
            assertFalse((result as ApiResult.Failure).requiresLogin)
            assertEquals("original-refresh-token", sessions.loadSessionOrNull()?.refreshToken)
        }
    }

    @Test
    fun alreadyRefreshedTokenIsReusedWithoutAnotherRefresh() = runTest(dispatcher) {
        val viewModel = signedInViewModel()
        var requests = 0
        HttpClient(MockEngine { request ->
            requests += 1
            if (requests == 1) {
                client.auth.importSession(
                    client.auth.currentSessionOrNull()!!.copy(accessToken = "sdk-refreshed-token"),
                )
                respond("", HttpStatusCode.Unauthorized)
            } else {
                assertEquals("Bearer sdk-refreshed-token", request.headers[HttpHeaders.Authorization])
                respond("dashboard")
            }
        }).use { apiHttp ->
            val result = ApiClient(
                viewModel::currentAccessToken, "https://api.example.test", apiHttp, viewModel::refreshAccessToken,
            ).get<String>("/api/v0/me/dashboard")

            assertEquals(ApiResult.Success("dashboard"), result)
            assertEquals(2, requests)
            assertEquals(0, refreshRequests)
        }
    }

    private suspend fun signedInViewModel(expired: Boolean = false): AuthViewModel {
        client.auth.importSession(
            UserSession(
                accessToken = "original-token",
                refreshToken = "original-refresh-token",
                expiresIn = 3600,
                tokenType = "bearer",
                expiresAt = Clock.System.now() + (if (expired) -60 else 3600).seconds,
            ),
        )
        return AuthViewModel(client).also { store.put("auth", it) }
    }
}
