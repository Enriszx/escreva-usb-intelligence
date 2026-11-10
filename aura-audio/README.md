# AURA AUDIO

Aplicativo Android nativo (Kotlin + Jetpack Compose) dedicado **exclusivamente** ao fone
Bluetooth **HAVIT TW982 / LIFE 01T**. Central única de conexão, bateria, equalização,
reprodução, gestos, microfone e diagnóstico — construída sobre o princípio
**controle real acima de tudo**: nenhum botão decorativo, nenhum valor inventado.

## Instalação rápida (Samsung / qualquer Android 8.0+)

1. Copie `app/build/outputs/apk/debug/app-debug.apk` para o telefone.
2. Toque no arquivo e autorize a instalação de fontes desconhecidas quando o Android pedir.
3. Abra o **AURA AUDIO**, conceda a permissão de Bluetooth e siga o fluxo.
4. Pareie o TW982 pelos ajustes do Android (uma única vez) — o app detecta automaticamente.

> O pacote de depuração instala como `com.auraaudio.app.debug`. A versão release
> (assinável) é gerada com `assembleRelease` e exige uma keystore sua.

## Compilação

Pré-requisitos: JDK 17+, Android SDK (platform 35, build-tools 35), Gradle 8.9+ (ou o wrapper).

```bash
cd aura-audio
# aponte local.properties para o seu SDK: sdk.dir=/caminho/do/Android/Sdk
gradle :app:assembleDebug        # APK de depuração
gradle :app:testDebugUnitTest    # testes unitários
gradle :app:assembleRelease      # release (minificada; assine com sua keystore)
```

No Android Studio: `File → Open → aura-audio` e Run.

## Arquitetura

Módulo único `:app` com pacotes de responsabilidade única (decisão documentada:
menos atrito de build que multi-módulo, mesma separação lógica):

```
com.auraaudio.app
├── core/           AuraLog (log técnico central), Permissions, FeatureMatrix (classificação A–E)
├── bluetooth/      Tw982Repository — fonte única de verdade (ACL, A2DP/HFP, SDP, bateria)
├── diagnostics/    DiagnosticEngine — varredura BLE + GATT somente-leitura + relatório JSON
├── media/          MediaRepository (MediaSession/MediaController + tecla de mídia global)
├── audio/          EqEngine (AudioFx global: Equalizer/BassBoost/Virtualizer/Loudness) + EqPresets
├── mic/            MicTestEngine — gravação WAV pela rota HFP/SCO + reprodução
├── data/           Room (histórico, relatórios) + DataStore (configurações, perfis EQ)
├── service/        AuraMonitorService — foreground service (connectedDevice) p/ alertas e histórico
├── designsystem/   Tema claro/escuro, tipografia, componentes (BatteryRing, StatusChip…)
├── animations/     Tw982Scene — cena 2.5D do estojo/fones (Canvas, fiel ao produto)
├── feature/        17 telas (Splash → About)
└── navigation/     Rotas Navigation-Compose
```

### Fontes de dados reais

| Dado | Fonte | Observação |
|---|---|---|
| Conexão/perfis | `BroadcastReceiver` ACL + proxies `BluetoothProfile` A2DP/HFP | eventos do sistema |
| Bateria dos fones | `BluetoothDevice#getBatteryLevel` + broadcast `BATTERY_LEVEL_CHANGED` | valor enviado pelo TW982 via HFP (nível combinado) |
| Bateria do estojo | **não transmitida pelo firmware** | o app declara indisponível — nunca estima |
| Serviços | `fetchUuidsWithSdp` (Classic) + GATT discovery (BLE) | diagnóstico somente-leitura |
| Reprodução | `MediaController` (com acesso a notificações) ou `dispatchMediaKeyEvent` | mesmo caminho do AVRCP |
| Equalização | `android.media.audiofx.*` na sessão global (0) | nível B — não altera o DSP do fone |
| Microfone | `AudioRecord` + `setCommunicationDevice`/SCO | rota exibida na UI |

### Decisão sobre 3D

A cena do TW982 (estojo abrindo, fones flutuando) é renderizada em **Canvas 2.5D**
com gradientes, sombras e animação física — não via Filament — porque não existe
modelo glTF oficial do TW982 e um modelo genérico violaria a regra de fidelidade
visual. A cena foi desenhada a partir de referências fotográficas do produto
(estojo "pebble", fones de haste curta, LED frontal). Migração para Filament é
viável se um modelo fiel for produzido.

