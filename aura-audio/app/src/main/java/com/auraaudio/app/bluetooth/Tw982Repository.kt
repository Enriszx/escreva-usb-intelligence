package com.auraaudio.app.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHeadset
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.ParcelUuid
import com.auraaudio.app.core.AuraLog
import com.auraaudio.app.core.Permissions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Fonte única de verdade sobre o estado do HAVIT TW982.
 *
 * Tudo aqui vem de eventos reais do sistema:
 *  - ACTION_ACL_CONNECTED / DISCONNECTED (conexão física)
 *  - proxies A2DP/HFP (estado por perfil)
 *  - ACTION_BATTERY_LEVEL_CHANGED + BluetoothDevice#getBatteryLevel (telemetria HFP)
 *  - ACTION_UUID / fetchUuidsWithSdp (serviços SDP)
 *
 * Nenhum valor é inventado: quando algo não é reportado, o estado publica "indisponível".
 */
@SuppressLint("MissingPermission")
class Tw982Repository(private val context: Context, private val scope: CoroutineScope) {

    companion object {
        // Broadcast oculto, mas estável desde o Android 8 — usado por launchers/Settings da Samsung.
        const val ACTION_BATTERY_LEVEL = "android.bluetooth.device.action.BATTERY_LEVEL_CHANGED"
        const val EXTRA_BATTERY_LEVEL = "android.bluetooth.device.extra.BATTERY_LEVEL"
    }

    private val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    val adapter: BluetoothAdapter? get() = manager.adapter

    private val _state = MutableStateFlow(Tw982State())
    val state: StateFlow<Tw982State> = _state.asStateFlow()

    /** Eventos pontuais (conectou/desconectou) para histórico e notificações. */
    data class Event(val type: String, val name: String?, val address: String?, val timestamp: Long = System.currentTimeMillis())
    val events = MutableSharedFlow<Event>(extraBufferCapacity = 16)

    private var a2dpProxy: BluetoothA2dp? = null
    private var hfpProxy: BluetoothHeadset? = null
    private var receiverRegistered = false

