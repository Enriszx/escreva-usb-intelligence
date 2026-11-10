package com.auraaudio.app.feature.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.data.AuraSettings
import com.auraaudio.app.data.ThemeMode
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.feature.common.AuraScaffold
import com.auraaudio.app.service.AuraMonitorService
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(nav: NavController, container: AppContainer) {
    val settings by container.settings.settings.collectAsState(initial = AuraSettings())
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    AuraScaffold(nav, "Settings") {
        SectionLabel("Aparência", Modifier.padding(top = 8.dp))
        AuraCard {
            Column {
                Text("Tema", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(10.dp))
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    ThemeMode.entries.forEachIndexed { i, mode ->
                        SegmentedButton(
                            selected = settings.themeMode == mode,
                            onClick = { scope.launch { container.settings.setTheme(mode) } },
                            shape = SegmentedButtonDefaults.itemShape(i, ThemeMode.entries.size)
                        ) {
                            Text(when (mode) {
                                ThemeMode.SYSTEM -> "Sistema"
                                ThemeMode.LIGHT -> "Claro"
                                ThemeMode.DARK -> "Escuro"
                            })
                        }
                    }
                }
            }
        }

        SectionLabel("Monitoramento", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                SettingSwitch(
                    "Monitorar em segundo plano",
                    "Serviço leve que grava o histórico e permite alertas mesmo com o app fechado",
                    settings.monitorServiceEnabled
                ) { on ->
                    scope.launch { container.settings.setMonitorService(on) }
                    if (on) AuraMonitorService.start(context) else AuraMonitorService.stop(context)
                }
                SettingSwitch(
                    "Notificar conexão/desconexão",
                    "Aviso quando o TW982 conectar ou desconectar",
                    settings.connectionNotifications
                ) { scope.launch { container.settings.setConnectionNotifications(it) } }
                SettingSwitch(
                    "Alerta de bateria baixa",
                    "Limite atual: ${settings.batteryAlertThreshold}% (ajuste no Battery Center)",
                    settings.batteryAlertEnabled
                ) { scope.launch { container.settings.setBatteryAlert(it) } }
            }
        }

        SectionLabel("Áudio", Modifier.padding(top = 14.dp))
        AuraCard {
            SettingSwitch(
                "Ativar equalização ao iniciar",
                "Restaura o último estado do Audio Studio na abertura do app",
                settings.eqEnabledOnLaunch
            ) { scope.launch { container.settings.setEqOnLaunch(it) } }
        }

        SectionLabel("Dados", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                androidx.compose.material3.TextButton(onClick = { scope.launch { container.db.dao().clearEvents() } }) {
                    Text("Limpar histórico de conexões")
                }
                Text(
                    "Remove os eventos registrados neste aparelho. Os dados nunca saem do telefone.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun SettingSwitch(title: String, desc: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
