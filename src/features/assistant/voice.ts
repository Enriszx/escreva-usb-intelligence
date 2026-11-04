/**
 * Voz do Vigia, com as APIs do próprio navegador:
 * - ouvir: SpeechRecognition (Chrome/Edge; no Chrome o áudio é transcrito pelo serviço do Google);
 * - falar: speechSynthesis (vozes do sistema, funciona offline na maioria dos aparelhos).
 */
type Rec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecCtor = new () => Rec;

export function recognitionCtor(): RecCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const canListen = () => !!recognitionCtor();
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const ERR: Record<string, string> = {
  'not-allowed': 'O microfone foi bloqueado. Libere o microfone para este site no cadeado da barra de endereço.',
  'service-not-allowed': 'O navegador não liberou o reconhecimento de voz.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de voz precisa de internet neste navegador.',
};

/** Ouve uma frase. `onInterim` mostra o texto enquanto a pessoa fala. */
export function listenOnce(opts: { onInterim: (t: string) => void; onFinal: (t: string) => void; onError: (msg: string) => void; onEnd: () => void }): () => void {
  const C = recognitionCtor();
  if (!C) { opts.onError('Este navegador não reconhece voz. Use o Chrome ou o Edge.'); opts.onEnd(); return () => {}; }
  const r = new C();
  r.lang = 'pt-BR';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  let final = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) final += res[0].transcript;
      else interim += res[0].transcript;
    }
    opts.onInterim((final + interim).trim());
  };
  r.onerror = (e) => { if (e.error !== 'aborted') opts.onError(ERR[e.error] ?? `Erro no reconhecimento de voz (${e.error}).`); };
  r.onend = () => { if (final.trim()) opts.onFinal(final.trim()); opts.onEnd(); };
  r.start();
  return () => r.abort();
}

/** Texto limpo para falar: sem Markdown, sem links longos, até ~700 caracteres. */
export function speakable(md: string): string {
  const t = md
    .replace(/```[\s\S]*?```/g, ' (trecho de código na tela) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*•]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, 'o link na tela')
    .replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > 700 ? `${t.slice(0, 700).replace(/\s\S*$/, '')}… O resto está na tela.` : t;
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) { onEnd?.(); return; }
  const s = window.speechSynthesis;
  s.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = 'pt-BR';
  const v = s.getVoices().find((x) => x.lang?.toLowerCase().startsWith('pt-br')) ?? s.getVoices().find((x) => x.lang?.toLowerCase().startsWith('pt'));
  if (v) u.voice = v;
  u.rate = 1.03;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  s.speak(u);
}
export const stopSpeaking = () => { if (canSpeak()) window.speechSynthesis.cancel(); };