    fun start() {
        if (receiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
            addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
            addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
            addAction(BluetoothDevice.ACTION_UUID)
            addAction(ACTION_BATTERY_LEVEL)
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
            addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED)
        }
        context.registerReceiver(receiver, filter)
        receiverRegistered = true
        bindProfiles()
        refresh()
        AuraLog.i("BT", "Monitoramento Bluetooth iniciado")
    }

    private fun bindProfiles() {
        val ad = adapter ?: return
        ad.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                if (profile == BluetoothProfile.A2DP) a2dpProxy = proxy as BluetoothA2dp
                if (profile == BluetoothProfile.HEADSET) hfpProxy = proxy as BluetoothHeadset
                refresh()
            }
            override fun onServiceDisconnected(profile: Int) {
                if (profile == BluetoothProfile.A2DP) a2dpProxy = null
                if (profile == BluetoothProfile.HEADSET) hfpProxy = null
            }
        }, BluetoothProfile.A2DP)
        ad.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                if (profile == BluetoothProfile.HEADSET) hfpProxy = proxy as BluetoothHeadset
                refresh()
            }
            override fun onServiceDisconnected(profile: Int) { if (profile == BluetoothProfile.HEADSET) hfpProxy = null }
        }, BluetoothProfile.HEADSET)
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
            val device: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            when (intent.action) {
                BluetoothAdapter.ACTION_STATE_CHANGED -> {
                    AuraLog.i("BT", "Adaptador: estado=${intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1)}")
                    refresh()
                }
                BluetoothDevice.ACTION_ACL_CONNECTED -> if (isOurs(device)) {
                    AuraLog.i("BT", "ACL conectado: ${safeName(device)}")
                    scope.launch { events.emit(Event("CONNECTED", safeName(device), device?.address)) }
                    _state.value = _state.value.copy(lastConnectedAt = System.currentTimeMillis())
                    refresh(); readBattery(device)
                }
                BluetoothDevice.ACTION_ACL_DISCONNECTED -> if (isOurs(device)) {
                    AuraLog.i("BT", "ACL desconectado: ${safeName(device)}")
                    scope.launch { events.emit(Event("DISCONNECTED", safeName(device), device?.address)) }
                    _state.value = _state.value.copy(lastDisconnectedAt = System.currentTimeMillis())
                    refresh()
                }
                BluetoothDevice.ACTION_BOND_STATE_CHANGED -> if (isOurs(device)) refresh()
                BluetoothDevice.ACTION_UUID -> if (isOurs(device)) {
                    val uuids = intent.getParcelableArrayExtra(BluetoothDevice.EXTRA_UUID)
                        ?.filterIsInstance<ParcelUuid>()?.map { it.toString() } ?: emptyList()
                    if (uuids.isNotEmpty()) {
                        AuraLog.i("SDP", "UUIDs recebidos: ${uuids.size}")
                        _state.value = _state.value.copy(uuids = uuids)
                    }
                }
                ACTION_BATTERY_LEVEL -> if (isOurs(device)) {
                    val level = intent.getIntExtra(EXTRA_BATTERY_LEVEL, -1)
                    AuraLog.i("BAT", "Broadcast de bateria: $level%")
                    if (level in 0..100) publishBattery(level, "Telemetria Android (HFP)")
                }
                BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED,
                BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED -> if (isOurs(device)) refresh()
            }
        }
    }

    private fun isOurs(device: BluetoothDevice?): Boolean {
        if (device == null) return false
        val current = _state.value.address
        return (current != null && device.address == current) || Tw982.matches(safeName(device))
    }

    private fun safeName(device: BluetoothDevice?): String? = try { device?.name } catch (_: SecurityException) { null }

    /** Reavalia o estado inteiro a partir das APIs do sistema. */
    fun refresh() {
        val ad = adapter
        if (ad == null || !Permissions.hasBluetooth(context)) {
            _state.value = Tw982State(adapterEnabled = ad?.isEnabled == true)
            return
        }
        val enabled = ad.isEnabled
        val bonded = try { ad.bondedDevices.orEmpty() } catch (_: SecurityException) { emptySet() }
        val device = bonded.firstOrNull { Tw982.matches(safeName(it)) }
        val a2dpOn = device != null && a2dpProxy?.getConnectionState(device) == BluetoothProfile.STATE_CONNECTED
        val hfpOn = device != null && hfpProxy?.getConnectionState(device) == BluetoothProfile.STATE_CONNECTED
        val connected = a2dpOn || hfpOn

        _state.value = _state.value.copy(
            adapterEnabled = enabled,
            bonded = device != null,
            device = device,
            deviceName = device?.let { safeName(it) },
            address = device?.address,
            connection = if (connected) ConnectionState.CONNECTED else ConnectionState.DISCONNECTED,
            a2dpConnected = a2dpOn,
            hfpConnected = hfpOn,
            bondState = when (device?.bondState) {
                BluetoothDevice.BOND_BONDED -> "Pareado"
                BluetoothDevice.BOND_BONDING -> "Pareando…"
                BluetoothDevice.BOND_NONE -> "Não pareado"
                else -> "—"
            },
            deviceType = when (device?.type) {
                BluetoothDevice.DEVICE_TYPE_CLASSIC -> "Bluetooth Classic (BR/EDR)"
                BluetoothDevice.DEVICE_TYPE_LE -> "Bluetooth Low Energy"
                BluetoothDevice.DEVICE_TYPE_DUAL -> "Dual (BR/EDR + BLE)"
                else -> "—"
            }
        )
        if (device != null) {
            readBattery(device)
            if (_state.value.uuids.isEmpty()) try { device.fetchUuidsWithSdp() } catch (_: Exception) {}
        }
    }

    /**
     * Lê o nível de bateria exposto pela pilha Bluetooth do Android.
     * O valor chega ao sistema via comandos AT do HFP (o TW982 envia o menor nível dos dois fones).
     */
    fun readBattery(device: BluetoothDevice? = _state.value.device) {
        val d = device ?: return
        try {
            val m = d.javaClass.getMethod("getBatteryLevel")
            val level = m.invoke(d) as? Int ?: -1
            if (level in 0..100) publishBattery(level, "Telemetria Android (HFP)")
            else AuraLog.i("BAT", "getBatteryLevel retornou $level (indisponível)")
        } catch (e: Exception) {
            AuraLog.e("BAT", "getBatteryLevel inacessível", e)
        }
    }

    private fun publishBattery(level: Int, source: String) {
        _state.value = _state.value.copy(
            batteryLevel = level,
            batteryUpdatedAt = System.currentTimeMillis(),
            batterySource = source
        )
    }

    /**
     * Tentativa de reconexão pelos perfis de áudio.
     * Em muitos Androids recentes, connect() é restrito a apps do sistema — o resultado
     * verdadeiro é devolvido para a UI; em caso de bloqueio, a UI oferece os ajustes Bluetooth.
     */
    fun tryReconnect(): Boolean {
        val device = _state.value.device ?: return false
        var any = false
        listOf<Pair<String, BluetoothProfile?>>("A2DP" to a2dpProxy, "HFP" to hfpProxy).forEach { (label, proxy) ->
            if (proxy == null) return@forEach
            try {
                val m = proxy.javaClass.getMethod("connect", BluetoothDevice::class.java)
                val ok = m.invoke(proxy, device) as? Boolean ?: false
                AuraLog.i("BT", "connect() $label => $ok")
                any = any || ok
            } catch (e: Exception) {
                AuraLog.e("BT", "connect() $label bloqueado pelo sistema", e)
            }
        }
        return any
    }

    fun stop() {
        if (receiverRegistered) {
            try { context.unregisterReceiver(receiver) } catch (_: Exception) {}
            receiverRegistered = false
        }
        a2dpProxy?.let { adapter?.closeProfileProxy(BluetoothProfile.A2DP, it) }
        hfpProxy?.let { adapter?.closeProfileProxy(BluetoothProfile.HEADSET, it) }
    }
}
