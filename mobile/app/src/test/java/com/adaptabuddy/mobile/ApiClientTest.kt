package com.adaptabuddy.mobile

import com.adaptabuddy.mobile.data.api.ApiClient
import com.adaptabuddy.mobile.data.api.ApiResult
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiClientTest {
    @Test(expected = CancellationException::class)
    fun requestCancellationIsPropagated() = runTest {
        HttpClient(MockEngine { throw CancellationException("Screen left") }).use { client ->
            ApiClient({ "access-token" }, "https://api.example.test", client)
                .get<String>("/api/v0/me/dashboard")
        }
    }

    @Test
    fun missingTokenDoesNotSendAnAuthenticatedRequest() = runTest {
        HttpClient(MockEngine { error("A signed-out user must not call the API") }).use { client ->
            val result = ApiClient({ null }, "https://api.example.test", client)
                .get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure && result.requiresLogin)
        }
    }

    @Test
    fun unauthorizedResponseRequiresLogin() = runTest {
        HttpClient(MockEngine { respond("", HttpStatusCode.Unauthorized) }).use { client ->
            val result = ApiClient({ "expired-token" }, "https://api.example.test", client)
                .get<String>("/api/v0/me/dashboard")

            assertTrue(result is ApiResult.Failure && result.requiresLogin)
        }
    }
}
