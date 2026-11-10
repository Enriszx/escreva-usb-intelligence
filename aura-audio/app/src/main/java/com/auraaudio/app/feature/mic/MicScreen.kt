package com.auraaudio.app.feature.mic

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.core.Permissions
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.InfoRow
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.feature.common.AuraScaffold
import com.auraaudio.app.mic.MicTestEngine

@Composable
fun MicScreen(nav: NavController, container: AppContainer) {
    val mic by container.mic.state.collectAsState()
    val bt by container.tw982.state.collectAsState()
    val context = LocalContext.current
    var permissionRefresh by remember { mutableStateOf(0) }
    val hasMicPermission = remember(permissionRefresh) { Permissions.hasRecordAudio(context) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permissionRefresh++ }

    AuraScaffold(nav, "Microfone e chamadas") {
        Spacer(Modifier.height(6.dp))
        AuraCard {
            Column {
                Text("Teste real do microfone", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Grava 5 segundos pela rota de voz Bluetooth (HFP/SCO) do TW982 e reproduz em seguida. " +
                        "O TW982 usa ENC (redução de ruído para chamadas) fixa no firmware — diferente de ANC, " +
                        "que este modelo não possui. A rota de entrada usada de verdade é exibida abaixo.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(12.dp))
                StatusChip(
                    if (bt.hfpConnected) "Perfil HFP conectado" else "HFP desconectado",
                    if (bt.hfpConnected) AuraColors.Success else AuraColors.Warning
                )
            }
        }

        SectionLabel("Executar teste", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                if (!hasMicPermission) {
                    Text("Permissão de microfone necessária para o teste.", style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = { launcher.launch(Manifest.permission.RECORD_AUDIO) }) { Text("Conceder microfone") }
                } else {
                    Text(mic.message, style = MaterialTheme.typography.bodyMedium)
                    if (mic.phase == MicTestEngine.Phase.RECORDING) {
                        Spacer(Modifier.height(10.dp))
                        LinearProgressIndicator(
                            progress = { mic.levelPercent / 100f },
                            modifier = Modifier.fillMaxWidth().height(8.dp)
                        )
                        Text(
                            "Nível de entrada: ${mic.levelPercent}% — fale no fone agora",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                    mic.inputDevice?.let {
                        Spacer(Modifier.height(8.dp))
                        InfoRow("Entrada usada", it)
                    }
                    Spacer(Modifier.height(12.dp))
                    Row {
                        Button(
                            onClick = { container.mic.record(5) },
                            enabled = mic.phase != MicTestEngine.Phase.RECORDING && mic.phase != MicTestEngine.Phase.ROUTING,
                            modifier = Modifier.weight(1f)
                        ) { Text("Gravar 5 s") }
                        Spacer(Modifier.width(10.dp))
                        OutlinedButton(
                            onClick = { container.mic.play() },
                            enabled = mic.sampleFile != null && mic.phase != MicTestEngine.Phase.RECORDING,
                            modifier = Modifier.weight(1f)
                        ) { Text("Reproduzir") }
                    }
                }
            }
        }

        SectionLabel("Rotas de áudio atuais", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                Text("Entradas", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                container.mic.inputDevices().forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 2.dp)) }
                Spacer(Modifier.height(10.dp))
                Text("Saídas", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                container.mic.outputDevices().forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 2.dp)) }
            }
        }

        SectionLabel("Chamadas", Modifier.padding(top = 14.dp))
        AuraCard {
            Text(
                "Durante chamadas, o Android roteia a voz pelo HFP do TW982 automaticamente. " +
                    "Atender/finalizar: toque duplo em qualquer fone · Rejeitar: pressionar ~1 s. " +
                    "O controle de chamadas de terceiros pelo app é restrito pelo Android por privacidade — " +
                    "os gestos do fone e a tela de chamada do sistema são os caminhos oficiais.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}
