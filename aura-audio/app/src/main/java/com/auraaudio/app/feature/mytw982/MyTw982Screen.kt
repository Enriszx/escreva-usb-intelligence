package com.auraaudio.app.feature.mytw982

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun MyTw982Screen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val fmt = SimpleDateFormat("dd/MM HH:mm:ss", Locale.getDefault())

    AuraScaffold(nav, "My TW982") {
        Spacer(Modifier.height(6.dp))
        StatusChip(
            when (state.connection) {
                ConnectionState.CONNECTED -> "Conectado"
                ConnectionState.CONNECTING -> "Conectando…"
                else -> if (state.bonded) "Pareado, desconectado" else "Não pareado"
            },
            if (state.connection == ConnectionState.CONNECTED) AuraColors.Success else AuraColors.Warning
        )

        SectionLabel("Identidade", Modifier.padding(top = 16.dp))
        AuraCard {
            Column {
                InfoRow("Nome", state.deviceName ?: "—")
                InfoRow("Endereço MAC", state.address ?: "—")
                InfoRow("Tipo de rádio", state.deviceType)
                InfoRow("Pareamento", state.bondState)
            }
        }

        SectionLabel("Perfis de áudio ativos")
        AuraCard {
            Column {
                InfoRow("A2DP (música estéreo)", if (state.a2dpConnected) "Conectado" else "Desconectado")
                InfoRow("HFP (voz/chamadas)", if (state.hfpConnected) "Conectado" else "Desconectado")
                InfoRow(
                    "Última conexão",
                    if (state.lastConnectedAt > 0) fmt.format(Date(state.lastConnectedAt)) else "—"
                )
                InfoRow(
                    "Última desconexão",
                    if (state.lastDisconnectedAt > 0) fmt.format(Date(state.lastDisconnectedAt)) else "—"
                )
            }
        }

        SectionLabel("Hardware (ficha do fabricante)")
        AuraCard {
            Column {
                InfoRow("Modelo", "HAVIT TW982 (LIFE 01T)")
                InfoRow("Chip", "Bluetrum AB5656 (RISC-V)")
                InfoRow("Bluetooth", "5.4")
                InfoRow("Alto-falantes", "13 mm")
                InfoRow("Bateria dos fones", "40 mAh cada")
                InfoRow("Bateria do estojo", "400 mAh")
                InfoRow("Registro FCC", "2AI6I-TW982 (2024)")
                Spacer(Modifier.height(6.dp))
                Text(
                    "Valores da documentação pública do fabricante e do registro FCC — não medidos pelo app.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionLabel("Serviços Bluetooth (SDP)")
        AuraCard {
            Column {
                if (state.uuids.isEmpty()) {
                    Text(
                        "UUIDs ainda não consultados — conecte o fone e aguarde, ou rode o Diagnostics.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else state.uuids.forEach { uuid ->
                    Text(
                        "${friendlyUuid(uuid)}\n$uuid",
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

fun friendlyUuid(uuid: String): String = when {
    uuid.startsWith("0000110b") -> "A2DP Sink (áudio estéreo)"
    uuid.startsWith("0000110c") -> "AVRCP Target (controle remoto)"
    uuid.startsWith("0000110e") -> "AVRCP (controle remoto)"
    uuid.startsWith("0000111e") -> "Hands-Free (chamadas)"
    uuid.startsWith("00001108") -> "Headset"
    uuid.startsWith("00001101") -> "Serial Port (SPP)"
    uuid.startsWith("0000180f") -> "Battery Service (GATT)"
    uuid.startsWith("00001800") -> "Generic Access"
    uuid.startsWith("00001801") -> "Generic Attribute"
    else -> "Serviço"
}
