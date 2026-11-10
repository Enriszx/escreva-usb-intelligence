package com.auraaudio.app.core

/**
 * Matriz técnica de recursos do AURA AUDIO para o HAVIT TW982 (LIFE 01T).
 *
 * Classificações:
 *  A = suportado diretamente pelo TW982 (protocolo do próprio fone)
 *  B = suportado pelo Android (API do sistema, vale para o TW982 conectado)
 *  C = implementação complementar do app (funciona, mas não altera o firmware)
 *  D = não suportado pelo hardware/firmware conhecido
 *  E = não investigado suficientemente (depende do diagnóstico no aparelho real)
 */
enum class SupportClass(val label: String) {
    A("Suportado pelo TW982"),
    B("Suportado pelo Android"),
    C("Implementação complementar"),
    D("Não suportado pelo hardware"),
    E("Depende de diagnóstico no aparelho")
}

data class FeatureEntry(
    val name: String,
    val support: SupportClass,
    val how: String,
    val protocol: String,
    val api: String,
    val limitation: String
)

object FeatureMatrix {
    val entries: List<FeatureEntry> = listOf(
        FeatureEntry(
            "Detecção e estado de conexão", SupportClass.B,
            "O app observa eventos ACL do sistema e consulta os perfis A2DP/HFP para saber se o TW982 está conectado.",
            "Bluetooth Classic (ACL, A2DP, HFP)",
            "BroadcastReceiver ACTION_ACL_* + BluetoothProfile proxies",
            "Conexão/desconexão de perfis de áudio é gerenciada pelo sistema; o app não contorna a segurança do Android."
        ),
        FeatureEntry(
            "Reconexão", SupportClass.B,
            "Tentativa via API de perfil quando o sistema permitir; senão, atalho direto para os ajustes Bluetooth.",
            "A2DP/HFP",
            "BluetoothA2dp (reflexão, pode ser bloqueada) + ACTION_BLUETOOTH_SETTINGS",
            "Em Androids recentes a chamada direta de conexão é restrita a apps de sistema; o resultado real é mostrado na tela."
        ),
        FeatureEntry(
            "Bateria (nível combinado)", SupportClass.B,
            "O TW982 envia o nível pelo HFP (AT+IPHONEACCEV / indicadores HF); o Android expõe esse valor por telemetria.",
            "HFP vendor AT commands",
            "BluetoothDevice.getBatteryLevel + ACTION_BATTERY_LEVEL_CHANGED",
            "Normalmente é um único valor (o menor dos dois fones). Valores por fone dependem do que o firmware expõe."
        ),
        FeatureEntry(
            "Bateria esquerda/direita separadas", SupportClass.E,
            "Só é possível se o firmware expor GATT Battery Service com instâncias múltiplas ou protocolo proprietário.",
            "BLE GATT 0x180F ou proprietário",
            "BluetoothGatt",
            "O diagnóstico verifica no seu aparelho. Sem essa exposição, o app mostra claramente 'indisponível'."
        ),
        FeatureEntry(
            "Bateria do estojo", SupportClass.E,
            "O estojo só seria visível se os fones retransmitissem o nível por protocolo proprietário.",
            "Proprietário (não documentado)",
            "—",
            "Nenhum protocolo público conhecido para o AB5656 neste produto. O app nunca estima esse valor."
        ),
        FeatureEntry(
            "Play/Pause/Faixas/Volume", SupportClass.B,
            "Controle real de qualquer player via tecla de mídia do sistema; com acesso a notificações, também metadados e estado.",
            "AVRCP (fone→celular) / MediaSession (app→players)",
            "AudioManager.dispatchMediaKeyEvent + MediaSessionManager/MediaController",
            "Metadados exigem ativar o acesso a notificações do AURA AUDIO nos ajustes do Android."
        ),
        FeatureEntry(
            "Gestos de toque (consulta)", SupportClass.A,
            "Mapeamento oficial do manual do TW982 com guia animado.",
            "Firmware do TW982",
            "—",
            "Referência oficial; ver item seguinte sobre remapeamento."
        ),
        FeatureEntry(
            "Remapeamento de gestos", SupportClass.E,
            "Exigiria comando proprietário Bluetrum; não há protocolo público documentado para o AB5656.",
            "Proprietário (não documentado)",
            "—",
            "O diagnóstico procura características graváveis candidatas, mas o app não escreve em características desconhecidas."
        ),
        FeatureEntry(
            "Modo jogo (ativação pelo app)", SupportClass.E,
            "O manual documenta apenas o triplo toque no fone direito; nenhum comando remoto é conhecido.",
            "Proprietário (não documentado)",
            "—",
            "O app oferece o tutorial interativo oficial. Nenhum botão falso de ativação é exibido."
        ),
        FeatureEntry(
            "Equalizador no DSP do fone", SupportClass.E,
            "O AB5656 tem DSP, mas não há protocolo público para configurá-lo neste produto.",
            "Proprietário (não documentado)",
            "—",
            "Sem protocolo comprovado, o AURA AUDIO não afirma alterar o DSP do fone."
        ),
        FeatureEntry(
            "Equalizador global do Android", SupportClass.B,
            "Equalizer/BassBoost/Virtualizer/LoudnessEnhancer aplicados à mixagem de saída do Android (sessão global).",
            "Processamento no Android, áudio já equalizado chega ao fone por A2DP",
            "android.media.audiofx.* (sessão 0)",
            "Depende do dispositivo: alguns players com saída offload podem não ser afetados; a tela indica disponibilidade real."
        ),
        FeatureEntry(
            "Teste de microfone", SupportClass.B,
            "Gravação local via rota SCO/HFP do TW982 e reprodução em seguida.",
            "HFP/SCO",
            "AudioRecord + setCommunicationDevice/startBluetoothSco",
            "O TW982 reporta um canal de voz mono; o teste indica a rota realmente usada."
        ),
        FeatureEntry(
            "ANC (cancelamento ativo)", SupportClass.D,
            "O TW982 não possui ANC; possui apenas ENC (redução de ruído de chamadas, fixa no firmware).",
            "—", "—",
            "Nenhum controle de ANC é exibido, pois o hardware não tem esse recurso."
        ),
        FeatureEntry(
            "Diagnóstico BLE/GATT", SupportClass.B,
            "Varredura, conexão GATT, descoberta de serviços/características, leitura das legíveis e exportação de relatório.",
            "BLE GATT + SDP (UUIDs Classic)",
            "BluetoothLeScanner, BluetoothGatt, fetchUuidsWithSdp",
            "Somente leitura: o app não escreve em características desconhecidas."
        ),
        FeatureEntry(
            "Alertas de bateria/conexão", SupportClass.C,
            "Serviço opcional em primeiro plano observa eventos e notifica.",
            "—",
            "ForegroundService(connectedDevice) + NotificationManager",
            "Consome recursos mínimos; pode ser desativado em Settings."
        ),
        FeatureEntry(
            "Última localização conhecida", SupportClass.C,
            "Na desconexão, o app registra a última posição conhecida do telefone (não é GPS do fone).",
            "—",
            "LocationManager.getLastKnownLocation (opcional)",
            "É a posição do celular no momento da desconexão, nunca rastreamento do fone."
        ),
        FeatureEntry(
            "Atualização de firmware", SupportClass.D,
            "Sem imagem oficial e procedimento documentado da HAVIT/Bluetrum, qualquer escrita seria insegura.",
            "—", "—",
            "O AURA AUDIO não executa OTA sem documentação oficial — risco real de inutilizar o fone."
        )
    )
}
