package com.auraaudio.app.feature.about

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.animations.Tw982Scene
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.InfoRow
import com.auraaudio.app.designsystem.LocalDarkTheme
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.feature.common.AuraScaffold

@Composable
fun AboutScreen(nav: NavController) {
    AuraScaffold(nav, "About") {
        Box(Modifier.fillMaxWidth().height(190.dp)) {
            Tw982Scene(openProgress = 1f, floating = true, dark = LocalDarkTheme.current, ledOn = true)
        }
        Text("AURA AUDIO", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Central de controle dedicada ao HAVIT TW982 / LIFE 01T",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        SectionLabel("Versão", Modifier.padding(top = 16.dp))
        AuraCard {
            Column {
                InfoRow("Versão", "1.1.0")
                InfoRow("Dispositivo suportado", "HAVIT TW982 (exclusivo)")
                InfoRow("Plataforma", "Android 8.0+ · Jetpack Compose")
            }
        }

        SectionLabel("Princípios")
        AuraCard {
            Text(
                "• Controle real acima de tudo: nenhum botão decorativo, nenhum valor inventado.\n" +
                    "• Quando um recurso não é possível, o app explica o porquê (veja a Matriz de recursos).\n" +
                    "• Nenhuma modificação perigosa: sem root, sem escrita em firmware, sem contornar a segurança do Android.\n" +
                    "• Seus dados ficam no aparelho: histórico e relatórios só saem se você exportar.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        SectionLabel("Fontes técnicas")
        AuraCard {
            Text(
                "Manual oficial HAVIT TW982 · Registro FCC 2AI6I-TW982 (2024) · " +
                    "Documentação pública do SoC Bluetrum AB5656 · APIs Android (Bluetooth, MediaSession, AudioFx).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}
