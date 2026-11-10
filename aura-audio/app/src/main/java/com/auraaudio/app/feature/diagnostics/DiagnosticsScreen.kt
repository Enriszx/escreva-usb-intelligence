package com.auraaudio.app.feature.diagnostics

import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.core.AuraLog
import com.auraaudio.app.data.DiagnosticReportEntity
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.InfoRow
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.diagnostics.DiagnosticEngine
import com.auraaudio.app.feature.common.AuraScaffold
import kotlinx.coroutines.launch
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun DiagnosticsScreen(nav: NavController, container: AppContainer) {
    val phase by container.diagnostics.phase.collectAsState()
    val progress by container.diagnostics.progress.collectAsState()
    val report by container.diagnostics.report.collectAsState()
    val btState by container.tw982.state.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var savedMsg by remember { mutableStateOf<String?>(null) }

    val running = phase in listOf(
        DiagnosticEngine.Phase.CLASSIC, DiagnosticEngine.Phase.SCANNING,
        DiagnosticEngine.Phase.CONNECTING, DiagnosticEngine.Phase.DISCOVERING, DiagnosticEngine.Phase.READING
    )

    AuraScaffold(nav, "Diagnostics") {
        Spacer(Modifier.height(6.dp))
        AuraCard {
            Column {
                Text("Inspeção técnica do TW982", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Varre o que o SEU exemplar realmente expõe: serviços SDP, anúncio BLE, servidor GATT, " +
                        "características legíveis/graváveis e bateria. Somente leitura — nenhum dado é escrito no fone. " +
                        "Exporte o relatório e envie para ajustar o app com os dados reais do seu dispositivo.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(12.dp))
                if (running) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.width(22.dp).height(22.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(12.dp))
                        Text(progress, style = MaterialTheme.typography.bodyMedium)
                    }
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(onClick = { container.diagnostics.cancel() }) { Text("Cancelar") }
                } else {
                    Button(
                        onClick = { container.diagnostics.run(btState.device) },
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) { Text("Iniciar diagnóstico completo") }
                    if (btState.device == null) Text(
                        "Dica: pareie e conecte o TW982 antes, para o diagnóstico mais completo.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }
        }

        report?.let { rep ->
            SectionLabel("Resultado", Modifier.padding(top = 14.dp))
            AuraCard {
                Column {
                    Row {
                        StatusChip(
                            if (phase == DiagnosticEngine.Phase.DONE) "Concluído" else if (running) "Executando" else "Parcial",
                            if (phase == DiagnosticEngine.Phase.DONE) AuraColors.Success else AuraColors.Warning
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    InfoRow("Dispositivo", rep.deviceName ?: "não pareado")
                    InfoRow("Bateria (telemetria)", if (rep.classicBattery >= 0) "${rep.classicBattery}%" else "não reportada")
                    InfoRow("Serviços SDP", "${rep.sdpUuids.size}")
                    InfoRow("Anúncio BLE", if (rep.bleFound) "encontrado (RSSI ${rep.bleRssi})" else "não encontrado")
                    InfoRow("GATT", if (rep.gattConnected) "conectado — ${rep.services.size} serviços" else "não acessível")
                    if (rep.batteryServiceLevels.isNotEmpty())
                        InfoRow("GATT Battery", rep.batteryServiceLevels.joinToString { "$it%" })
                    InfoRow("Características", "${rep.characteristics.size}")
                    InfoRow("Erros registrados", "${rep.errors.size}")
                }
            }

            if (rep.notes.isNotEmpty()) {
                SectionLabel("Interpretação")
                AuraCard {
                    Column { rep.notes.forEach { Text("• $it", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 3.dp)) } }
                }
            }

            if (!running) {
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        val json = container.diagnostics.toJson(rep)
                        scope.launch {
                            container.db.dao().insertReport(
                                DiagnosticReportEntity(
                                    timestamp = System.currentTimeMillis(),
                                    summary = "GATT=${rep.gattConnected} SDP=${rep.sdpUuids.size} chars=${rep.characteristics.size}",
                                    json = json
                                )
                            )
                        }
                        val dir = File(context.cacheDir, "reports").apply { mkdirs() }
                        val f = File(dir, "aura_diagnostico_tw982_${System.currentTimeMillis()}.json")
                        f.writeText(json)
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", f)
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                            type = "application/json"
                            putExtra(Intent.EXTRA_STREAM, uri)
                            putExtra(Intent.EXTRA_SUBJECT, "Diagnóstico AURA AUDIO — HAVIT TW982")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }, "Exportar relatório"))
                        savedMsg = "Relatório salvo no histórico e pronto para compartilhar."
                    },
                    modifier = Modifier.fillMaxWidth().height(50.dp)
                ) { Text("Exportar relatório (JSON)") }
                savedMsg?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }

        SectionLabel("Log técnico ao vivo", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                val logs = AuraLog.snapshot().takeLast(30).reversed()
                if (logs.isEmpty()) Text("Sem registros ainda.", style = MaterialTheme.typography.bodySmall)
                logs.forEach {
                    Text(
                        AuraLog.format(it),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (it.isError) AuraColors.Danger else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 1.dp)
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
