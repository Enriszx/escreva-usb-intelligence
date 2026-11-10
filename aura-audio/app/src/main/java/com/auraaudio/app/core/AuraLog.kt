package com.auraaudio.app.core

import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Registro técnico central. Tudo que o app faz com Bluetooth/áudio passa por aqui,
 * fica disponível para a tela de diagnóstico e entra no relatório exportável.
 */
object AuraLog {
    data class Entry(val timestamp: Long, val tag: String, val message: String, val isError: Boolean)

    private val fmt = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)
    private val buffer = ArrayDeque<Entry>()
    private const val MAX = 800

    val live = MutableSharedFlow<Entry>(extraBufferCapacity = 64)

    @Synchronized
    fun i(tag: String, message: String) = add(Entry(System.currentTimeMillis(), tag, message, false))

    @Synchronized
    fun e(tag: String, message: String, t: Throwable? = null) =
        add(Entry(System.currentTimeMillis(), tag, message + (t?.let { " :: ${it.javaClass.simpleName}: ${it.message}" } ?: ""), true))

    private fun add(e: Entry) {
        if (e.isError) Log.e("AURA/${e.tag}", e.message) else Log.i("AURA/${e.tag}", e.message)
        buffer.addLast(e)
        while (buffer.size > MAX) buffer.removeFirst()
        live.tryEmit(e)
    }

    @Synchronized
    fun snapshot(): List<Entry> = buffer.toList()

    fun format(e: Entry): String = "${fmt.format(Date(e.timestamp))} [${e.tag}]${if (e.isError) " ERRO" else ""} ${e.message}"
}
