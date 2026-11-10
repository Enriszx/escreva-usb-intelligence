package com.auraaudio.app.feature.onboarding

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.auraaudio.app.AppContainer
import com.auraaudio.app.animations.Tw982Scene
import com.auraaudio.app.core.Permissions
import com.auraaudio.app.data.AuraSettings
import com.auraaudio.app.designsystem.AuraCard
import com.auraaudio.app.designsystem.LocalDarkTheme
import com.auraaudio.app.navigation.Routes
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(nav: NavController, container: AppContainer) {
    val settings by container.settings.settings.collectAsState(initial = null)
    var visible by remember { mutableStateOf(false) }
    val alpha by animateFloatAsState(if (visible) 1f else 0f, tween(800), label = "splash")

    LaunchedEffect(settings) {
        if (settings == null) return@LaunchedEffect
        visible = true
        delay(1400)
        val next = if (settings!!.onboardingDone) Routes.CONNECTING else Routes.WELCOME
        nav.navigate(next) { popUpTo(Routes.SPLASH) { inclusive = true } }
    }

    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.alpha(alpha)) {
            Text("AURA", style = MaterialTheme.typography.displayLarge, color = MaterialTheme.colorScheme.onBackground)
            Spacer(Modifier.height(10.dp))
            Box(
                Modifier
                    .width(44.dp)
                    .height(1.dp)
                    .background(MaterialTheme.colorScheme.primary)
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "A U D I O",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.height(26.dp))
            Text(
                "HAVIT TW982 · LIFE 01T",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun WelcomeScreen(nav: NavController) {
    val dark = LocalDarkTheme.current
    Column(Modifier.fillMaxSize().padding(24.dp)) {
        Box(Modifier.weight(1f)) {
            Tw982Scene(openProgress = 1f, floating = true, dark = dark, ledOn = true)
        }
        Text("Bem-vindo ao AURA AUDIO", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(10.dp))
        Text(
            "A central definitiva do seu HAVIT TW982. Conexão, bateria, equalização, " +
                "controles, diagnóstico — tudo em um único lugar, com dados reais do dispositivo.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = { nav.navigate(Routes.PERMISSIONS) }, modifier = Modifier.fillMaxWidth().height(54.dp)) {
            Text("Começar")
        }
        Spacer(Modifier.height(10.dp))
    }
}

@Composable
fun PermissionsScreen(nav: NavController, container: AppContainer) {
    val context = LocalContext.current
    var refreshKey by remember { mutableStateOf(0) }

    val btGranted = remember(refreshKey) { Permissions.hasBluetooth(context) }
    val micGranted = remember(refreshKey) { Permissions.hasRecordAudio(context) }
    val notifGranted = remember(refreshKey) { Permissions.hasNotifications(context) }
    val locGranted = remember(refreshKey) { Permissions.hasLocation(context) }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        refreshKey++
        if (Permissions.hasBluetooth(context)) container.tw982.start()
    }

    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text("Permissões", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            "O AURA AUDIO usa apenas o necessário para controlar o TW982. Cada permissão tem um propósito claro:",
            style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(20.dp))

        PermissionRow(Icons.Filled.Bluetooth, "Bluetooth", "Detectar, conectar e diagnosticar o TW982 (essencial)", btGranted) {
            launcher.launch(Permissions.bluetoothPermissions().toTypedArray())
        }
        PermissionRow(Icons.Filled.Notifications, "Notificações", "Alertas de conexão e bateria baixa", notifGranted) {
            if (android.os.Build.VERSION.SDK_INT >= 33) launcher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }
        PermissionRow(Icons.Filled.Mic, "Microfone", "Teste do microfone do fone (opcional)", micGranted) {
            launcher.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
        }
        PermissionRow(Icons.Filled.LocationOn, "Localização", "Registrar onde o telefone estava na desconexão (opcional)", locGranted) {
            launcher.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
        }

        Spacer(Modifier.height(26.dp))
        Button(
            onClick = { nav.navigate(Routes.SEARCH) },
            enabled = btGranted,
            modifier = Modifier.fillMaxWidth().height(54.dp)
        ) { Text(if (btGranted) "Continuar" else "Conceda o Bluetooth para continuar") }
        TextButton(onClick = { refreshKey++ }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("Atualizar estado")
        }
    }
}

@Composable
private fun PermissionRow(icon: ImageVector, title: String, desc: String, granted: Boolean, onRequest: () -> Unit) {
    AuraCard(modifier = Modifier.padding(vertical = 6.dp), onClick = if (granted) null else onRequest) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(26.dp))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                Text(desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (granted) {
                Surface(shape = androidx.compose.foundation.shape.CircleShape, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)) {
                    Icon(Icons.Filled.Check, null, Modifier.padding(6.dp).size(16.dp), tint = MaterialTheme.colorScheme.primary)
                }
            } else {
                Text("Permitir", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}
