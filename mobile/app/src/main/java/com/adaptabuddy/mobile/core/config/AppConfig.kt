package com.adaptabuddy.mobile.core.config

import com.adaptabuddy.mobile.BuildConfig

object AppConfig {
    val supabaseUrl: String = BuildConfig.SUPABASE_URL
    val supabasePublishableKey: String = BuildConfig.SUPABASE_PUBLISHABLE_KEY
    val apiBaseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')

    fun supabaseKeyMissing(): Boolean = supabasePublishableKey.isBlank()
}
