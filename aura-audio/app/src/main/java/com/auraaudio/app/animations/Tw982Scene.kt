package com.auraaudio.app.animations

import androidx.compose.animation.core.EaseInOutSine
import androidx.compose.animation.core.InfiniteRepeatableSpec
import androidx.compose.animation.core.LinearEasing
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
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import kotlin.math.sin

/**
 * Cena fotográfica do HAVIT TW982 — renderização vetorial em camadas
 * (estúdio: luz principal suave, luz de recorte champanhe, reflexo de piso).
 *
 * O produto real é preto glossy: estojo "pebble" com tampa de dobradiça e
 * fones de haste curta com cabeça oval. Cada superfície recebe quatro passes:
 * base, sombreamento de forma, luz de recorte e especular.
 *
 * `openProgress` 0→1: tampa fechada → aberta → fones elevados, flutuando.
 */
@Composable
fun Tw982Scene(
    openProgress: Float,
    floating: Boolean,
    modifier: Modifier = Modifier,
    dark: Boolean = true,
    ledOn: Boolean = false
) {
    val infinite = rememberInfiniteTransition(label = "scene")
    val phase by infinite.animateFloat(
        0f, (2 * Math.PI).toFloat(),
        InfiniteRepeatableSpec(tween(6400, easing = LinearEasing), RepeatMode.Restart), label = "phase"
    )
    val breath by infinite.animateFloat(
        0f, 1f, InfiniteRepeatableSpec(tween(2600, easing = EaseInOutSine), RepeatMode.Reverse), label = "breath"
    )

    Canvas(modifier.fillMaxSize()) {
        val w = size.width
        val h = size.height
        val cx = w / 2f
        val open = openProgress.coerceIn(0f, 1f)
        val lid = smooth(open / 0.55f)
        val lift = smooth((open - 0.4f) / 0.6f)

        // dimensionamento consciente do espaço: nunca corta o produto, em qualquer proporção
        val caseW = minOf(w * 0.46f, h * 0.58f)
        val caseH = caseW * 0.70f
        val caseTop = h * 0.52f
        val bodyTop = caseTop + caseH * 0.26f
        val bodyH = caseH * 0.74f
        val floorY = bodyTop + bodyH

        // ───────────────── ambiente de estúdio ─────────────────
        // véu de luz atrás do produto
        drawRect(
            Brush.radialGradient(
                listOf(
                    (if (dark) Color(0xFF232120) else Color(0xFFFFFFFF)).copy(alpha = if (dark) 0.9f else 0.9f),
                    Color.Transparent
                ),
                center = Offset(cx, caseTop + caseH * 0.1f),
                radius = w * 0.62f
            )
        )
        // brilho champanhe muito sutil (identidade da marca)
        drawCircle(
            Brush.radialGradient(
                listOf(Color(0xFFD3B077).copy(alpha = if (dark) 0.10f else 0.14f), Color.Transparent),
                center = Offset(cx + w * 0.16f, caseTop - h * 0.04f),
                radius = w * 0.4f
            ),
            radius = w * 0.4f,
            center = Offset(cx + w * 0.16f, caseTop - h * 0.04f)
        )
        // linha de horizonte do piso
        drawLine(
            (if (dark) Color.White else Color.Black).copy(alpha = 0.05f),
            Offset(cx - caseW * 1.15f, floorY + caseH * 0.10f),
            Offset(cx + caseW * 1.15f, floorY + caseH * 0.10f),
            strokeWidth = 1.2f
        )

        // sombra de contato (dupla: núcleo + penumbra)
        val shadowAlpha = if (dark) 0.55f else 0.30f
        drawOval(
            Brush.radialGradient(
                listOf(Color.Black.copy(alpha = shadowAlpha * (0.9f + 0.1f * breath)), Color.Transparent),
                center = Offset(cx, floorY + caseH * 0.10f), radius = caseW * 0.62f
            ),
            topLeft = Offset(cx - caseW * 0.62f, floorY + caseH * 0.015f),
            size = Size(caseW * 1.24f, caseH * 0.19f)
        )
        drawOval(
            Color.Black.copy(alpha = shadowAlpha * 0.8f),
            topLeft = Offset(cx - caseW * 0.34f, floorY + caseH * 0.055f),
            size = Size(caseW * 0.68f, caseH * 0.075f)
        )

        // ───────────────── fones ─────────────────
        val sway1 = if (floating) sin(phase) else 0f
        val sway2 = if (floating) sin(phase + 2.1f) else 0f
        val budScale = 0.92f + lift * 0.38f
        val budY = caseTop + caseH * 0.30f
        // elevação limitada pela altura do canvas: fones flutuam a 18% do topo
        val rise = lift * (budY - h * 0.18f).coerceAtLeast(0f)

        if (lift > 0.02f) {
            drawEarbud(
                center = Offset(
                    cx - caseW * (0.16f + lift * 0.22f),
                    budY - rise + sway1 * h * 0.009f
                ),
                headR = caseW * 0.145f * budScale,
                dark = dark, leftSide = true,
                tilt = -10f * lift + sway1 * 2.2f
            )
            drawEarbud(
                center = Offset(
                    cx + caseW * (0.16f + lift * 0.22f),
                    budY - rise + sway2 * h * 0.010f
                ),
                headR = caseW * 0.145f * budScale,
                dark = dark, leftSide = false,
                tilt = 10f * lift + sway2 * 2.2f
            )
        }

        // ───────────────── estojo: corpo ─────────────────
        val rBody = CornerRadius(caseW * 0.22f)
        val bodyRect = Rect(cx - caseW / 2, bodyTop, cx + caseW / 2, bodyTop + bodyH)

        // interior (visível com a tampa aberta)
        if (lid > 0.04f) {
            val wellH = caseH * 0.20f * lid
            drawRoundRect(
                Brush.verticalGradient(
                    listOf(Color(0xFF060607), Color(0xFF151518)),
                    startY = bodyTop - wellH, endY = bodyTop + caseH * 0.1f
                ),
                topLeft = Offset(cx - caseW * 0.44f, bodyTop - wellH),
                size = Size(caseW * 0.88f, wellH + caseH * 0.06f),
                cornerRadius = CornerRadius(caseW * 0.12f)
            )
            // berços dos fones
            listOf(-0.19f, 0.19f).forEach { dxf ->
                drawOval(
                    Brush.radialGradient(
                        listOf(Color.Black, Color(0xFF1B1B1F)),
                        center = Offset(cx + caseW * dxf, bodyTop - wellH * 0.35f),
                        radius = caseW * 0.11f
                    ),
                    topLeft = Offset(cx + caseW * dxf - caseW * 0.085f, bodyTop - wellH * 0.35f - caseW * 0.05f),
                    size = Size(caseW * 0.17f, caseW * 0.10f)
                )
            }
        }

        // base: preto glossy com forma (mais claro no alto-esquerda, denso embaixo)
        drawRoundRect(
            Brush.linearGradient(
                listOf(Color(0xFF2E2E33), Color(0xFF17171A), Color(0xFF070708)),
                start = Offset(bodyRect.left, bodyRect.top),
                end = Offset(bodyRect.right, bodyRect.bottom)
            ),
            topLeft = bodyRect.topLeft, size = bodyRect.size, cornerRadius = rBody
        )
        // oclusão inferior
        drawRoundRect(
            Brush.verticalGradient(
                listOf(Color.Transparent, Color.Black.copy(alpha = 0.55f)),
                startY = bodyRect.top + bodyH * 0.45f, endY = bodyRect.bottom
            ),
            topLeft = bodyRect.topLeft, size = bodyRect.size, cornerRadius = rBody
        )
        // sheen frontal (reflexo de softbox vertical)
        drawRoundRect(
            Brush.horizontalGradient(
                listOf(
                    Color.Transparent,
                    Color.White.copy(alpha = 0.10f),
                    Color.White.copy(alpha = 0.03f),
                    Color.Transparent
                ),
                startX = cx - caseW * 0.34f, endX = cx + caseW * 0.10f
            ),
            topLeft = Offset(bodyRect.left + caseW * 0.05f, bodyRect.top + bodyH * 0.07f),
            size = Size(caseW * 0.9f, bodyH * 0.8f),
            cornerRadius = CornerRadius(caseW * 0.16f)
        )
        // luz de recorte champanhe na lateral direita
        drawRoundRect(
            Brush.horizontalGradient(
                listOf(Color.Transparent, Color(0xFFD3B077).copy(alpha = 0.22f)),
                startX = bodyRect.right - caseW * 0.16f, endX = bodyRect.right
            ),
            topLeft = bodyRect.topLeft, size = bodyRect.size, cornerRadius = rBody
        )
        // rim light superior fino
        drawRoundRect(
            Brush.verticalGradient(
                listOf(Color.White.copy(alpha = 0.35f), Color.Transparent),
                startY = bodyRect.top, endY = bodyRect.top + bodyH * 0.10f
            ),
            topLeft = bodyRect.topLeft, size = Size(bodyRect.width, bodyH * 0.12f),
            cornerRadius = rBody
        )

        // LED de estado
        val ledC = Offset(cx, bodyTop + bodyH * 0.48f)
        if (ledOn) {
            drawCircle(Color(0xFFEFD9AE).copy(alpha = 0.5f + 0.4f * breath), radius = caseW * 0.034f, center = ledC)
            drawCircle(Color(0xFFFFF4DC), radius = caseW * 0.013f, center = ledC)
        } else {
            drawCircle(Color(0xFF3A3A40), radius = caseW * 0.012f, center = ledC)
        }

        // ───────────────── estojo: tampa ─────────────────
        val lidH = caseH * 0.30f
        val squash = (1f - lid * 0.94f).coerceAtLeast(0.06f)
        translate(top = -lid * lidH * 1.12f) {
            scale(scaleX = 1f, scaleY = squash, pivot = Offset(cx, bodyTop)) {
                val lidRect = Rect(cx - caseW / 2, bodyTop - lidH, cx + caseW / 2, bodyTop)
                drawRoundRect(
                    Brush.linearGradient(
                        listOf(Color(0xFF3A3A40), Color(0xFF202024), Color(0xFF101013)),
                        start = Offset(lidRect.left, lidRect.top),
                        end = Offset(lidRect.right, lidRect.bottom)
                    ),
                    topLeft = lidRect.topLeft, size = lidRect.size, cornerRadius = rBody
                )
                // reflexo superior curvo da tampa
                drawRoundRect(
                    Brush.verticalGradient(
                        listOf(Color.White.copy(alpha = 0.30f), Color.White.copy(alpha = 0.04f), Color.Transparent),
                        startY = lidRect.top, endY = lidRect.top + lidH * 0.6f
                    ),
                    topLeft = Offset(lidRect.left + caseW * 0.04f, lidRect.top + lidH * 0.06f),
                    size = Size(caseW * 0.92f, lidH * 0.55f),
                    cornerRadius = CornerRadius(caseW * 0.16f)
                )
                // recorte champanhe tambem na tampa
                drawRoundRect(
                    Brush.horizontalGradient(
                        listOf(Color.Transparent, Color(0xFFD3B077).copy(alpha = 0.18f)),
                        startX = lidRect.right - caseW * 0.14f, endX = lidRect.right
                    ),
                    topLeft = lidRect.topLeft, size = lidRect.size, cornerRadius = rBody
                )
            }
        }
        // vão/seam da dobradiça
        drawRoundRect(
            Brush.verticalGradient(
                listOf(Color.Black.copy(alpha = 0.8f), Color.White.copy(alpha = 0.08f)),
                startY = bodyTop - 2f, endY = bodyTop + 4f
            ),
            topLeft = Offset(cx - caseW / 2 + caseW * 0.02f, bodyTop - 2f),
            size = Size(caseW * 0.96f, 5f),
            cornerRadius = CornerRadius(3f)
        )

        // reflexo do produto no piso (discretíssimo)
        drawRoundRect(
            Brush.verticalGradient(
                listOf((if (dark) Color.White else Color.Black).copy(alpha = 0.05f), Color.Transparent),
                startY = floorY + 4f, endY = floorY + caseH * 0.4f
            ),
            topLeft = Offset(cx - caseW / 2, floorY + 4f),
            size = Size(caseW, caseH * 0.35f),
            cornerRadius = rBody
        )
    }
}

