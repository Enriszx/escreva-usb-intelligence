package com.auraaudio.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.auraaudio.app.core.Permissions
import com.auraaudio.app.data.AuraSettings
import com.auraaudio.app.designsystem.AuraTheme
import com.auraaudio.app.feature.about.AboutScreen
import com.auraaudio.app.feature.audio.AudioStudioScreen
import com.auraaudio.app.feature.battery.BatteryCenterScreen
import com.auraaudio.app.feature.connect.ConnectingScreen
import com.auraaudio.app.feature.connect.DevicePairingScreen
import com.auraaudio.app.feature.connect.DeviceSearchScreen
import com.auraaudio.app.feature.connection.ConnectionCenterScreen
import com.auraaudio.app.feature.controls.GameModeScreen
import com.auraaudio.app.feature.controls.TouchControlsScreen
import com.auraaudio.app.feature.diagnostics.DiagnosticsScreen
import com.auraaudio.app.feature.home.HomeScreen
import com.auraaudio.app.feature.matrix.FeatureMatrixScreen
import com.auraaudio.app.feature.mic.MicScreen
import com.auraaudio.app.feature.mytw982.MyTw982Screen
import com.auraaudio.app.feature.onboarding.PermissionsScreen
import com.auraaudio.app.feature.onboarding.SplashScreen
import com.auraaudio.app.feature.onboarding.WelcomeScreen
import com.auraaudio.app.feature.playback.PlaybackScreen
import com.auraaudio.app.feature.settings.SettingsScreen
import com.auraaudio.app.navigation.Routes
import com.auraaudio.app.service.AuraMonitorService

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as AuraApplication).container

        setContent {
            val settings by container.settings.settings.collectAsState(initial = AuraSettings())

            // Inicia o monitoramento Bluetooth assim que houver permissão
            LaunchedEffect(Unit) {
                if (Permissions.hasBluetooth(this@MainActivity)) container.tw982.start()
                if (settings.monitorServiceEnabled) AuraMonitorService.start(this@MainActivity)
            }
            LaunchedEffect(settings.eqEnabledOnLaunch) {
                if (settings.eqEnabledOnLaunch && container.eq.init()) container.eq.setEnabled(true)
            }

            // Atualiza mídia/estado ao voltar para o app
            val lifecycleOwner = LocalLifecycleOwner.current
            LaunchedEffect(lifecycleOwner) {
                val obs = LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_RESUME) {
                        if (Permissions.hasBluetooth(this@MainActivity)) {
                            container.tw982.start()
                            container.tw982.refresh()
                        }
                        container.media.refresh()
                    }
                }
                lifecycleOwner.lifecycle.addObserver(obs)
            }

            AuraTheme(mode = settings.themeMode) {
                val nav = rememberNavController()
                NavHost(navController = nav, startDestination = Routes.SPLASH) {
                    composable(Routes.SPLASH) { SplashScreen(nav, container) }
                    composable(Routes.WELCOME) { WelcomeScreen(nav) }
                    composable(Routes.PERMISSIONS) { PermissionsScreen(nav, container) }
                    composable(Routes.SEARCH) { DeviceSearchScreen(nav, container) }
                    composable(Routes.PAIRING) { DevicePairingScreen(nav) }
                    composable(Routes.CONNECTING) { ConnectingScreen(nav, container) }
                    composable(Routes.HOME) { HomeScreen(nav, container) }
                    composable(Routes.MY_TW982) { MyTw982Screen(nav, container) }
                    composable(Routes.BATTERY) { BatteryCenterScreen(nav, container) }
                    composable(Routes.AUDIO_STUDIO) { AudioStudioScreen(nav, container) }
                    composable(Routes.TOUCH_CONTROLS) { TouchControlsScreen(nav) }
                    composable(Routes.GAME_MODE) { GameModeScreen(nav) }
                    composable(Routes.PLAYBACK) { PlaybackScreen(nav, container) }
                    composable(Routes.CONNECTION_CENTER) { ConnectionCenterScreen(nav, container) }
                    composable(Routes.DIAGNOSTICS) { DiagnosticsScreen(nav, container) }
                    composable(Routes.MIC) { MicScreen(nav, container) }
                    composable(Routes.MATRIX) { FeatureMatrixScreen(nav) }
                    composable(Routes.SETTINGS) { SettingsScreen(nav, container) }
                    composable(Routes.ABOUT) { AboutScreen(nav) }
                }
            }
        }
    }
}
