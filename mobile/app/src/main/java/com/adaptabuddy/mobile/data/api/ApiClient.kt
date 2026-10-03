package com.adaptabuddy.mobile.data.api

import com.adaptabuddy.mobile.core.config.AppConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.accept
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Failure(val message: String, val requiresLogin: Boolean = false) : ApiResult<Nothing>
}

class ApiClient(
    @PublishedApi internal val accessTokenProvider: suspend () -> String?,
    @PublishedApi internal val baseUrl: String = AppConfig.apiBaseUrl,
    @PublishedApi internal val httpClient: HttpClient = defaultHttpClient,
    @PublishedApi internal val refreshAccessTokenProvider: suspend (String) -> String? = { null },
) {
    suspend inline fun <reified T> get(path: String): ApiResult<T> {
        return try {
            val token = accessTokenProvider()
                ?: return ApiResult.Failure("Please sign in again.", requiresLogin = true)
            var response = httpClient.get("$baseUrl${path.ensureLeadingSlash()}") {
                accept(ContentType.Application.Json)
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                bearerAuth(token)
            }

            if (response.status == HttpStatusCode.Unauthorized) {
                val refreshedToken = refreshAccessTokenProvider(token)
                    ?: return ApiResult.Failure("Please sign in again.", requiresLogin = true)
                response = httpClient.get("$baseUrl${path.ensureLeadingSlash()}") {
                    accept(ContentType.Application.Json)
                    header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                    bearerAuth(refreshedToken)
                }
            }

            when {
                response.status == HttpStatusCode.Unauthorized -> {
                    ApiResult.Failure("Please sign in again.", requiresLogin = true)
                }

                response.status.value !in 200..299 -> {
                    val body = response.bodyAsText().takeIf { it.isNotBlank() }
                    ApiResult.Failure(body ?: "Backend request failed.")
                }

                else -> ApiResult.Success(response.body())
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: SerializationException) {
            ApiResult.Failure("The dashboard response was not readable.")
        } catch (_: Exception) {
            ApiResult.Failure("Could not reach the backend.")
        }
    }

    companion object {
        private val defaultHttpClient = HttpClient(Android) {
            expectSuccess = false
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                    },
                )
            }
        }
    }
}

fun String.ensureLeadingSlash(): String = if (startsWith("/")) this else "/$this"
