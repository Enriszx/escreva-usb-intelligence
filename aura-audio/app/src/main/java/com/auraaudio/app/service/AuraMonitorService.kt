package com.auraaudio.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import com.auraaudio.app.AuraApplication
import com.auraaudio.app.MainActivity
import com.auraaudio.app.core.AuraLog
import com.auraaudio.app.core.Permissions
import com.auraaudio.app.data.ConnectionEventEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Serviço opcional em primeiro plano (tipo connectedDevice).
 * Observa eventos reais do TW982, grava histórico (com a posição do TELEFONE,
 * se permitido) e dispara notificações de conexão/desconexão/bateria baixa.
 */
class AuraMonitorService : Service() {

    companion object {
        const val CHANNEL_MONITOR = "aura_monitor"
        const val CHANNEL_EVENTS = "aura_events"
        const val NOTIF_ID = 41

        fun start(context: Context) {
            val i = Intent(context, AuraMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(i) else context.startService(i)
        }
        fun stop(context: Context) = context.stopService(Intent(context, AuraMonitorService::class.java))
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var lowBatteryNotified = false

    override fun onCreate() {
        super.onCreate()
        createChannels()
        startForegroundCompat()
        val app = application as AuraApplication
        val container = app.container

        scope.launch {
            container.tw982.events.collect { ev ->
                val settings = container.settings.settings.first()
                val battery = container.tw982.state.value.batteryLevel
                val loc = if (ev.type == "DISCONNECTED") lastPhoneLocation() else null
                container.db.dao().insertEvent(
                    ConnectionEventEntity(
                        timestamp = ev.timestamp, type = ev.type,
                        deviceName = ev.name, address = ev.address,
                        batteryLevel = battery,
                        latitude = loc?.first, longitude = loc?.second
                    )
                )
                if (settings.connectionNotifications && Permissions.hasNotifications(this@AuraMonitorService)) {
                    notifyEvent(
                        if (ev.type == "CONNECTED") "TW982 conectado" else "TW982 desconectado",
                        ev.name ?: "HAVIT TW982"
                    )
                }
                if (ev.type == "CONNECTED") lowBatteryNotified = false
            }
        }

        scope.launch {
            container.tw982.state.collect { st ->
                val settings = container.settings.settings.first()
                if (settings.batteryAlertEnabled && st.batteryLevel in 1..settings.batteryAlertThreshold &&
                    !lowBatteryNotified && Permissions.hasNotifications(this@AuraMonitorService)
                ) {
                    lowBatteryNotified = true
                    notifyEvent("Bateria baixa no TW982", "Nível reportado: ${st.batteryLevel}%")
                }
                if (st.batteryLevel > settings.batteryAlertThreshold + 10) lowBatteryNotified = false
            }
        }
        AuraLog.i("SVC", "Monitor em primeiro plano iniciado")
    }

    private fun lastPhoneLocation(): Pair<Double, Double>? {
        if (!Permissions.hasLocation(this)) return null
        return try {
            val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val loc = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            loc?.let { it.latitude to it.longitude }
        } catch (_: SecurityException) { null } catch (_: Exception) { null }
    }

    private fun createChannels() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MONITOR, "Monitoramento do TW982", NotificationManager.IMPORTANCE_MIN)
                .apply { description = "Serviço em segundo plano do AURA AUDIO" }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_EVENTS, "Eventos do TW982", NotificationManager.IMPORTANCE_DEFAULT)
                .apply { description = "Conexão, desconexão e bateria baixa" }
        )
    }

    private fun startForegroundCompat() {
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val n: Notification = Notification.Builder(this, CHANNEL_MONITOR)
            .setContentTitle("AURA AUDIO")
            .setContentText("Monitorando o HAVIT TW982")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else startForeground(NOTIF_ID, n)
    }

    private fun notifyEvent(title: String, text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        val n = Notification.Builder(this, CHANNEL_EVENTS)
            .setContentTitle(title).setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setAutoCancel(true)
            .build()
        nm.notify((System.currentTimeMillis() % 10000).toInt() + 100, n)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() {
        scope.cancel()
        AuraLog.i("SVC", "Monitor encerrado")
        super.onDestroy()
    }
}
