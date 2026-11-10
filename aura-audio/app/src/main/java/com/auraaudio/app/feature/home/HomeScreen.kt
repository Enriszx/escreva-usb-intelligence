package com.auraaudio.app.feature.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.animations.Tw982Scene
import com.auraaudio.app.bluetooth.ConnectionState
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.Hairline
import com.auraaudio.app.designsystem.LocalDarkTheme
import com.auraaudio.app.designsystem.NavRow
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.navigation.Routes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HomeScreen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val dark = LocalDarkTheme.current
    val connected = state.connection == ConnectionState.CONNECTED
    val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
    ) {
        Spacer(Modifier.height(52.dp))

        // Cabeçalho editorial
        Text(
            "AURA AUDIO",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("TW982", style = MaterialTheme.typography.displaySmall)
                Text(
                    "HAVIT · LIFE 01T",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            when {
                connected -> StatusChip("Conectado", AuraColors.Success)
                state.bonded -> StatusChip("Desconectado", AuraColors.Warning)
                !state.adapterEnabled -> StatusChip("Bluetooth desligado", AuraColors.Danger)
                else -> StatusChip("Não pareado", MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // Cena do produto
        Box(Modifier.fillMaxWidth().height(265.dp)) {
            Tw982Scene(openProgress = 1f, floating = connected, dark = dark, ledOn = connected)
        }

        // Bateria — valor único real (confirmado por diagnóstico: o TW982 reporta um nível combinado)
        AuraCard(onClick = { nav.navigate(Routes.BATTERY) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "BATERIA DOS FONES",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.Bottom) {
                        Text(
                            if (state.batteryLevel >= 0) "${state.batteryLevel}" else "—",
                            style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.W800, fontSize = 44.sp)
                        )
                        if (state.batteryLevel >= 0) Text(
                            "%",
                            style = MaterialTheme.typography.headlineSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 2.dp, bottom = 5.dp)
                        )
                    }
                    Text(
                        if (state.batteryLevel >= 0)
                            "Reportado pelo fone às ${fmt.format(Date(state.batteryUpdatedAt))} · via HFP"
                        else "Conecte o TW982 para receber o nível",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.width(12.dp))
                com.auraaudio.app.designsystem.BatteryRing(
                    "", if (state.batteryLevel >= 0) state.batteryLevel else null, size = 84.dp
                )
            }
        }

        SectionLabel("Dispositivo", Modifier.padding(top = 22.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.Headphones, "My TW982", "Ficha técnica e estado completo") { nav.navigate(Routes.MY_TW982) }
                Hairline()
                NavRow(Icons.Filled.BatteryChargingFull, "Battery Center", "Monitoramento e alertas") { nav.navigate(Routes.BATTERY) }
                Hairline()
                NavRow(Icons.Filled.Bluetooth, "Connection Center", "Perfis, serviços e reconexão") { nav.navigate(Routes.CONNECTION_CENTER) }
            }
        }

        SectionLabel("Som", Modifier.padding(top = 16.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.Equalizer, "Audio Studio", "Equalizador, graves e presets") { nav.navigate(Routes.AUDIO_STUDIO) }
                Hairline()
                NavRow(Icons.Filled.MusicNote, "Playback", "Reprodução e volume") { nav.navigate(Routes.PLAYBACK) }
                Hairline()
                NavRow(Icons.Filled.Mic, "Microfone e chamadas", "Teste de microfone via HFP") { nav.navigate(Routes.MIC) }
            }
        }

        SectionLabel("Controles", Modifier.padding(top = 16.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.TouchApp, "Touch Controls", "Gestos oficiais do TW982") { nav.navigate(Routes.TOUCH_CONTROLS) }
                Hairline()
                NavRow(Icons.Filled.SportsEsports, "Game Mode", "Baixa latência — guia de ativação") { nav.navigate(Routes.GAME_MODE) }
            }
        }

        SectionLabel("Sistema", Modifier.padding(top = 16.dp))
        AuraCard {
            Column {
                NavRow(Icons.Filled.Troubleshoot, "Diagnostics", "Inspeção técnica e relatório") { nav.navigate(Routes.DIAGNOSTICS) }
                Hairline()
                NavRow(Icons.Filled.ViewList, "Matriz de recursos", "O que é real, com evidências") { nav.navigate(Routes.MATRIX) }
                Hairline()
                NavRow(Icons.Filled.Settings, "Settings", "Tema, alertas e monitoramento") { nav.navigate(Routes.SETTINGS) }
                Hairline()
                NavRow(Icons.Filled.Info, "About", "Versão e princípios") { nav.navigate(Routes.ABOUT) }
            }
        }
        Spacer(Modifier.height(30.dp))
    }
}
