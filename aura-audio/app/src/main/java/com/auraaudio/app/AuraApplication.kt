package com.auraaudio.app

import android.app.Application
import com.auraaudio.app.audio.EqEngine
import com.auraaudio.app.bluetooth.Tw982Repository
import com.auraaudio.app.data.AuraDatabase
import com.auraaudio.app.data.SettingsStore
import com.auraaudio.app.diagnostics.DiagnosticEngine
import com.auraaudio.app.media.MediaRepository
import com.auraaudio.app.mic.MicTestEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Contêiner de dependências do app (injeção manual, sem frameworks). */
class AppContainer(app: Application) {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val settings = SettingsStore(app)
    val db = AuraDatabase.get(app)
    val tw982 = Tw982Repository(app, appScope)
    val media = MediaRepository(app)
    val eq = EqEngine()
    val mic = MicTestEngine(app, appScope)
    val diagnostics = DiagnosticEngine(app, appScope)
}

class AuraApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
