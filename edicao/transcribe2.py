import json, numpy as np, wave
from faster_whisper import WhisperModel
wf=wave.open("audio16k.wav"); audio=np.frombuffer(wf.readframes(wf.getnframes()),np.int16).astype(np.float32)/32768
m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=4)
# trechos por pessoa, cada um com o roteiro como dica de vocabulário
parts = [(4.0,13.3,""),(13.3,22.6,"O painel mostra gráficos, encontra arquivos duplicados e gera relatórios, ajudando a manter tudo organizado."),
         (22.6,37.6,"Você importa seus arquivos, que ficam organizados numa biblioteca pesquisável com tags. Já funciona no celular Android, via adaptador OTG."),
         (37.6,51.8,"Por trás de tudo isso temos um aplicativo que pode funcionar sem internet, com acesso seguro para cada usuário. A inteligência artificial é opcional.")]
for a,b,prompt in parts:
    seg,_ = m.transcribe(audio[int(a*16000):int(b*16000)], language="pt", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    for s in seg:
        print(f"[{s.start+a:6.2f}-{s.end+a:6.2f}] {s.text.strip()}")
        print("   ", " ".join(f"{w.word.strip()}{'(?)' if w.probability<0.6 else ''}" for w in s.words))
