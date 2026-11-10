package com.auraaudio.app.audio

import kotlin.math.abs
import kotlin.math.ln

/**
 * Presets do AURA AUDIO definidos como curvas de ganho (dB) por frequência de referência.
 * São adaptados dinamicamente às bandas reais que o hardware de áudio do telefone expõe,
 * por interpolação logarítmica — nada é fixado em bandas que talvez não existam.
 */
object EqPresets {

    data class Preset(
        val name: String,
        /** pares (frequência Hz, ganho dB) em ordem crescente */
        val curve: List<Pair<Int, Float>>,
        val bass: Int = 0,         // BassBoost 0..1000
        val virtualizer: Int = 0,  // 0..1000
        val loudness: Int = 0      // mB 0..1000
    )

    val all: List<Preset> = listOf(
        Preset("Original", listOf(60 to 0f, 230 to 0f, 910 to 0f, 3600 to 0f, 14000 to 0f)),
        Preset("Balanced", listOf(60 to 1.5f, 230 to 0.5f, 910 to 0f, 3600 to 1f, 14000 to 1.5f)),
        Preset("Deep Bass", listOf(60 to 5f, 230 to 3f, 910 to -0.5f, 3600 to 0f, 14000 to 1f), bass = 500),
        Preset("Extra Bass", listOf(60 to 7f, 230 to 4.5f, 910 to -1f, 3600 to 0f, 14000 to 1.5f), bass = 750),
        Preset("Vocal", listOf(60 to -1.5f, 230 to 0f, 910 to 3f, 3600 to 4f, 14000 to 1.5f)),
        Preset("Pop", listOf(60 to 2f, 230 to 1f, 910 to 0f, 3600 to 2f, 14000 to 3f)),
        Preset("Rock", listOf(60 to 4f, 230 to 2f, 910 to -1f, 3600 to 2.5f, 14000 to 3.5f)),
        Preset("Electronic", listOf(60 to 5f, 230 to 2f, 910 to -1f, 3600 to 1.5f, 14000 to 4f), bass = 400, virtualizer = 300),
        Preset("Classical", listOf(60 to 2f, 230 to 0f, 910 to -1f, 3600 to 1f, 14000 to 2.5f)),
        Preset("Jazz", listOf(60 to 2.5f, 230 to 1f, 910 to 0f, 3600 to 1.5f, 14000 to 2f)),
        Preset("Acoustic", listOf(60 to 2f, 230 to 1.5f, 910 to 1f, 3600 to 2f, 14000 to 1.5f)),
        Preset("Studio", listOf(60 to 0.5f, 230 to 0f, 910 to 0f, 3600 to 0.5f, 14000 to 1f)),
        Preset("Podcast", listOf(60 to -3f, 230 to 1f, 910 to 4f, 3600 to 4.5f, 14000 to 0f), loudness = 300),
        Preset("Gaming", listOf(60 to 4f, 230 to 1f, 910 to 0f, 3600 to 3.5f, 14000 to 3f), virtualizer = 500)
    )

    fun byName(name: String): Preset? = all.firstOrNull { it.name == name }

    /** Interpolação log-linear do ganho da curva na frequência pedida. */
    fun gainAt(preset: Preset, freqHz: Int): Float {
        val c = preset.curve
        if (c.isEmpty() || freqHz <= 0) return 0f
        if (freqHz <= c.first().first) return c.first().second
        if (freqHz >= c.last().first) return c.last().second
        for (i in 0 until c.size - 1) {
            val (f0, g0) = c[i]; val (f1, g1) = c[i + 1]
            if (freqHz in f0..f1) {
                val t = (ln(freqHz.toFloat() / f0) / ln(f1.toFloat() / f0))
                return g0 + (g1 - g0) * t
            }
        }
        return 0f
    }
}