/** Fone glossy preto: cabeça oval, haste levemente cônica, especulares de estúdio. */
private fun DrawScope.drawEarbud(center: Offset, headR: Float, dark: Boolean, leftSide: Boolean, tilt: Float) {
    val stemW = headR * 0.78f
    val stemH = headR * 2.35f

    rotate(tilt, pivot = center) {
        // sombra própria suave projetada abaixo
        drawOval(
            Brush.radialGradient(
                listOf(Color.Black.copy(alpha = if (dark) 0.30f else 0.18f), Color.Transparent),
                center = Offset(center.x, center.y + stemH + headR * 0.3f), radius = headR * 1.4f
            ),
            topLeft = Offset(center.x - headR * 1.2f, center.y + stemH),
            size = Size(headR * 2.4f, headR * 0.6f)
        )

        // haste (cápsula cônica)
        val stemPath = Path().apply {
            moveTo(center.x - stemW / 2, center.y + headR * 0.25f)
            lineTo(center.x - stemW * 0.36f, center.y + stemH)
            quadraticBezierTo(center.x, center.y + stemH + stemW * 0.55f, center.x + stemW * 0.36f, center.y + stemH)
            lineTo(center.x + stemW / 2, center.y + headR * 0.25f)
            close()
        }
        drawPath(
            stemPath,
            Brush.linearGradient(
                listOf(Color(0xFF38383E), Color(0xFF1B1B1F), Color(0xFF0A0A0C)),
                start = Offset(center.x - stemW / 2, center.y),
                end = Offset(center.x + stemW / 2, center.y + stemH)
            )
        )
        // streak especular da haste
        drawRoundRect(
            Brush.verticalGradient(
                listOf(Color.White.copy(alpha = 0.35f), Color.White.copy(alpha = 0.06f), Color.Transparent),
                startY = center.y + headR * 0.3f, endY = center.y + stemH * 0.95f
            ),
            topLeft = Offset(center.x - stemW * 0.30f, center.y + headR * 0.3f),
            size = Size(stemW * 0.16f, stemH * 0.72f),
            cornerRadius = CornerRadius(stemW * 0.08f)
        )
        // detalhe metálico do microfone na ponta da haste
        drawOval(
            Brush.linearGradient(
                listOf(Color(0xFF8E8E96), Color(0xFF3C3C42)),
                start = Offset(center.x - stemW * 0.2f, center.y + stemH),
                end = Offset(center.x + stemW * 0.2f, center.y + stemH + stemW * 0.3f)
            ),
            topLeft = Offset(center.x - stemW * 0.20f, center.y + stemH - stemW * 0.02f),
            size = Size(stemW * 0.40f, stemW * 0.26f)
        )

        // cabeça: esfera glossy com luz deslocada
        drawCircle(
            Brush.radialGradient(
                listOf(Color(0xFF46464D), Color(0xFF232327), Color(0xFF0B0B0D)),
                center = Offset(center.x - headR * 0.42f, center.y - headR * 0.48f),
                radius = headR * 2.1f
            ),
            radius = headR, center = center
        )
        // oclusão da base da cabeça
        drawCircle(
            Brush.radialGradient(
                listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f)),
                center = Offset(center.x, center.y - headR * 0.2f), radius = headR * 1.05f
            ),
            radius = headR, center = center
        )
        // ponteira de silicone (voltada para dentro)
        val tipX = center.x + (if (leftSide) headR * 0.58f else -headR * 0.58f)
        drawOval(
            Brush.radialGradient(
                listOf(Color(0xFF2A2A2E), Color(0xFF101013)),
                center = Offset(tipX, center.y - headR * 0.22f), radius = headR * 0.5f
            ),
            topLeft = Offset(tipX - headR * 0.40f, center.y - headR * 0.52f),
            size = Size(headR * 0.80f, headR * 0.62f)
        )
        // rim light champanhe no contorno externo
        drawArc(
            Color(0xFFD3B077).copy(alpha = 0.35f),
            startAngle = if (leftSide) 110f else 290f, sweepAngle = 100f, useCenter = false,
            topLeft = Offset(center.x - headR, center.y - headR),
            size = Size(headR * 2, headR * 2),
            style = Stroke(width = headR * 0.07f)
        )
        // especular principal (softbox)
        drawOval(
            Brush.radialGradient(
                listOf(Color.White.copy(alpha = 0.75f), Color.White.copy(alpha = 0f)),
                center = Offset(center.x - headR * 0.40f, center.y - headR * 0.45f), radius = headR * 0.42f
            ),
            topLeft = Offset(center.x - headR * 0.72f, center.y - headR * 0.72f),
            size = Size(headR * 0.64f, headR * 0.5f)
        )
        // catchlight pequeno
        drawCircle(
            Color.White.copy(alpha = 0.9f),
            radius = headR * 0.055f,
            center = Offset(center.x - headR * 0.18f, center.y - headR * 0.6f)
        )
    }
}

private fun smooth(t: Float): Float {
    val x = t.coerceIn(0f, 1f)
    return x * x * (3 - 2 * x)
}
