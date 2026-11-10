package com.auraaudio.app.bluetooth

import android.bluetooth.BluetoothDevice

/** Identificação exclusiva do HAVIT TW982 / LIFE 01T. */
object Tw982 {
    /** Nomes de anúncio conhecidos do produto. */
    val KNOWN_NAMES = listOf("TW982", "LIFE 01T", "HAVIT TW982", "Havit TW982")

    fun matches(name: String?): Boolean {
        val n = name?.trim()?.lowercase() ?: return false
        return KNOWN_NAMES.any { n.contains(it.lowercase()) }
    }
}

enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

data class Tw982State(
    val adapterEnabled: Boolean = false,
    val bonded: Boolean = false,
    val device: BluetoothDevice? = null,
    val deviceName: String? = null,
    val address: String? = null,
    val connection: ConnectionState = ConnectionState.DISCONNECTED,
    val a2dpConnected: Boolean = false,
    val hfpConnected: Boolean = false,
    /** Nível de bateria combinado reportado pela telemetria do Android (HFP). -1 = indisponível. */
    val batteryLevel: Int = -1,
    val batteryUpdatedAt: Long = 0L,
    val batterySource: String? = null,
    val uuids: List<String> = emptyList(),
    val bondState: String = "—",
    val deviceType: String = "—",
    val lastConnectedAt: Long = 0L,
    val lastDisconnectedAt: Long = 0L
)
