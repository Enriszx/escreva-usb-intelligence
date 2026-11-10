package com.auraaudio.app.feature.playback

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.SectionLabel
import com.auraaudio.app.feature.common.AuraScaffold
import kotlinx.coroutines.delay

@Composable
fun PlaybackScreen(nav: NavController, container: AppContainer) {
    val media by container.media.state.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        while (true) {
            container.media.refresh()
            delay(1500)
        }
    }

    AuraScaffold(nav, "Playback") {
        Spacer(Modifier.height(8.dp))

        // Mídia atual
        AuraCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                if (media.listenerEnabled && media.title != null) {
                    Text(media.title!!, style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
                    Text(
                        listOfNotNull(media.artist, media.album).joinToString(" — "),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        "via ${media.activeApp}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else if (media.listenerEnabled) {
                    Text("Nenhuma sessão de mídia ativa", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Inicie uma música em qualquer app — os controles funcionam mesmo assim.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                } else {
                    Text("Metadados indisponíveis", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Os controles abaixo já funcionam (tecla de mídia global). Para ver música, artista e estado " +
                            "em tempo real, conceda ao AURA AUDIO o acesso a notificações:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = {
                        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                    }) { Text("Conceder acesso a notificações") }
                }

                Spacer(Modifier.height(18.dp))
                Row(horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { container.media.previous() }, modifier = Modifier.size(56.dp)) {
                        Icon(Icons.Filled.SkipPrevious, "Anterior", Modifier.size(34.dp))
                    }
                    Spacer(Modifier.width(18.dp))
                    FilledIconButton(
                        onClick = { container.media.playPause() },
                        modifier = Modifier.size(76.dp),
                        colors = IconButtonDefaults.filledIconButtonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        Icon(
                            if (media.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            "Play/Pause", Modifier.size(40.dp)
                        )
                    }
                    Spacer(Modifier.width(18.dp))
                    IconButton(onClick = { container.media.next() }, modifier = Modifier.size(56.dp)) {
                        Icon(Icons.Filled.SkipNext, "Próxima", Modifier.size(34.dp))
                    }
                }
            }
        }

        // Volume
        SectionLabel("Volume", Modifier.padding(top = 14.dp))
        AuraCard {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = { container.media.toggleMute() }) {
                        Icon(
                            if (media.muted) Icons.Filled.VolumeOff else Icons.Filled.VolumeUp,
                            "Silenciar",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                    Slider(
                        value = media.volume.toFloat(),
                        onValueChange = { container.media.setVolume(it.toInt()) },
                        valueRange = 0f..media.maxVolume.toFloat(),
                        steps = media.maxVolume - 1,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        "${media.volume}/${media.maxVolume}",
                        style = MaterialTheme.typography.labelLarge,
                        modifier = Modifier.width(48.dp),
                        textAlign = TextAlign.End
                    )
                }
                Text(
                    "Volume de mídia do sistema — o mesmo que o TW982 controla via AVRCP.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        SectionLabel("Como funciona", Modifier.padding(top = 14.dp))
        AuraCard {
            Text(
                "Os botões enviam comandos reais ao player ativo: com acesso a notificações, direto à sessão de mídia " +
                    "(MediaController); sem ele, pela tecla de mídia global do Android — o mesmo caminho usado pelos " +
                    "toques do TW982 via AVRCP. Funciona com Spotify, YouTube Music e qualquer player compatível.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}
