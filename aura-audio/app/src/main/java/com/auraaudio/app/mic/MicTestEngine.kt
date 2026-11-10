package com.auraaudio.app.mic

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import com.auraaudio.app.core.AuraLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.io.RandomAccessFile
import kotlin.math.abs

/**
 * Teste real do microfone do TW982 pela rota de voz Bluetooth (HFP/SCO).
 *
 * Fluxo: ativa a rota de comunicação Bluetooth -> grava WAV 16 kHz mono ->
 * desativa a rota -> reproduz a amostra (pela rota normal A2DP).
 * A UI mostra qual dispositivo de entrada foi usado de verdade.
 */
class MicTestEngine(private val context: Context, private val scope: CoroutineScope) {

    enum class Phase { IDLE, ROUTING, RECORDING, SAVED, PLAYING, ERROR }

    data class MicState(
        val phase: Phase = Phase.IDLE,
        val message: String = "Pronto",
        val inputDevice: String? = null,
        val scoActive: Boolean = false,
        val levelPercent: Int = 0,
        val sampleFile: String? = null,
        val durationSec: Int = 0
    )

    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val _state = MutableStateFlow(MicState())
    val state: StateFlow<MicState> = _state.asStateFlow()

    private var job: Job? = null
    private var player: MediaPlayer? = null
    private val sampleRate = 16000

    fun bluetoothInputAvailable(): Boolean =
        audio.getDevices(AudioManager.GET_DEVICES_INPUTS).any { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }

    fun inputDevices(): List<String> =
        audio.getDevices(AudioManager.GET_DEVICES_INPUTS).map { "${it.productName} (${typeName(it.type)})" }

