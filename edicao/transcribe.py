import json, sys
from faster_whisper import WhisperModel
import numpy as np, wave
wf=wave.open("audio16k.wav"); audio=np.frombuffer(wf.readframes(wf.getnframes()),np.int16).astype(np.float32)/32768
m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=4)
segs, info = m.transcribe(audio, language="pt", word_timestamps=True, beam_size=5,
                          vad_filter=False, condition_on_previous_text=False,
                          initial_prompt="USB Intelligence, pendrive, OTG, aplicativo, celular Android.")
out = []
for s in segs:
    out.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                "words": [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2), "p": round(w.probability, 2)} for w in s.words]})
    print(f"[{s.start:6.2f}-{s.end:6.2f}] {s.text.strip()}", flush=True)
json.dump(out, open("transcricao.json", "w"), ensure_ascii=False, indent=1)
