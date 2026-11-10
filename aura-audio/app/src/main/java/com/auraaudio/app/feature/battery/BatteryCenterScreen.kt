package com.auraaudio.app.feature.battery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.data.AuraSettings
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.BatteryRing
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.feature.common.AuraScaffold
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun BatteryCenterScreen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val settings by container.settings.settings.collectAsState(initial = AuraSettings())
    val scope = rememberCoroutineScope()
    val fmt = SimpleDateFormat("dd/MM HH:mm:ss", Locale.getDefault())

    AuraScaffold(nav, "Battery Center") {
        Spacer(Modifier.height(10.dp))
        AuraCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                    BatteryRing("Esquerdo", null)
                    BatteryRing("Fones", if (state.batteryLevel >= 0) state.batteryLevel else null, size = 112.dp)
                    BatteryRing("Direito", null)
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                    BatteryRing("Estojo", null, size = 76.dp)
                }
            }
        }

        AuraCard(modifier = Modifier.padding(top = 12.dp)) {
            Column {
                Text("O que é real aqui", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(6.dp))
                Text(
                    buildString {
                        if (state.batteryLevel >= 0) {
                            append("• FONES: ${state.batteryLevel}% — valor reportado pelo próprio TW982 via ")
                            append(state.batterySource ?: "telemetria")
                            append(", atualizado em ${fmt.format(Date(state.batteryUpdatedAt))}.\n\n")
                        } else {
                            append("• FONES: ainda não reportado. O TW982 envia o nível pelo perfil HFP quando conectado.\n\n")
                        }
                        append("• ESQUERDO/DIREITO: o TW982 reporta ao Android um único nível (normalmente o menor dos dois fones). ")
                        append("Níveis individuais só existiriam via protocolo proprietário — rode o Diagnostics para verificar no seu exemplar.\n\n")
                        append("• ESTOJO: o firmware do TW982 não transmite a carga do estojo ao telefone por nenhum protocolo conhecido. ")
                        append("O AURA AUDIO não inventa estimativas — o LED físico do estojo é o indicador oficial.")
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionLabel("Alertas", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Alerta de bateria baixa", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Notificação quando os fones atingirem ${settings.batteryAlertThreshold}%",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(checked = settings.batteryAlertEnabled, onCheckedChange = {
                        scope.launch { container.settings.setBatteryAlert(it) }
                    })
                }
                Slider(
                    value = settings.batteryAlertThreshold.toFloat(),
                    onValueChange = { scope.launch { container.settings.setBatteryThreshold(it.toInt()) } },
                    valueRange = 5f..50f,
                    steps = 8,
                    enabled = settings.batteryAlertEnabled
                )
                Text(
                    "Os alertas exigem o monitoramento ativo (Settings → Monitorar em segundo plano).",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Button(onClick = { container.tw982.readBattery() }, modifier = Modifier.fillMaxWidth().height(50.dp)) {
            Text("Atualizar leitura agora")
        }
        Spacer(Modifier.height(24.dp))
    }
}
