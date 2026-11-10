package com.auraaudio.app.audio

import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer
import com.auraaudio.app.core.AuraLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Motor de equalização do AURA AUDIO.
 *
 * NÍVEL REAL IMPLEMENTADO: processamento na mixagem global de saída do Android
 * (android.media.audiofx na sessão 0). O áudio já equalizado segue ao TW982 por A2DP,
 * valendo para players externos na maioria dos aparelhos (inclusive Samsung).
 *
 * LIMITAÇÕES HONESTAS (exibidas na UI):
 *  - Não altera o DSP interno do fone (não há protocolo público do AB5656 p/ isso).
 *  - Alguns players com saída "offload" podem ignorar efeitos globais.
 *  - O número de bandas é o que o hardware de áudio do telefone reporta (tipicamente 5).
 */
class EqEngine {

    data class Band(val index: Int, val centerFreqHz: Int, val levelMb: Int, val minMb: Int, val maxMb: Int)

    data class EqState(
        val available: Boolean = false,
        val unavailableReason: String? = null,
        val enabled: Boolean = false,
        val bands: List<Band> = emptyList(),
        val bassAvailable: Boolean = false,
        val bassStrength: Int = 0,          // 0..1000
        val virtAvailable: Boolean = false,
        val virtStrength: Int = 0,          // 0..1000
        val loudAvailable: Boolean = false,
        val loudGainMb: Int = 0,            // 0..1000 mB
        val activePreset: String = "Original"
    )

    private var eq: Equalizer? = null
    private var bass: BassBoost? = null
    private var virt: Virtualizer? = null
    private var loud: LoudnessEnhancer? = null

    private val _state = MutableStateFlow(EqState())
    val state: StateFlow<EqState> = _state.asStateFlow()

    /** Cria os efeitos na sessão global. Retorna true se o equalizador existir de verdade. */
    fun init(): Boolean {
        if (eq != null) return true
        try {
            eq = Equalizer(900, 0)
        } catch (e: Exception) {
            AuraLog.e("EQ", "Equalizer global indisponível neste aparelho", e)
            _state.value = EqState(available = false, unavailableReason = "O Android deste aparelho não permitiu criar o equalizador global (${e.javaClass.simpleName}).")
            return false
        }
        bass = runCatching { BassBoost(900, 0) }.onFailure { AuraLog.e("EQ", "BassBoost indisponível") }.getOrNull()
        virt = runCatching { Virtualizer(900, 0) }.onFailure { AuraLog.e("EQ", "Virtualizer indisponível") }.getOrNull()
        loud = runCatching { LoudnessEnhancer(0) }.onFailure { AuraLog.e("EQ", "LoudnessEnhancer indisponível") }.getOrNull()
        AuraLog.i("EQ", "Efeitos criados: eq=ok bass=${bass != null} virt=${virt != null} loud=${loud != null}")
        publish()
        return true
    }

    private fun publish() {
        val e = eq ?: return
        val range = try { e.bandLevelRange } catch (_: Exception) { shortArrayOf(-1500, 1500) }
        val bands = (0 until (try { e.numberOfBands.toInt() } catch (_: Exception) { 0 })).map { i ->
            Band(
                index = i,
                centerFreqHz = try { e.getCenterFreq(i.toShort()) / 1000 } catch (_: Exception) { 0 },
                levelMb = try { e.getBandLevel(i.toShort()).toInt() } catch (_: Exception) { 0 },
                minMb = range[0].toInt(),
                maxMb = range[1].toInt()
            )
        }
        _state.value = _state.value.copy(
            available = true,
            unavailableReason = null,
            enabled = try { e.enabled } catch (_: Exception) { false },
            bands = bands,
            bassAvailable = bass?.strengthSupported == true,
            bassStrength = try { bass?.roundedStrength?.toInt() ?: 0 } catch (_: Exception) { 0 },
            virtAvailable = virt?.strengthSupported == true,
            virtStrength = try { virt?.roundedStrength?.toInt() ?: 0 } catch (_: Exception) { 0 },
            loudAvailable = loud != null,
            loudGainMb = try { loud?.targetGain?.toInt() ?: 0 } catch (_: Exception) { 0 }
        )
    }

