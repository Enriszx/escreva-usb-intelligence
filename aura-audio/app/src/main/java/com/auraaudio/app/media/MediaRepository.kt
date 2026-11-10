package com.auraaudio.app.media

import android.content.ComponentName
import android.content.Context
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.provider.Settings
import android.view.KeyEvent
import com.auraaudio.app.core.AuraLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Controle de reprodução que atua sobre QUALQUER player do Android:
 *
 *  Nível 1 (sempre disponível): teclas de mídia do sistema — exatamente o mesmo
 *  mecanismo que o TW982 usa via AVRCP quando você toca no fone.
 *
 *  Nível 2 (com acesso a notificações): MediaController das sessões ativas —
 *  metadados (música/artista), estado real e controle direto por sessão.
 */
class MediaRepository(private val context: Context) {

    data class MediaState(
        val listenerEnabled: Boolean = false,
        val activeApp: String? = null,
        val title: String? = null,
        val artist: String? = null,
        val album: String? = null,
        val isPlaying: Boolean = false,
        val positionMs: Long = -1,
        val durationMs: Long = -1,
        val volume: Int = 0,
        val maxVolume: Int = 15,
        val muted: Boolean = false
    )

    private val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val sessions = context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager

    private val _state = MutableStateFlow(MediaState())
    val state: StateFlow<MediaState> = _state.asStateFlow()

    private var controller: MediaController? = null
    private var callback: MediaController.Callback? = null

    fun isListenerEnabled(): Boolean {
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        return flat.split(":").any { it.contains(context.packageName) }
    }

    fun refresh() {
        val enabled = isListenerEnabled()
        var st = _state.value.copy(
            listenerEnabled = enabled,
            volume = audio.getStreamVolume(AudioManager.STREAM_MUSIC),
            maxVolume = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC),
            muted = audio.isStreamMute(AudioManager.STREAM_MUSIC)
        )
        if (enabled) {
            try {
                val list = sessions.getActiveSessions(ComponentName(context, AuraNotificationListener::class.java))
                val active = list.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: list.firstOrNull()
                attach(active)
                if (active != null) {
                    val md = active.metadata
                    val ps = active.playbackState
                    st = st.copy(
                        activeApp = active.packageName,
                        title = md?.getString(MediaMetadata.METADATA_KEY_TITLE),
                        artist = md?.getString(MediaMetadata.METADATA_KEY_ARTIST),
                        album = md?.getString(MediaMetadata.METADATA_KEY_ALBUM),
                        isPlaying = ps?.state == PlaybackState.STATE_PLAYING,
                        positionMs = ps?.position ?: -1,
                        durationMs = md?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: -1
                    )
                } else st = st.copy(activeApp = null, title = null, artist = null, album = null, isPlaying = false)
            } catch (e: SecurityException) {
                AuraLog.e("MEDIA", "getActiveSessions negado (acesso a notificações desativado)", e)
                st = st.copy(listenerEnabled = false)
            }
        }
        _state.value = st
    }

    private fun attach(c: MediaController?) {
        if (c?.sessionToken == controller?.sessionToken) return
        callback?.let { controller?.unregisterCallback(it) }
        controller = c
        if (c != null) {
            val cb = object : MediaController.Callback() {
                override fun onPlaybackStateChanged(state: PlaybackState?) = refresh()
                override fun onMetadataChanged(metadata: MediaMetadata?) = refresh()
            }
            callback = cb
            c.registerCallback(cb)
        }
    }

    // ---- Controles reais ----

    fun playPause() = transport(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) { c ->
        if (c.playbackState?.state == PlaybackState.STATE_PLAYING) c.transportControls.pause()
        else c.transportControls.play()
    }

    fun next() = transport(KeyEvent.KEYCODE_MEDIA_NEXT) { it.transportControls.skipToNext() }
    fun previous() = transport(KeyEvent.KEYCODE_MEDIA_PREVIOUS) { it.transportControls.skipToPrevious() }

    /**
     * Executa via MediaController quando houver sessão ativa; senão envia a tecla
     * de mídia global do sistema (o mesmo caminho que o AVRCP do fone usa).
     */
    private fun transport(fallbackKey: Int, block: (MediaController) -> Unit) {
        val c = controller
        if (c != null && isListenerEnabled()) {
            try { block(c); AuraLog.i("MEDIA", "Comando enviado à sessão ${c.packageName}"); refresh(); return }
            catch (e: Exception) { AuraLog.e("MEDIA", "Falha na sessão, usando tecla de mídia", e) }
        }
        dispatchKey(fallbackKey)
    }

    fun dispatchKey(keyCode: Int) {
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
        AuraLog.i("MEDIA", "Tecla de mídia enviada: $keyCode")
        refresh()
    }

    fun setVolume(value: Int) {
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, value.coerceIn(0, audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)), 0)
        refresh()
    }

    fun toggleMute() {
        audio.adjustStreamVolume(
            AudioManager.STREAM_MUSIC,
            if (audio.isStreamMute(AudioManager.STREAM_MUSIC)) AudioManager.ADJUST_UNMUTE else AudioManager.ADJUST_MUTE,
            0
        )
        refresh()
    }
}