    fun outputDevices(): List<String> =
        audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS).map { "${it.productName} (${typeName(it.type)})" }

    private fun typeName(t: Int) = when (t) {
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth SCO"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth A2DP"
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "Microfone interno"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Alto-falante"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Fone com fio"
        else -> "tipo $t"
    }

    @SuppressLint("MissingPermission")
    fun record(seconds: Int = 5) {
        if (_state.value.phase == Phase.RECORDING || _state.value.phase == Phase.ROUTING) return
        job = scope.launch(Dispatchers.IO) {
            var scoStarted = false
            var record: AudioRecord? = null
            try {
                set(Phase.ROUTING, "Ativando rota de voz Bluetooth (HFP/SCO)…")
                val btDevice = audio.getDevices(AudioManager.GET_DEVICES_INPUTS)
                    .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }

                if (btDevice != null) {
                    if (Build.VERSION.SDK_INT >= 31) {
                        scoStarted = audio.setCommunicationDevice(btDevice)
                        AuraLog.i("MIC", "setCommunicationDevice(${btDevice.productName}) => $scoStarted")
                    } else {
                        @Suppress("DEPRECATION")
                        audio.startBluetoothSco()
                        @Suppress("DEPRECATION")
                        audio.isBluetoothScoOn = true
                        scoStarted = true
                    }
                    // SCO leva um instante para abrir
                    delay(1200)
                } else {
                    AuraLog.i("MIC", "Nenhuma entrada SCO Bluetooth — gravação usará o microfone disponível")
                }

                val minBuf = AudioRecord.getMinBufferSize(sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
                record = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
                    maxOf(minBuf * 2, 8192)
                )
                if (record.state != AudioRecord.STATE_INITIALIZED) throw IllegalStateException("AudioRecord não inicializou")

                if (Build.VERSION.SDK_INT >= 31 && btDevice != null) record.preferredDevice = btDevice

                val dir = File(context.cacheDir, "mic").apply { mkdirs() }
                val wav = File(dir, "amostra_tw982.wav")
                val raf = RandomAccessFile(wav, "rw")
                raf.setLength(0)
                writeWavHeader(raf, 0)

                record.startRecording()
                val routed = record.routedDevice
                set(Phase.RECORDING, "Gravando ${seconds}s…",
                    input = routed?.let { "${it.productName} (${typeName(it.type)})" },
                    sco = scoStarted)
                AuraLog.i("MIC", "Entrada roteada: ${routed?.productName} tipo=${routed?.type}")

                val buf = ShortArray(2048)
                var total = 0
                val targetSamples = sampleRate * seconds
                while (total < targetSamples && _state.value.phase == Phase.RECORDING) {
                    val n = record.read(buf, 0, buf.size)
                    if (n > 0) {
                        val bytes = ByteArray(n * 2)
                        for (i in 0 until n) {
                            bytes[i * 2] = (buf[i].toInt() and 0xFF).toByte()
                            bytes[i * 2 + 1] = ((buf[i].toInt() shr 8) and 0xFF).toByte()
                        }
                        raf.write(bytes)
                        total += n
                        val peak = (0 until n).maxOf { abs(buf[it].toInt()) }
                        _state.value = _state.value.copy(levelPercent = (peak * 100 / 32767).coerceIn(0, 100))
                    }
                }
                record.stop()
                writeWavHeader(raf, total * 2)
                raf.close()
                set(Phase.SAVED, "Amostra gravada (${total / sampleRate}s). Toque em reproduzir para ouvir.",
                    file = wav.absolutePath, dur = total / sampleRate)
            } catch (e: Exception) {
                AuraLog.e("MIC", "Falha no teste de microfone", e)
                set(Phase.ERROR, "Erro: ${e.message}")
            } finally {
                runCatching { record?.release() }
                if (scoStarted) {
                    if (Build.VERSION.SDK_INT >= 31) audio.clearCommunicationDevice()
                    else {
                        @Suppress("DEPRECATION") audio.stopBluetoothSco()
                        @Suppress("DEPRECATION") audio.isBluetoothScoOn = false
                    }
                }
            }
        }
    }

    fun stopRecording() {
        if (_state.value.phase == Phase.RECORDING) _state.value = _state.value.copy(phase = Phase.SAVED)
    }

    fun play() {
        val f = _state.value.sampleFile ?: return
        try {
            player?.release()
            player = MediaPlayer().apply {
                setDataSource(f)
                prepare()
                setOnCompletionListener { set(Phase.SAVED, "Reprodução concluída") }
                start()
            }
            set(Phase.PLAYING, "Reproduzindo amostra pelo dispositivo de saída atual…")
        } catch (e: Exception) {
            AuraLog.e("MIC", "Reprodução falhou", e)
            set(Phase.ERROR, "Erro ao reproduzir: ${e.message}")
        }
    }

    fun cancel() {
        job?.cancel()
        player?.release(); player = null
        _state.value = MicState()
    }

    private fun set(p: Phase, msg: String, input: String? = _state.value.inputDevice,
                    sco: Boolean = _state.value.scoActive, file: String? = _state.value.sampleFile,
                    dur: Int = _state.value.durationSec) {
        _state.value = _state.value.copy(phase = p, message = msg, inputDevice = input, scoActive = sco, sampleFile = file, durationSec = dur)
    }

    private fun writeWavHeader(raf: RandomAccessFile, dataLen: Int) {
        val byteRate = sampleRate * 2
        raf.seek(0)
        raf.write("RIFF".toByteArray())
        raf.write(intLE(36 + dataLen))
        raf.write("WAVE".toByteArray())
        raf.write("fmt ".toByteArray())
        raf.write(intLE(16)); raf.write(shortLE(1)); raf.write(shortLE(1))
        raf.write(intLE(sampleRate)); raf.write(intLE(byteRate))
        raf.write(shortLE(2)); raf.write(shortLE(16))
        raf.write("data".toByteArray())
        raf.write(intLE(dataLen))
        raf.seek(44 + dataLen.toLong())
    }

    private fun intLE(v: Int) = byteArrayOf((v and 0xFF).toByte(), ((v shr 8) and 0xFF).toByte(), ((v shr 16) and 0xFF).toByte(), ((v shr 24) and 0xFF).toByte())
    private fun shortLE(v: Int) = byteArrayOf((v and 0xFF).toByte(), ((v shr 8) and 0xFF).toByte())
}
