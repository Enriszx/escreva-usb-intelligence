package com.auraaudio.app.feature.battery

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import com.auraaudio.app.designsystem.Hairline
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
    val fmt = SimpleDateFormat("dd/MM 'às' HH:mm", Locale.getDefault())

    AuraScaffold(nav, "Battery Center") {
        Spacer(Modifier.height(14.dp))

        // Leitura principal — o valor que o TW982 realmente transmite
        AuraCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                BatteryRing("Fones", if (state.batteryLevel >= 0) state.batteryLevel else null, size = 148.dp)
                Spacer(Modifier.height(14.dp))
                Text(
                    if (state.batteryLevel >= 0)
                        "Atualizado ${fmt.format(Date(state.batteryUpdatedAt))} · ${state.batterySource}"
                    else "Aguardando o TW982 reportar o nível (acontece ao conectar)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionLabel("Leituras individuais", Modifier.padding(top = 18.dp))
        AuraCard {
            Column {
                BatteryDetailRow("Fone esquerdo", "O firmware transmite um único nível combinado")
                Hairline()
                BatteryDetailRow("Fone direito", "O firmware transmite um único nível combinado")
                Hairline()
                BatteryDetailRow("Estojo (400 mAh)", "Não transmitido ao telefone — o LED físico é o indicador oficial")
                Spacer(Modifier.height(10.dp))
                Text(
                    "Verificado por diagnóstico neste exemplar: o TW982 opera em Bluetooth Classic puro, sem servidor " +
                        "GATT acessível — não há canal público para níveis separados. O AURA AUDIO mostra apenas o real.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionLabel("Alertas", Modifier.padding(top = 18.dp))
        AuraCard {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Alerta de bateria baixa", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Notificação ao atingir ${settings.batteryAlertThreshold}%",
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
                    "Exige o monitoramento em segundo plano (Settings).",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(Modifier.height(14.dp))
        Button(onClick = { container.tw982.readBattery() }, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text("Atualizar leitura agora")
        }
        Spacer(Modifier.height(26.dp))
    }
}

@Composable
private fun BatteryDetailRow(title: String, reason: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(reason, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(12.dp))
        Text("—", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
