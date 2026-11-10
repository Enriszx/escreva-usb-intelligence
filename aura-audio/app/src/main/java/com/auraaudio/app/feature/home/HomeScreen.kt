package com.auraaudio.app.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Equalizer
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.filled.Troubleshoot
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.animations.Tw982Scene
import com.auraaudio.app.bluetooth.ConnectionState
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.BatteryRing
import com.auraaudio.app.designsystem.LocalDarkTheme
import com.auraaudio.app.designsystem.NavRow
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.navigation.Routes

@Composable
fun HomeScreen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val dark = LocalDarkTheme.current
    val connected = state.connection == ConnectionState.CONNECTED

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp)
    ) {
        Spacer(Modifier.height(40.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("AURA AUDIO", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                Text("HAVIT TW982", style = MaterialTheme.typography.headlineMedium)
            }
            when {
                connected -> StatusChip("Conectado", AuraColors.Success)
                state.bonded -> StatusChip("Desconectado", AuraColors.Warning)
                !state.adapterEnabled -> StatusChip("Bluetooth off", AuraColors.Danger)
                else -> StatusChip("Não pareado", MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // Cena do produto
        Box(Modifier.fillMaxWidth().height(230.dp)) {
            Tw982Scene(openProgress = 1f, floating = connected, dark = dark, ledOn = connected)
        }

        // Bateria resumida
        AuraCard(onClick = { nav.navigate(Routes.BATTERY) }) {
            Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                BatteryRing("Fones", if (state.batteryLevel >= 0) state.batteryLevel else null, size = 86.dp)
                BatteryRing("Esquerdo", null, size = 86.dp)
                BatteryRing("Direito", null, size = 86.dp)
            }
            }
        Text(
            if (state.batteryLevel >= 0)
                "Nível combinado reportado pelo TW982 via telemetria do Android. Níveis individuais dependem do diagnóstico."
            else "Bateria ainda não reportada pelo dispositivo — conecte o TW982.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 6.dp, top = 6.dp)
        )

        SectionLabel("Dispositivo", Modifier.padding(top = 18.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.Headphones, "My TW982", "Ficha técnica e estado completo") { nav.navigate(Routes.MY_TW982) }
                NavRow(Icons.Filled.BatteryChargingFull, "Battery Center", "Monitoramento e alertas") { nav.navigate(Routes.BATTERY) }
                NavRow(Icons.Filled.Bluetooth, "Connection Center", "Perfis, UUIDs e reconexão") { nav.navigate(Routes.CONNECTION_CENTER) }
            }
        }

        SectionLabel("Som", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.Equalizer, "Audio Studio", "Equalizador, graves, presets") { nav.navigate(Routes.AUDIO_STUDIO) }
                NavRow(Icons.Filled.MusicNote, "Playback", "Controle de reprodução e volume") { nav.navigate(Routes.PLAYBACK) }
                NavRow(Icons.Filled.Mic, "Microfone e chamadas", "Teste de microfone via HFP") { nav.navigate(Routes.MIC) }
            }
        }

        SectionLabel("Controles", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.TouchApp, "Touch Controls", "Gestos oficiais do TW982") { nav.navigate(Routes.TOUCH_CONTROLS) }
                NavRow(Icons.Filled.SportsEsports, "Game Mode", "Baixa latência — guia de ativação") { nav.navigate(Routes.GAME_MODE) }
            }
        }

        SectionLabel("Sistema", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.Troubleshoot, "Diagnostics", "Inspeção BLE/GATT e relatório") { nav.navigate(Routes.DIAGNOSTICS) }
                NavRow(Icons.Filled.ViewList, "Matriz de recursos", "O que é real, o que é limite técnico") { nav.navigate(Routes.MATRIX) }
                NavRow(Icons.Filled.Settings, "Settings", "Tema, alertas, monitoramento") { nav.navigate(Routes.SETTINGS) }
                NavRow(Icons.Filled.Info, "About", "Versão e créditos") { nav.navigate(Routes.ABOUT) }
            }
        }
        Spacer(Modifier.height(26.dp))
    }
}
