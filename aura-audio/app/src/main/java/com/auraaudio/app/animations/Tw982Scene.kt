package com.auraaudio.app.animations

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.InfiniteRepeatableSpec
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.sin

/**
 * Cena do HAVIT TW982 desenhada vetorialmente (renderização 2.5D em Canvas).
 *
 * Reproduz a identidade física do produto a partir de referências fotográficas:
 * estojo "pebble" arredondado com LED frontal e fones de haste curta com
 * cabeça oval — sem usar modelo genérico.
 *
 * `openProgress` 0..1 controla a narrativa: tampa fechada -> abertura ->
 * fones elevando e flutuando. `floating` liga a flutuação contínua.
 *
 * Decisão técnica documentada: a renderização usa Canvas 2D com gradientes e
 * sombras em vez de um motor 3D (Filament) porque não existe modelo glTF oficial
 * do TW982; um modelo 3D genérico violaria a regra de fidelidade visual.
 */
@Composable
fun Tw982Scene(
    openProgress: Float,
    floating: Boolean,
    modifier: Modifier = Modifier,
    dark: Boolean = true,
    ledOn: Boolean = false
) {
    val infinite = rememberInfiniteTransition(label = "float")
    val floatPhase by infinite.animateFloat(
        0f, (2 * Math.PI).toFloat(),
        InfiniteRepeatableSpec(tween(5200, easing = FastOutSlowInEasing), RepeatMode.Restart),
        label = "phase"
    )
    val glow by infinite.animateFloat(
        0.55f, 1f,
        InfiniteRepeatableSpec(tween(1600), RepeatMode.Reverse),
        label = "glow"
    )

    Canvas(modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val cx = w / 2f
        val caseW = w * 0.52f
        val caseH = caseW * 0.72f
        val caseTop = h * 0.46f
        val open = openProgress.coerceIn(0f, 1f)
        val lift = smooth((open - 0.45f) / 0.55f)   // fones sobem na 2ª metade
        val lid = smooth(open / 0.6f)               // tampa abre na 1ª parte

        // ---- fundo: halo suave atrás do produto ----
        drawCircle(
            Brush.radialGradient(
                listOf(
                    (if (dark) Color(0xFF26324A) else Color(0xFFD9E4F5)).copy(alpha = 0.55f),
                    Color.Transparent
                ),
                center = Offset(cx, caseTop + caseH * 0.2f),
                radius = w * 0.55f
            ),
            radius = w * 0.55f,
            center = Offset(cx, caseTop + caseH * 0.2f)
        )

        // ---- sombra de contato ----
        drawOval(
            Brush.radialGradient(
                listOf(Color.Black.copy(alpha = if (dark) 0.5f else 0.22f), Color.Transparent),
                center = Offset(cx, caseTop + caseH + caseH * 0.16f),
                radius = caseW * 0.55f
            ),
            topLeft = Offset(cx - caseW * 0.55f, caseTop + caseH + caseH * 0.06f),
            size = Size(caseW * 1.1f, caseH * 0.2f)
        )

        // ---- fones (atrás do estojo quando dentro; acima quando flutuando) ----
        val budFloat = if (floating) sin(floatPhase) * h * 0.008f else 0f
        val budFloat2 = if (floating) sin(floatPhase + 1.7f) * h * 0.009f else 0f
        val budRise = lift * caseH * 1.45f
        val budScale = 0.9f + lift * 0.35f
        val budBaseY = caseTop + caseH * 0.36f

        if (lift > 0.02f) {
            drawEarbud(
                center = Offset(cx - caseW * (0.17f + lift * 0.16f), budBaseY - budRise + budFloat),
                size = caseW * 0.17f * budScale, dark = dark, leftSide = true, tilt = -12f * lift
            )
            drawEarbud(
                center = Offset(cx + caseW * (0.17f + lift * 0.16f), budBaseY - budRise + budFloat2),
                size = caseW * 0.17f * budScale, dark = dark, leftSide = false, tilt = 12f * lift
            )
        }

        // ---- corpo do estojo ----
        val bodyTop = caseTop + caseH * 0.30f
        val bodyH = caseH * 0.70f
        val shellLight = if (dark) Color(0xFF2B2F38) else Color(0xFFEDEFF3)
        val shellMid = if (dark) Color(0xFF191C23) else Color(0xFFD4D8E0)
        val shellDark = if (dark) Color(0xFF101218) else Color(0xFFB9BEC9)

        // interior (poço) visível conforme abre
        if (lid > 0.05f) {
            drawRoundRect(
                Brush.verticalGradient(listOf(shellDark, Color.Black.copy(alpha = 0.85f)), startY = bodyTop - caseH * 0.1f),
                topLeft = Offset(cx - caseW / 2 * 0.92f, bodyTop - caseH * 0.08f * lid),
                size = Size(caseW * 0.92f, caseH * 0.2f),
                cornerRadius = CornerRadius(caseW * 0.1f)
            )
        }

        drawRoundRect(
            Brush.linearGradient(
                listOf(shellLight, shellMid, shellDark),
                start = Offset(cx - caseW / 2, bodyTop),
                end = Offset(cx + caseW / 2, bodyTop + bodyH)
            ),
            topLeft = Offset(cx - caseW / 2, bodyTop),
            size = Size(caseW, bodyH),
            cornerRadius = CornerRadius(caseW * 0.18f)
        )
        // reflexo frontal
        drawRoundRect(
            Brush.verticalGradient(
                listOf(Color.White.copy(alpha = if (dark) 0.07f else 0.5f), Color.Transparent),
                startY = bodyTop, endY = bodyTop + bodyH * 0.5f
            ),
            topLeft = Offset(cx - caseW / 2 + caseW * 0.05f, bodyTop + bodyH * 0.06f),
            size = Size(caseW * 0.9f, bodyH * 0.4f),
            cornerRadius = CornerRadius(caseW * 0.14f)
        )
        // LED frontal
        val ledColor = if (ledOn) Color(0xFF7FC9FF).copy(alpha = glow) else (if (dark) Color(0xFF3A3F4A) else Color(0xFFA9AFBA))
        drawCircle(ledColor, radius = caseW * 0.018f, center = Offset(cx, bodyTop + bodyH * 0.52f))
        if (ledOn) drawCircle(
            Color(0xFF7FC9FF).copy(alpha = 0.25f * glow),
            radius = caseW * 0.05f, center = Offset(cx, bodyTop + bodyH * 0.52f)
        )

        // ---- tampa (gira para trás com per­spectiva simulada) ----
        val lidH = caseH * 0.34f
        val lidSquash = 1f - lid * 0.92f   // achata ao abrir
        val lidShiftY = -lid * lidH * 1.1f  // desloca para trás/cima
        translate(top = lidShiftY) {
            scale(scaleX = 1f, scaleY = lidSquash.coerceAtLeast(0.08f), pivot = Offset(cx, bodyTop)) {
                drawRoundRect(
                    Brush.linearGradient(
                        listOf(shellLight.copy(alpha = 1f), shellMid),
                        start = Offset(cx - caseW / 2, bodyTop - lidH),
                        end = Offset(cx + caseW / 2, bodyTop)
                    ),
                    topLeft = Offset(cx - caseW / 2, bodyTop - lidH),
                    size = Size(caseW, lidH),
                    cornerRadius = CornerRadius(caseW * 0.18f)
                )
                drawRoundRect(
                    Color.White.copy(alpha = if (dark) 0.05f else 0.35f),
                    topLeft = Offset(cx - caseW / 2 + caseW * 0.06f, bodyTop - lidH + lidH * 0.14f),
                    size = Size(caseW * 0.88f, lidH * 0.18f),
                    cornerRadius = CornerRadius(caseW * 0.09f)
                )
            }
        }
        // linha da dobradiça
        drawRoundRect(
            shellDark,
            topLeft = Offset(cx - caseW / 2, bodyTop - caseH * 0.012f),
            size = Size(caseW, caseH * 0.024f),
            cornerRadius = CornerRadius(caseH * 0.012f)
        )
    }
}

