package com.auraaudio.app.diagnostics

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import com.auraaudio.app.bluetooth.Tw982
import com.auraaudio.app.core.AuraLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Motor de diagnóstico do TW982.
 *
 * Estratégia (somente leitura — NUNCA escreve em características desconhecidas):
 *  1. Coleta dados Classic do dispositivo pareado (nome, endereço, tipo, UUIDs SDP, bateria).
 *  2. Varredura BLE procurando anúncio do TW982 (nome compatível ou mesmo endereço).
 *  3. Conexão GATT, descoberta de serviços, enumeração de características e propriedades.
 *  4. Leitura de todas as características legíveis.
 *  5. Relatório técnico exportável (JSON + texto) para análise posterior.
 */
@SuppressLint("MissingPermission")
class DiagnosticEngine(private val context: Context, private val scope: CoroutineScope) {

    enum class Phase { IDLE, CLASSIC, SCANNING, CONNECTING, DISCOVERING, READING, DONE, FAILED }

    data class CharInfo(
        val serviceUuid: String,
        val charUuid: String,
        val properties: List<String>,
        val value: String?, // hex, quando legível
        val descriptors: List<String>
    )

    data class Report(
        val startedAt: Long = System.currentTimeMillis(),
        var finishedAt: Long = 0L,
        var deviceName: String? = null,
        var address: String? = null,
        var bondState: String? = null,
        var deviceType: String? = null,
        var classicBattery: Int = -1,
        var sdpUuids: List<String> = emptyList(),
        var bleFound: Boolean = false,
        var bleRssi: Int? = null,
        var bleAdvertisedServices: List<String> = emptyList(),
        var gattConnected: Boolean = false,
        var services: List<String> = emptyList(),
        var characteristics: List<CharInfo> = emptyList(),
        var batteryServiceLevels: List<Int> = emptyList(),
        var errors: List<String> = emptyList(),
        var notes: List<String> = emptyList()
    )

    private val _phase = MutableStateFlow(Phase.IDLE)
    val phase: StateFlow<Phase> = _phase.asStateFlow()

    private val _progress = MutableStateFlow("Pronto para iniciar")
    val progress: StateFlow<String> = _progress.asStateFlow()

    private val _report = MutableStateFlow<Report?>(null)
    val report: StateFlow<Report?> = _report.asStateFlow()

    private var gatt: BluetoothGatt? = null
    private var job: Job? = null
    private val errors = mutableListOf<String>()
    private val notes = mutableListOf<String>()

    private val manager get() = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

    fun run(bondedDevice: BluetoothDevice?) {
        if (_phase.value in listOf(Phase.SCANNING, Phase.CONNECTING, Phase.DISCOVERING, Phase.READING)) return
        errors.clear(); notes.clear()
        val rep = Report()
        _report.value = rep
        job = scope.launch {
            try {
                // FASE 1 — Classic
                _phase.value = Phase.CLASSIC
                step("Coletando dados Bluetooth Classic…")
                if (bondedDevice != null) {
                    rep.deviceName = try { bondedDevice.name } catch (_: SecurityException) { null }
                    rep.address = bondedDevice.address
                    rep.bondState = bondedDevice.bondState.toString()
                    rep.deviceType = bondedDevice.type.toString()
                    rep.classicBattery = try {
                        bondedDevice.javaClass.getMethod("getBatteryLevel").invoke(bondedDevice) as? Int ?: -1
                    } catch (e: Exception) { err("getBatteryLevel: ${e.message}"); -1 }
                    try {
                        bondedDevice.fetchUuidsWithSdp()
                        delay(2500)
                        rep.sdpUuids = bondedDevice.uuids?.map { it.toString() } ?: emptyList()
                    } catch (e: Exception) { err("SDP: ${e.message}") }
                    note("Dispositivo pareado encontrado; UUIDs SDP: ${rep.sdpUuids.size}")
                } else {
                    note("Nenhum TW982 pareado no momento do diagnóstico")
                }
                publish(rep)

                // FASE 2 — Varredura BLE
                _phase.value = Phase.SCANNING
                step("Procurando anúncio BLE do TW982 (15 s)…")
                val found = scanForDevice(rep, bondedDevice?.address)
                publish(rep)

                val target = found ?: bondedDevice?.takeIf {
                    it.type == BluetoothDevice.DEVICE_TYPE_LE || it.type == BluetoothDevice.DEVICE_TYPE_DUAL
                }
                if (target == null) {
                    note(
                        if (bondedDevice != null)
                            "O TW982 não anuncia BLE visível e o dispositivo pareado é apenas Classic — " +
                            "não há servidor GATT acessível. Isso é um resultado válido do diagnóstico."
                        else "Sem dispositivo para conexão GATT."
                    )
                    finish(rep, Phase.DONE); return@launch
                }

                // FASE 3 — GATT
                _phase.value = Phase.CONNECTING
                step("Conectando ao servidor GATT…")
                val ok = gattDiscover(rep, target)
                finish(rep, if (ok) Phase.DONE else Phase.DONE) // relatório é válido mesmo sem GATT
            } catch (e: Exception) {
                err("Falha inesperada: ${e.message}")
                finish(rep, Phase.FAILED)
            }
        }
    }