## Matriz de recursos (resumo)

A versão completa e sempre atualizada está dentro do app (**Matriz de recursos**).

- **A (protocolo do fone):** mapa oficial de gestos do manual/FCC.
- **B (Android):** conexão/estado, bateria combinada, reprodução/volume, EQ global, teste de microfone, diagnóstico GATT.
- **C (complementar):** alertas, histórico, última posição do telefone na desconexão.
- **D (hardware não suporta):** ANC (o TW982 tem só ENC fixa), OTA sem documentação oficial.
- **E (depende do diagnóstico no seu exemplar):** bateria L/R separada, bateria do estojo, remapeamento de gestos, modo jogo remoto, EQ no DSP.

## Diagnóstico no aparelho real

O desenvolvimento ocorreu sem acesso físico ao TW982, portanto **os testes físicos
(1–18 do plano) ainda não foram executados** — apenas os testes unitários e a
compilação. Para fechar o ciclo:

1. Instale o APK, conecte o TW982.
2. Abra **Diagnostics → Iniciar diagnóstico completo**.
3. Toque em **Exportar relatório (JSON)** e envie o arquivo.
4. O relatório revela se o seu exemplar expõe GATT/Battery Service/característica
   proprietária — base para habilitar bateria L/R, remapeamento etc. em uma v1.1.

O motor é **somente leitura**: nunca escreve em características desconhecidas,
não altera firmware, não exige root.

## Plano de testes físicos

| # | Teste | Tela | Como verificar |
|---|---|---|---|
| 1 | Identificação | Device Search | nome TW982/LIFE 01T detectado |
| 2 | Pareamento | Pairing | guia abre ajustes do sistema |
| 3–5 | Conexão/desconexão/reconexão | Connection Center | chips de estado + histórico |
| 6–8 | Bateria L/R/estojo | Battery Center | nível combinado real; L/R/estojo declarados indisponíveis até o diagnóstico provar o contrário |
| 9–12 | Play/pause/próxima/anterior | Playback | atuar sobre Spotify/YT Music |
| 13 | Equalização | Audio Studio | diferença audível com música tocando (toggle on/off) |
| 14 | Gestos | Touch Controls | conferir com o fone no ouvido |
| 15 | Modo jogo | Game Mode | triplo toque direito + aviso sonoro |
| 16 | Microfone | Microfone | gravar 5 s e ouvir; conferir "entrada usada" = Bluetooth SCO |
| 17 | Chamadas | Microfone | rota HFP em chamada real |
| 18 | Segundo plano | Settings → monitor | notificação ao desconectar com app fechado |
| 19 | Temas | Settings | alternância claro/escuro/sistema |
| 20 | Cena animada | Connecting/Home | fluidez da abertura do estojo |

## Pesquisa técnica (fase 1)

- **FCC 2AI6I-TW982** (concedido 2024-05-21): transmissor Part 15C, 2402–2480 MHz,
  0,001 W conduzido, "True Wireless Stereo Earbuds", fabricante Guangzhou Havit Technology.
- **SoC Bluetrum AB5656**: RISC-V até 125 MHz com instruções DSP, 113 KB RAM,
  Bluetooth 5.4, perfis A2DP/AVRCP/HFP/HSP; DAC 16-bit (102 dB SNR).
  **Não há protocolo público** de controle por app (EQ/gestos/bateria por fone) —
  por isso essas funções são classe E até o diagnóstico provar o contrário.
- **Gestos** (manual oficial): duplo toque = play/pause e atender/finalizar;
  ~1 s esquerdo = anterior, ~1 s direito = próxima, ~1 s em chamada = rejeitar;
  triplo esquerdo = assistente, triplo direito = modo jogo.
- O acesso automatizado ao PDF do manual (manuals.plus e fccid.io) é bloqueado
  por proteção anti-bot; os gestos acima vêm da transcrição do manual oficial.

## Segurança e privacidade

- Sem root, sem desbloqueio de bootloader, sem escrita em firmware.
- Diagnóstico somente-leitura; nenhuma escrita em características desconhecidas.
- Localização (opcional) registra apenas a posição **do telefone** na desconexão — nunca é "GPS do fone".
- Nenhum dado sai do aparelho, exceto relatórios que você mesmo exportar.
