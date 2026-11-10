package com.auraaudio.app.feature.audio

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.audio.EqPresets
import com.auraaudio.app.data.AuraSettings
import com.auraaudio.app.data.EqProfileCodec
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.feature.common.AuraScaffold
import kotlinx.coroutines.launch

@Composable
fun AudioStudioScreen(nav: NavController, container: AppContainer) {
    val scope = rememberCoroutineScope()
    val settings by container.settings.settings.collectAsState(initial = AuraSettings())

    LaunchedEffect(Unit) { container.eq.init() }
    val eq by container.eq.state.collectAsState()
    var showSaveDialog by remember { mutableStateOf(false) }
    var profileName by remember { mutableStateOf("") }

    AuraScaffold(nav, "Audio Studio") {
        Spacer(Modifier.height(6.dp))

        if (!eq.available) {
            AuraCard {
                Column {
                    Text("Equalizador global indisponível", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        eq.unavailableReason ?: "O sistema não permitiu criar os efeitos de áudio globais.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            return@AuraScaffold
        }

        // Ativação + transparência técnica
        AuraCard {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Equalização ativa", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Processada pelo Android na saída global e enviada já equalizada ao TW982 via A2DP.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(checked = eq.enabled, onCheckedChange = { container.eq.setEnabled(it) })
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "Nível de implementação: B (Android). O DSP interno do fone não expõe protocolo público de EQ — " +
                        "detalhes na Matriz de recursos. Alguns players com saída direta (offload) podem ignorar efeitos globais.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Curva em tempo real
        SectionLabel("Curva (${eq.bands.size} bandas reais do aparelho)", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                EqCurve(
                    freqs = eq.bands.map { it.centerFreqHz },
                    levelsMb = eq.bands.map { it.levelMb },
                    minMb = eq.bands.firstOrNull()?.minMb ?: -1500,
                    maxMb = eq.bands.firstOrNull()?.maxMb ?: 1500
                )
                Spacer(Modifier.height(12.dp))
                eq.bands.forEach { band ->
                    Column(Modifier.padding(vertical = 2.dp)) {
                        Row {
                            Text(formatFreq(band.centerFreqHz), style = MaterialTheme.typography.labelLarge, modifier = Modifier.width(64.dp))
                            Text(
                                "%+.1f dB".format(band.levelMb / 100f),
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        Slider(
                            value = band.levelMb.toFloat(),
                            onValueChange = { container.eq.setBandLevel(band.index, it.toInt()) },
                            valueRange = band.minMb.toFloat()..band.maxMb.toFloat(),
                            enabled = eq.enabled
                        )
                    }
                }
                Row {
                    OutlinedButton(onClick = { container.eq.reset() }, modifier = Modifier.weight(1f)) { Text("Restaurar original") }
                    Spacer(Modifier.width(10.dp))
                    Button(onClick = { showSaveDialog = true }, modifier = Modifier.weight(1f)) { Text("Salvar perfil") }
                }
            }
        }

        // Presets
        SectionLabel("Presets", Modifier.padding(top = 14.dp))
        Row(Modifier.horizontalScroll(rememberScrollState())) {
            EqPresets.all.forEach { p ->
                FilterChip(
                    selected = eq.activePreset == p.name,
                    onClick = { container.eq.applyPreset(p) },
                    label = { Text(p.name) },
                    modifier = Modifier.padding(end = 8.dp),
                    enabled = eq.enabled
                )
            }
        }

        // Perfis personalizados
        val profiles = remember(settings.customEqProfiles) { EqProfileCodec.decode(settings.customEqProfiles) }
        if (profiles.isNotEmpty()) {
            SectionLabel("Meus perfis", Modifier.padding(top = 14.dp))
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                profiles.forEach { p ->
                    FilterChip(
                        selected = eq.activePreset == p.name,
                        onClick = { container.eq.applyLevels(p.levelsMb, p.bass, p.virt, p.loud, p.name) },
                        label = { Text(p.name) },
                        modifier = Modifier.padding(end = 8.dp),
                        enabled = eq.enabled
                    )
                }
            }
        }

        // Personalização sonora
        SectionLabel("Personalização", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                EffectSlider("Graves (Bass Boost)", eq.bassAvailable, eq.bassStrength, 1000f, eq.enabled) { container.eq.setBass(it) }
                EffectSlider("Amplitude espacial (Virtualizer)", eq.virtAvailable, eq.virtStrength, 1000f, eq.enabled) { container.eq.setVirtualizer(it) }
                EffectSlider("Intensidade (Loudness)", eq.loudAvailable, eq.loudGainMb, 1000f, eq.enabled) { container.eq.setLoudness(it) }
                Text(
                    "Compare antes/depois com o interruptor \"Equalização ativa\" acima, com música tocando.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Spacer(Modifier.height(24.dp))
    }

    if (showSaveDialog) {
        AlertDialog(
            onDismissRequest = { showSaveDialog = false },
            title = { Text("Salvar perfil personalizado") },
            text = {
                OutlinedTextField(
                    value = profileName, onValueChange = { profileName = it },
                    label = { Text("Nome do perfil") }, singleLine = true
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val name = profileName.trim().ifBlank { "Meu perfil" }
                    val current = EqProfileCodec.decode(settings.customEqProfiles).filter { it.name != name }
                    val newList = current + EqProfileCodec.Profile(
                        name, container.eq.currentLevels(),
                        container.eq.state.value.bassStrength,
                        container.eq.state.value.virtStrength,
                        container.eq.state.value.loudGainMb
                    )
                    scope.launch { container.settings.setEqProfiles(EqProfileCodec.encode(newList)) }
                    showSaveDialog = false
                    profileName = ""
                }) { Text("Salvar") }
            },
            dismissButton = { TextButton(onClick = { showSaveDialog = false }) { Text("Cancelar") } }
        )
    }
}

@Composable
private fun EffectSlider(label: String, available: Boolean, value: Int, max: Float, enabled: Boolean, onChange: (Int) -> Unit) {
    Column(Modifier.padding(vertical = 4.dp)) {
        Row {
            Text(label, style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
            Text(
                if (!available) "indisponível" else "${value * 100 / max.toInt()}%",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toInt()) },
            valueRange = 0f..max,
            enabled = available && enabled
        )
    }
}

@Composable
private fun EqCurve(freqs: List<Int>, levelsMb: List<Int>, minMb: Int, maxMb: Int) {
    val lineColor = MaterialTheme.colorScheme.primary
    val gridColor = MaterialTheme.colorScheme.outline
    Box(Modifier.fillMaxWidth().height(120.dp)) {
        Canvas(Modifier.fillMaxWidth().height(120.dp)) {
            val w = size.width; val h = size.height
            // grade: 0 dB no centro
            drawLine(gridColor, Offset(0f, h / 2), Offset(w, h / 2), strokeWidth = 1f)
            if (freqs.size < 2) return@Canvas
            val range = (maxMb - minMb).coerceAtLeast(1)
            fun y(mb: Int) = h - ((mb - minMb).toFloat() / range) * h
            fun x(i: Int) = w * i / (freqs.size - 1).toFloat()
            val path = Path()
            levelsMb.forEachIndexed { i, mb ->
                val px = x(i); val py = y(mb)
                if (i == 0) path.moveTo(px, py) else {
                    val prevX = x(i - 1); val prevY = y(levelsMb[i - 1])
                    val midX = (prevX + px) / 2
                    path.cubicTo(midX, prevY, midX, py, px, py)
                }
            }
            drawPath(path, lineColor, style = Stroke(width = 5f))
            levelsMb.forEachIndexed { i, mb -> drawCircle(lineColor, radius = 7f, center = Offset(x(i), y(mb))) }
        }
    }
}

private fun formatFreq(hz: Int): String = if (hz >= 1000) "${hz / 1000} kHz" else "$hz Hz"