    private suspend fun scanForDevice(rep: Report, knownAddress: String?): BluetoothDevice? {
        val scanner = manager.adapter?.bluetoothLeScanner ?: run {
            err("BluetoothLeScanner indisponível"); return null
        }
        var result: BluetoothDevice? = null
        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, sr: ScanResult) {
                val name = sr.scanRecord?.deviceName ?: (try { sr.device.name } catch (_: SecurityException) { null })
                val match = Tw982.matches(name) || (knownAddress != null && sr.device.address == knownAddress)
                if (match && result == null) {
                    result = sr.device
                    rep.bleFound = true
                    rep.bleRssi = sr.rssi
                    rep.bleAdvertisedServices = sr.scanRecord?.serviceUuids?.map { it.toString() } ?: emptyList()
                    AuraLog.i("DIAG", "Anúncio BLE: $name rssi=${sr.rssi}")
                }
            }
            override fun onScanFailed(errorCode: Int) { err("Varredura BLE falhou: código $errorCode") }
        }
        try {
            scanner.startScan(null, ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), cb)
            var waited = 0
            while (waited < 15000 && result == null) { delay(500); waited += 500 }
        } catch (e: Exception) { err("startScan: ${e.message}") } finally {
            try { scanner.stopScan(cb) } catch (_: Exception) {}
        }
        if (result == null) note("Nenhum anúncio BLE do TW982 durante a varredura (fones TWS costumam parar de anunciar após conectar).")
        return result
    }

    private suspend fun gattDiscover(rep: Report, device: BluetoothDevice): Boolean {
        var connected = false
        var discovered = false
        val pendingReads = ArrayDeque<BluetoothGattCharacteristic>()
        val chars = mutableListOf<CharInfo>()
        val battLevels = mutableListOf<Int>()
        var readingDone = false

        val cb = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                AuraLog.i("DIAG", "GATT estado=$newState status=$status")
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    connected = true
                    _phase.value = Phase.DISCOVERING
                    step("Descobrindo serviços GATT…")
                    g.discoverServices()
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    if (!connected) err("GATT não conectou (status $status)")
                    readingDone = true
                }
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) { err("discoverServices status=$status"); readingDone = true; return }
                discovered = true
                rep.services = g.services.map { it.uuid.toString() }
                AuraLog.i("DIAG", "Serviços: ${rep.services.size}")
                g.services.forEach { svc ->
                    svc.characteristics.forEach { ch ->
                        val props = decodeProps(ch.properties)
                        chars += CharInfo(svc.uuid.toString(), ch.uuid.toString(), props, null, ch.descriptors.map { it.uuid.toString() })
                        if (props.contains("READ")) pendingReads.addLast(ch)
                    }
                }
                _phase.value = Phase.READING
                step("Lendo ${pendingReads.size} características legíveis…")
                if (!nextRead(g)) readingDone = true
            }

            @Suppress("DEPRECATION")
            override fun onCharacteristicRead(g: BluetoothGatt, ch: BluetoothGattCharacteristic, status: Int) {
                val value = if (status == BluetoothGatt.GATT_SUCCESS) ch.value else null
                record(ch, value, status)
                if (!nextRead(g)) readingDone = true
            }

            override fun onCharacteristicRead(g: BluetoothGatt, ch: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
                record(ch, if (status == BluetoothGatt.GATT_SUCCESS) value else null, status)
                if (!nextRead(g)) readingDone = true
            }

            fun record(ch: BluetoothGattCharacteristic, value: ByteArray?, status: Int) {
                val hex = value?.joinToString(" ") { String.format("%02X", it) }
                val idx = chars.indexOfFirst { it.charUuid == ch.uuid.toString() && it.value == null }
                if (idx >= 0) chars[idx] = chars[idx].copy(value = hex ?: "erro status=$status")
                if (ch.uuid == UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb") && value?.isNotEmpty() == true) {
                    battLevels += value[0].toInt()
                    AuraLog.i("DIAG", "GATT Battery Level: ${value[0].toInt()}%")
                }
            }

            fun nextRead(g: BluetoothGatt): Boolean {
                val next = pendingReads.removeFirstOrNull() ?: return false
                return try { g.readCharacteristic(next) } catch (e: Exception) { err("readCharacteristic: ${e.message}"); nextRead(g) }
            }
        }

        gatt = try {
            if (Build.VERSION.SDK_INT >= 23)
                device.connectGatt(context, false, cb, BluetoothDevice.TRANSPORT_LE)
            else device.connectGatt(context, false, cb)
        } catch (e: Exception) { err("connectGatt: ${e.message}"); null } ?: return false

        var waited = 0
        while (waited < 30000 && !readingDone && !(discovered && pendingReads.isEmpty() && chars.none { it.properties.contains("READ") && it.value == null })) {
            delay(500); waited += 500
        }
        rep.gattConnected = connected
        rep.characteristics = chars
        rep.batteryServiceLevels = battLevels
        if (connected && discovered) {
            note("GATT: ${rep.services.size} serviços, ${chars.size} características (${chars.count { it.properties.contains("READ") }} legíveis, ${chars.count { it.properties.contains("WRITE") || it.properties.contains("WRITE_NO_RESPONSE") }} graváveis — não escritas, por segurança).")
            if (battLevels.isEmpty()) note("Nenhum Battery Service (0x180F) legível foi exposto via GATT.")
        }
        try { gatt?.disconnect(); gatt?.close() } catch (_: Exception) {}
        gatt = null
        return connected && discovered
    }

    private fun decodeProps(p: Int): List<String> = buildList {
        if (p and BluetoothGattCharacteristic.PROPERTY_READ != 0) add("READ")
        if (p and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) add("WRITE")
        if (p and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) add("WRITE_NO_RESPONSE")
        if (p and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) add("NOTIFY")
        if (p and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) add("INDICATE")
        if (p and BluetoothGattCharacteristic.PROPERTY_BROADCAST != 0) add("BROADCAST")
        if (p and BluetoothGattCharacteristic.PROPERTY_SIGNED_WRITE != 0) add("SIGNED_WRITE")
    }

    private fun step(msg: String) { _progress.value = msg; AuraLog.i("DIAG", msg) }
    private fun err(msg: String) { errors += msg; AuraLog.e("DIAG", msg) }
    private fun note(msg: String) { notes += msg; AuraLog.i("DIAG", msg) }

    private fun publish(rep: Report) {
        rep.errors = errors.toList(); rep.notes = notes.toList()
        _report.value = rep.copy()
    }

    private fun finish(rep: Report, phase: Phase) {
        rep.finishedAt = System.currentTimeMillis()
        publish(rep)
        _phase.value = phase
        step(if (phase == Phase.DONE) "Diagnóstico concluído" else "Diagnóstico falhou")
    }

    fun cancel() {
        job?.cancel()
        try { gatt?.disconnect(); gatt?.close() } catch (_: Exception) {}
        gatt = null
        _phase.value = Phase.IDLE
        _progress.value = "Cancelado"
    }

    fun toJson(rep: Report): String {
        val o = JSONObject()
        o.put("app", "AURA AUDIO 1.0.0")
        o.put("device_target", "HAVIT TW982 / LIFE 01T")
        o.put("android_sdk", Build.VERSION.SDK_INT)
        o.put("phone", "${Build.MANUFACTURER} ${Build.MODEL}")
        o.put("started_at", rep.startedAt); o.put("finished_at", rep.finishedAt)
        o.put("device_name", rep.deviceName ?: JSONObject.NULL)
        o.put("address", rep.address ?: JSONObject.NULL)
        o.put("bond_state", rep.bondState ?: JSONObject.NULL)
        o.put("device_type", rep.deviceType ?: JSONObject.NULL)
        o.put("classic_battery_percent", rep.classicBattery)
        o.put("sdp_uuids", JSONArray(rep.sdpUuids))
        o.put("ble_found", rep.bleFound)
        o.put("ble_rssi", rep.bleRssi ?: JSONObject.NULL)
        o.put("ble_advertised_services", JSONArray(rep.bleAdvertisedServices))
        o.put("gatt_connected", rep.gattConnected)
        o.put("gatt_services", JSONArray(rep.services))
        o.put("gatt_characteristics", JSONArray(rep.characteristics.map { c ->
            JSONObject().apply {
                put("service", c.serviceUuid); put("characteristic", c.charUuid)
                put("properties", JSONArray(c.properties))
                put("value_hex", c.value ?: JSONObject.NULL)
                put("descriptors", JSONArray(c.descriptors))
            }
        }))
        o.put("gatt_battery_levels", JSONArray(rep.batteryServiceLevels))
        o.put("notes", JSONArray(rep.notes))
        o.put("errors", JSONArray(rep.errors))
        o.put("recent_log", JSONArray(AuraLog.snapshot().takeLast(200).map { AuraLog.format(it) }))
        return o.toString(2)
    }
}