    fun setEnabled(on: Boolean) {
        val e = eq ?: return
        try {
            e.enabled = on
            bass?.enabled = on && _state.value.bassStrength > 0
            virt?.enabled = on && _state.value.virtStrength > 0
            loud?.enabled = on && _state.value.loudGainMb > 0
            AuraLog.i("EQ", "Equalização ${if (on) "ativada" else "desativada"}")
        } catch (ex: Exception) { AuraLog.e("EQ", "setEnabled", ex) }
        publish()
    }

    fun setBandLevel(index: Int, levelMb: Int) {
        val e = eq ?: return
        try {
            e.setBandLevel(index.toShort(), levelMb.toShort())
            _state.value = _state.value.copy(activePreset = "Custom")
        } catch (ex: Exception) { AuraLog.e("EQ", "setBandLevel b$index", ex) }
        publish()
    }

    fun setBass(strength: Int) {
        try {
            bass?.setStrength(strength.coerceIn(0, 1000).toShort())
            bass?.enabled = strength > 0 && _state.value.enabled
        } catch (ex: Exception) { AuraLog.e("EQ", "setBass", ex) }
        publish()
    }

    fun setVirtualizer(strength: Int) {
        try {
            virt?.setStrength(strength.coerceIn(0, 1000).toShort())
            virt?.enabled = strength > 0 && _state.value.enabled
        } catch (ex: Exception) { AuraLog.e("EQ", "setVirtualizer", ex) }
        publish()
    }

    fun setLoudness(gainMb: Int) {
        try {
            loud?.setTargetGain(gainMb.coerceIn(0, 1000))
            loud?.enabled = gainMb > 0 && _state.value.enabled
        } catch (ex: Exception) { AuraLog.e("EQ", "setLoudness", ex) }
        publish()
    }

    /** Aplica um preset por curva de frequência (dB por faixa), adaptado às bandas reais do aparelho. */
    fun applyPreset(preset: EqPresets.Preset) {
        val e = eq ?: return
        val st = _state.value
        st.bands.forEach { band ->
            val gainDb = EqPresets.gainAt(preset, band.centerFreqHz)
            val mb = (gainDb * 100).toInt().coerceIn(band.minMb, band.maxMb)
            try { e.setBandLevel(band.index.toShort(), mb.toShort()) } catch (_: Exception) {}
        }
        setBass(preset.bass)
        setVirtualizer(preset.virtualizer)
        setLoudness(preset.loudness)
        _state.value = _state.value.copy(activePreset = preset.name)
        AuraLog.i("EQ", "Preset aplicado: ${preset.name}")
        publish()
    }

    fun reset() {
        val e = eq ?: return
        _state.value.bands.forEach { band ->
            try { e.setBandLevel(band.index.toShort(), 0) } catch (_: Exception) {}
        }
        setBass(0); setVirtualizer(0); setLoudness(0)
        _state.value = _state.value.copy(activePreset = "Original")
        publish()
    }

    fun currentLevels(): List<Int> = _state.value.bands.map { it.levelMb }

    fun applyLevels(levels: List<Int>, bassS: Int, virtS: Int, loudG: Int, presetName: String) {
        val e = eq ?: return
        levels.forEachIndexed { i, mb ->
            if (i < _state.value.bands.size) try { e.setBandLevel(i.toShort(), mb.toShort()) } catch (_: Exception) {}
        }
        setBass(bassS); setVirtualizer(virtS); setLoudness(loudG)
        _state.value = _state.value.copy(activePreset = presetName)
        publish()
    }

    fun release() {
        runCatching { eq?.release() }; runCatching { bass?.release() }
        runCatching { virt?.release() }; runCatching { loud?.release() }
        eq = null; bass = null; virt = null; loud = null
    }
}
