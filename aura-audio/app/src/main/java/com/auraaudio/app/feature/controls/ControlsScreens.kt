package com.auraaudio.app.feature.controls

import androidx.compose.animation.core.InfiniteRepeatableSpec
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.feature.common.AuraScaffold

private data class Gesture(val side: String, val gesture: String, val taps: Int, val hold: Boolean, val function: String, val context: String)

private val GESTURES = listOf(
    Gesture("Ambos", "Toque duplo", 2, false, "Reproduzir / Pausar", "Música"),
    Gesture("Esquerdo", "Pressionar ~1 s", 0, true, "Música anterior", "Música"),
    Gesture("Direito", "Pressionar ~1 s", 0, true, "Próxima música", "Música"),
    Gesture("Ambos", "Toque duplo", 2, false, "Atender / Finalizar", "Chamada"),
    Gesture("Ambos", "Pressionar ~1 s", 0, true, "Rejeitar chamada", "Chamada"),
    Gesture("Esquerdo", "Toque triplo", 3, false, "Assistente de voz", "Sistema"),
    Gesture("Direito", "Toque triplo", 3, false, "Modo jogo", "Sistema")
)

@Composable
fun TouchControlsScreen(nav: NavController) {
    AuraScaffold(nav, "Touch Controls") {
        Spacer(Modifier.height(6.dp))
        AuraCard {
            Column {
                Text("Mapeamento oficial do TW982", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(6.dp))
                Text(
                    "Gestos documentados no manual do fabricante (registro FCC 2AI6I-TW982). " +
                        "O firmware do TW982 não expõe protocolo público de remapeamento — o diagnóstico " +
                        "verifica se o seu exemplar aceita personalização; até lá, nenhuma opção fictícia é exibida.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        listOf("Música", "Chamada", "Sistema").forEach { ctx ->
            SectionLabel(ctx, Modifier.padding(top = 14.dp))
            AuraCard {
                Column {
                    GESTURES.filter { it.context == ctx }.forEach { g ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            GestureAnim(taps = g.taps, hold = g.hold)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(g.function, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "${g.gesture} · fone ${g.side.lowercase()}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            StatusChip(g.side, MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

/** Guia animado: pontos pulsando no ritmo do gesto (toques) ou preenchendo (pressão longa). */
@Composable
private fun GestureAnim(taps: Int, hold: Boolean) {
    val infinite = rememberInfiniteTransition(label = "gesture")
    val t by infinite.animateFloat(
        0f, 1f, InfiniteRepeatableSpec(tween(1800), RepeatMode.Restart), label = "t"
    )
    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)) {
        Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
            if (hold) {
                Box(
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.25f + 0.55f * t))
                )
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    repeat(taps) { i ->
                        val phase = ((t * taps) - i).coerceIn(0f, 1f)
                        val a = if (phase in 0.05f..0.7f) 1f else 0.25f
                        Box(
                            Modifier
                                .size(9.dp)
                                .alpha(a)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun GameModeScreen(nav: NavController) {
    AuraScaffold(nav, "Game Mode") {
        Spacer(Modifier.height(6.dp))
        AuraCard {
            Column {
                StatusChip("Ativação no fone", AuraColors.Warning)
                Spacer(Modifier.height(10.dp))
                Text("Modo jogo (baixa latência)", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(6.dp))
                Text(
                    "O TW982 reduz a latência de áudio para jogos. O firmware ativa o modo apenas pelo gesto físico — " +
                        "não existe comando Bluetooth documentado para acioná-lo remotamente, então o AURA AUDIO " +
                        "não mostra um botão falso. O guia abaixo é o procedimento oficial.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionLabel("Como ativar", Modifier.padding(top = 14.dp))
        listOf(
            "1" to "Com os fones conectados e no ouvido, localize o fone DIREITO.",
            "2" to "Dê um TOQUE TRIPLO rápido na superfície de toque do fone direito.",
            "3" to "Um aviso sonoro confirma a entrada no modo jogo.",
            "4" to "Repita o toque triplo no fone direito para voltar ao modo música (maior qualidade/alcance)."
        ).forEach { (n, text) ->
            AuraCard(modifier = Modifier.padding(vertical = 5.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)) {
                        Text(
                            n, style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Text(text, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        SectionLabel("Dicas", Modifier.padding(top = 10.dp))
        AuraCard {
            Text(
                "• No modo jogo a prioridade é latência; a estabilidade da conexão pode diminuir em ambientes com interferência.\n" +
                    "• Combine com o preset \"Gaming\" do Audio Studio para realçar passos e efeitos.\n" +
                    "• O estado do modo jogo não é reportado ao telefone pelo firmware — o indicador oficial é o aviso sonoro.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}
