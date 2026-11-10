package com.auraaudio.app.feature.matrix

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.core.FeatureMatrix
import com.auraaudio.app.core.SupportClass
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.InfoRow
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.feature.common.AuraScaffold

@Composable
fun FeatureMatrixScreen(nav: NavController) {
    AuraScaffold(nav, "Matriz de recursos") {
        Spacer(Modifier.height(6.dp))
        AuraCard {
            Text(
                "Transparência total: cada recurso do AURA AUDIO classificado pelo que é tecnicamente real. " +
                    "A — protocolo do próprio TW982 · B — API do Android · C — implementação complementar · " +
                    "D — o hardware não suporta · E — depende do diagnóstico no seu exemplar.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(8.dp))
        FeatureMatrix.entries.forEach { f ->
            AuraCard(modifier = Modifier.padding(vertical = 6.dp)) {
                Column {
                    StatusChip("${f.support.name} — ${f.support.label}", colorFor(f.support))
                    Spacer(Modifier.height(8.dp))
                    Text(f.name, style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(f.how, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(8.dp))
                    InfoRow("Protocolo", f.protocol)
                    InfoRow("API", f.api)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Limitação: ${f.limitation}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

private fun colorFor(s: SupportClass): Color = when (s) {
    SupportClass.A -> AuraColors.Success
    SupportClass.B -> AuraColors.AccentBlueDeep
    SupportClass.C -> AuraColors.Warning
    SupportClass.D -> AuraColors.Danger
    SupportClass.E -> Color(0xFF9A86C8)
}
