package com.auraaudio.app.feature.connection

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
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
import com.auraaudio.app.bluetooth.ConnectionState
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.InfoRow
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.feature.common.AuraScaffold
import com.auraaudio.app.feature.mytw982.friendlyUuid
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ConnectionCenterScreen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val events by container.db.dao().events().collectAsState(initial = emptyList())
    val context = LocalContext.current
    var reconnectResult by remember { mutableStateOf<String?>(null) }
    val fmt = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())

    AuraScaffold(nav, "Connection Center") {
        Spacer(Modifier.height(8.dp))
        Row {
            StatusChip(
                if (state.adapterEnabled) "Adaptador ativo" else "Adaptador desligado",
                if (state.adapterEnabled) AuraColors.Success else AuraColors.Danger
            )
            Spacer(Modifier.width(8.dp))
            StatusChip(
                when (state.connection) {
                    ConnectionState.CONNECTED -> "TW982 conectado"
                    else -> "TW982 desconectado"
                },
                if (state.connection == ConnectionState.CONNECTED) AuraColors.Success else AuraColors.Warning
            )
        }

        SectionLabel("Estado técnico", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                InfoRow("A2DP", if (state.a2dpConnected) "Conectado" else "Desconectado")
                InfoRow("HFP", if (state.hfpConnected) "Conectado" else "Desconectado")
                InfoRow("Endereço", state.address ?: "—")
                InfoRow("Tipo de rádio", state.deviceType)
                InfoRow("Serviços SDP", if (state.uuids.isEmpty()) "não consultados" else "${state.uuids.size} serviços")
            }
        }

        SectionLabel("Ações")
        AuraCard {
            Column {
                Button(
                    onClick = {
                        val ok = container.tw982.tryReconnect()
                        reconnectResult = if (ok)
                            "Pedido de reconexão aceito pelo sistema — aguarde alguns segundos."
                        else
                            "O Android deste aparelho não permite que apps iniciem a conexão de perfis de áudio. " +
                                "Use o atalho abaixo: tocar no TW982 na lista do sistema reconecta na hora."
                        container.tw982.refresh()
                    },
                    enabled = state.bonded && state.connection != ConnectionState.CONNECTED,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Tentar reconectar") }
                reconnectResult?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { context.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Abrir ajustes Bluetooth do sistema") }
            }
        }

        SectionLabel("Serviços anunciados (SDP)")
        AuraCard {
            Column {
                if (state.uuids.isEmpty()) Text(
                    "Conecte o TW982 para consultar os serviços.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                state.uuids.forEach {
                    Text("• ${friendlyUuid(it)}  ·  $it", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 3.dp))
                }
            }
        }

        SectionLabel("Histórico de conexões")
        AuraCard {
            Column {
                if (events.isEmpty()) Text(
                    "Sem eventos registrados ainda. Ative o monitoramento em Settings para gravar o histórico.",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                events.take(15).forEach { e ->
                    Row(Modifier.padding(vertical = 4.dp)) {
                        Text(
                            if (e.type == "CONNECTED") "●" else "○",
                            color = if (e.type == "CONNECTED") AuraColors.Success else AuraColors.Warning
                        )
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                "${if (e.type == "CONNECTED") "Conectado" else "Desconectado"} — ${fmt.format(Date(e.timestamp))}",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            val extras = buildList {
                                if (e.batteryLevel >= 0) add("bateria ${e.batteryLevel}%")
                                if (e.latitude != null && e.longitude != null)
                                    add("posição do telefone: %.5f, %.5f".format(e.latitude, e.longitude))
                            }
                            if (extras.isNotEmpty()) Text(
                                extras.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
