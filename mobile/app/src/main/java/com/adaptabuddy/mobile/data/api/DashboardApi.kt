package com.adaptabuddy.mobile.data.api

import com.adaptabuddy.mobile.data.models.DashboardResponse

class DashboardApi(
    private val apiClient: ApiClient,
) {
    suspend fun dashboard(): ApiResult<DashboardResponse> =
        apiClient.get("/api/v0/me/dashboard")
}
