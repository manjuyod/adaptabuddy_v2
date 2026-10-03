package com.adaptabuddy.mobile.core.supabase

import com.adaptabuddy.mobile.core.config.AppConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient

object SupabaseClientProvider {
    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = AppConfig.supabaseUrl,
            supabaseKey = AppConfig.supabasePublishableKey,
        ) {
            install(Auth)
        }
    }
}