/** Fone TW982: cabeça oval + haste curta, com brilho especular e sombra própria. */
private fun DrawScope.drawEarbud(center: Offset, size: Float, dark: Boolean, leftSide: Boolean, tilt: Float) {
    val headR = size
    val stemW = size * 0.52f
    val stemH = size * 2.0f
    val bodyLight = if (dark) Color(0xFF343944) else Color(0xFFF2F4F7)
    val bodyMid = if (dark) Color(0xFF20242D) else Color(0xFFD8DCE4)
    val bodyDark = if (dark) Color(0xFF14171D) else Color(0xFFBFC5CF)

    rotate(tilt, pivot = center) {
        // sombra própria
        drawOval(
            Color.Black.copy(alpha = 0.18f),
            topLeft = Offset(center.x - headR * 0.9f, center.y + stemH * 0.78f),
            size = Size(headR * 1.8f, headR * 0.5f)
        )
        // haste
        drawRoundRect(
            Brush.linearGradient(
                listOf(bodyLight, bodyMid, bodyDark),
                start = Offset(center.x - stemW / 2, center.y),
                end = Offset(center.x + stemW / 2, center.y + stemH)
            ),
            topLeft = Offset(center.x - stemW / 2, center.y - headR * 0.1f),
            size = Size(stemW, stemH),
            cornerRadius = CornerRadius(stemW / 2)
        )
        // cabeça
        drawCircle(
            Brush.radialGradient(
                listOf(bodyLight, bodyMid, bodyDark),
                center = Offset(center.x - headR * 0.3f, center.y - headR * 0.35f),
                radius = headR * 1.6f
            ),
            radius = headR,
            center = center
        )
        // ponteira (voltada para dentro)
        val tipX = center.x + (if (leftSide) headR * 0.55f else -headR * 0.55f)
        drawCircle(
            if (dark) Color(0xFF0E1013) else Color(0xFF8E939D),
            radius = headR * 0.42f,
            center = Offset(tipX, center.y - headR * 0.15f)
        )
        // brilho especular
        drawCircle(
            Color.White.copy(alpha = if (dark) 0.18f else 0.65f),
            radius = headR * 0.22f,
            center = Offset(center.x - headR * 0.38f, center.y - headR * 0.42f)
        )
    }
}

private fun smooth(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    return x * x * (3 - 2 * x)
}
