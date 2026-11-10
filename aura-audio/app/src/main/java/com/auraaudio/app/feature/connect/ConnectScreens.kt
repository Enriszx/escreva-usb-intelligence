package com.auraaudio.app.feature.connect

import android.content.Intent
import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.animations.Tw982Scene
import com.auraaudio.app.bluetooth.ConnectionState
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.AuraColors
import com.auraaudio.app.designsystem.InfoRow
import com.auraaudio.app.designsystem.LocalDarkTheme
import com.auraaudio.app.designsystem.StatusChip
import com.auraaudio.app.feature.common.AuraScaffold
import com.auraaudio.app.navigation.Routes
import kotlinx.coroutines.delay

@Composable
fun DeviceSearchScreen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val context = LocalContext.current
    var searching by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        container.tw982.start()
        container.tw982.refresh()
        delay(2000)
        searching = false
        container.settings.setOnboardingDone()
    }

    AuraScaffold(nav, "Buscar TW982") {
        Spacer(Modifier.height(20.dp))
        when {
            !state.adapterEnabled -> AuraCard {
                Column {
                    Text("Bluetooth desativado", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Ative o Bluetooth do telefone para localizar o HAVIT TW982.",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = { context.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) }) {
                        Text("Abrir ajustes Bluetooth")
                    }
                }
            }
            searching -> Column(Modifier.fillMaxWidth().padding(top = 60.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator()
                Spacer(Modifier.height(16.dp))
                Text("Procurando o HAVIT TW982 nos dispositivos pareados…", textAlign = TextAlign.Center)
            }
            state.bonded -> AuraCard {
                Column {
                    StatusChip("TW982 encontrado", AuraColors.Success)
                    Spacer(Modifier.height(12.dp))
                    InfoRow("Nome", state.deviceName ?: "—")
                    InfoRow("Endereço", state.address ?: "—")
                    InfoRow("Pareamento", state.bondState)
                    Spacer(Modifier.height(14.dp))
                    Button(onClick = { nav.navigate(Routes.CONNECTING) { popUpTo(Routes.SEARCH) { inclusive = true } } },
                        modifier = Modifier.fillMaxWidth()) {
                        Text("Continuar")
                    }
                }
            }
            else -> AuraCard {
                Column {
                    Text("TW982 não encontrado", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Nenhum dispositivo pareado com nome \"TW982\" ou \"LIFE 01T\" foi localizado. " +
                            "O pareamento inicial é feito pelos ajustes do Android (exigência de segurança do sistema).",
                        style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = { nav.navigate(Routes.PAIRING) }) { Text("Como parear") }
                    Spacer(Modifier.height(6.dp))
                    TextButton(onClick = {
                        searching = true
                        container.tw982.refresh()
                        searching = false
                    }) { Text("Procurar novamente") }
                }
            }
        }
    }
}

@Composable
fun DevicePairingScreen(nav: NavController) {
    val context = LocalContext.current
    AuraScaffold(nav, "Parear o TW982") {
        Spacer(Modifier.height(12.dp))
        val steps = listOf(
            "1" to "Abra o estojo do TW982 com os dois fones dentro. O LED indica que entraram em modo de pareamento (primeira vez) ou reconexão.",
            "2" to "No telefone, abra Ajustes → Conexões → Bluetooth.",
            "3" to "Toque em \"HAVIT TW982\" (ou \"LIFE 01T\") na lista de dispositivos disponíveis.",
            "4" to "Confirme o pareamento. O Android gerencia a segurança dessa etapa.",
            "5" to "Volte ao AURA AUDIO — a detecção é automática."
        )
        steps.forEach { (n, text) ->
            AuraCard(modifier = Modifier.padding(vertical = 6.dp)) {
                Column {
                    Text("PASSO $n", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(4.dp))
                    Text(text, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Button(
            onClick = { context.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS)) },
            modifier = Modifier.fillMaxWidth().height(52.dp)
        ) { Text("Abrir ajustes Bluetooth") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = { nav.popBackStack() }, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text("Já pareei — voltar à busca")
        }
        Spacer(Modifier.height(20.dp))
    }
}

/**
 * Tela de conexão: a assinatura visual do AURA AUDIO.
 * O estojo abre, os fones sobem e flutuam enquanto a identificação Bluetooth real acontece.
 */
@Composable
fun ConnectingScreen(nav: NavController, container: AppContainer) {
    val state by container.tw982.state.collectAsState()
    val dark = LocalDarkTheme.current
    val progress = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        container.tw982.start()
        container.tw982.refresh()
        progress.animateTo(1f, tween(2600))
        delay(700)
        nav.navigate(Routes.HOME) { popUpTo(Routes.CONNECTING) { inclusive = true } }
    }

    Box(Modifier.fillMaxSize()) {
        Tw982Scene(
            openProgress = progress.value,
            floating = progress.value > 0.9f,
            dark = dark,
            ledOn = state.connection == ConnectionState.CONNECTED
        )
        Column(
            Modifier.align(Alignment.BottomCenter).padding(bottom = 70.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text("HAVIT TW982", style = MaterialTheme.typography.headlineSmall)
            when {
                !state.adapterEnabled -> StatusChip("Bluetooth desativado", AuraColors.Warning)
                state.connection == ConnectionState.CONNECTED -> StatusChip("Conectado", AuraColors.Success)
                state.bonded -> StatusChip("Pareado — aguardando conexão", AuraColors.Warning)
                else -> StatusChip("Não pareado", MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
