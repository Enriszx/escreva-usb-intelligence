package com.auraaudio.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "aura_settings")

enum class ThemeMode { SYSTEM, LIGHT, DARK }

data class AuraSettings(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val batteryAlertEnabled: Boolean = true,
    val batteryAlertThreshold: Int = 20,
    val connectionNotifications: Boolean = true,
    val monitorServiceEnabled: Boolean = false,
    val onboardingDone: Boolean = false,
    val eqEnabledOnLaunch: Boolean = false,
    /** Perfis de EQ salvos: "nome§mb,mb,..§bass§virt§loud" separados por ‖ */
    val customEqProfiles: String = ""
)

class SettingsStore(private val context: Context) {
    private object K {
        val THEME = stringPreferencesKey("theme_mode")
        val BAT_ALERT = booleanPreferencesKey("battery_alert_enabled")
        val BAT_THRESHOLD = intPreferencesKey("battery_alert_threshold")
        val CONN_NOTIF = booleanPreferencesKey("connection_notifications")
        val MONITOR = booleanPreferencesKey("monitor_service")
        val ONBOARDING = booleanPreferencesKey("onboarding_done")
        val EQ_ON_LAUNCH = booleanPreferencesKey("eq_on_launch")
        val EQ_PROFILES = stringPreferencesKey("eq_profiles")
    }

    val settings: Flow<AuraSettings> = context.dataStore.data.map { p ->
        AuraSettings(
            themeMode = runCatching { ThemeMode.valueOf(p[K.THEME] ?: "SYSTEM") }.getOrDefault(ThemeMode.SYSTEM),
            batteryAlertEnabled = p[K.BAT_ALERT] ?: true,
            batteryAlertThreshold = p[K.BAT_THRESHOLD] ?: 20,
            connectionNotifications = p[K.CONN_NOTIF] ?: true,
            monitorServiceEnabled = p[K.MONITOR] ?: false,
            onboardingDone = p[K.ONBOARDING] ?: false,
            eqEnabledOnLaunch = p[K.EQ_ON_LAUNCH] ?: false,
            customEqProfiles = p[K.EQ_PROFILES] ?: ""
        )
    }

    suspend fun setTheme(mode: ThemeMode) = context.dataStore.edit { it[K.THEME] = mode.name }
    suspend fun setBatteryAlert(enabled: Boolean) = context.dataStore.edit { it[K.BAT_ALERT] = enabled }
    suspend fun setBatteryThreshold(value: Int) = context.dataStore.edit { it[K.BAT_THRESHOLD] = value }
    suspend fun setConnectionNotifications(enabled: Boolean) = context.dataStore.edit { it[K.CONN_NOTIF] = enabled }
    suspend fun setMonitorService(enabled: Boolean) = context.dataStore.edit { it[K.MONITOR] = enabled }
    suspend fun setOnboardingDone() = context.dataStore.edit { it[K.ONBOARDING] = true }
    suspend fun setEqOnLaunch(enabled: Boolean) = context.dataStore.edit { it[K.EQ_ON_LAUNCH] = enabled }
    suspend fun setEqProfiles(serialized: String) = context.dataStore.edit { it[K.EQ_PROFILES] = serialized }
}

/** Serialização simples dos perfis personalizados de EQ. */
object EqProfileCodec {
    data class Profile(val name: String, val levelsMb: List<Int>, val bass: Int, val virt: Int, val loud: Int)

    fun encode(list: List<Profile>): String = list.joinToString("‖") { p ->
        "${p.name.replace("‖", " ").replace("§", " ")}§${p.levelsMb.joinToString(",")}§${p.bass}§${p.virt}§${p.loud}"
    }

    fun decode(s: String): List<Profile> = s.split("‖").mapNotNull { part ->
        val f = part.split("§")
        if (f.size != 5) return@mapNotNull null
        runCatching {
            Profile(
                name = f[0],
                levelsMb = if (f[1].isBlank()) emptyList() else f[1].split(",").map { it.toInt() },
                bass = f[2].toInt(), virt = f[3].toInt(), loud = f[4].toInt()
            )
        }.getOrNull()
    }
}
