import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { sha256OfText } from '../lib/analysis/hashing';
import { LogoMark } from '../components/ui/Logo';
import { Topo } from '../components/ui/Topo';

/**
 * Porta de entrada por senha. Guardamos só o SHA-256 de "usbi|senha", nunca a senha.
 * O hash vem de VITE_PASS_HASH no momento do build (arquivo .env.local, ou um segredo
 * do GitHub Actions), e não do código: assim o repositório público não entrega a senha.
 * Sem VITE_PASS_HASH, o app abre direto.
 * Atenção: isto impede que alguém abra o app por descuido; não é um cofre. O código do app
 * é público e roda no navegador, então quem souber programar consegue contornar. Para
 * proteger arquivos de verdade, use o cofre AES-GCM na área Segurança.
 */
const PASS_HASH = (import.meta.env.VITE_PASS_HASH ?? '').trim().toLowerCase();
const KEY = 'usbi.acesso';
const MAX_TRIES = 5;
const LOCK_MS = 15_000;

let memoryUnlocked = false;
const isUnlocked = () => {
  try {
    return sessionStorage.getItem(KEY) === '1' || memoryUnlocked;
  } catch {
    return memoryUnlocked;
  }
};

export function AuthGate({ children }: { children: ReactNode }) {
  return /^[0-9a-f]{64}$/.test(PASS_HASH) ? <PasswordGate>{children}</PasswordGate> : <>{children}</>;
}

function PasswordGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(isUnlocked);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const tries = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= lockedUntil) {
        setLockedUntil(0);
        setError('');
        tries.current = 0;
      }
    }, 500);
    return () => clearInterval(t);
  }, [lockedUntil]);

  useEffect(() => {
    if (!ok) document.title = 'Acesso — USB Intelligence';
  }, [ok]);

  if (ok) return <>{children}</>;

  const locked = lockedUntil > now;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked || busy || !pw) return;
    setBusy(true);
    // Teclados de celular colocam espaço no fim ou trocam maiúsculas: aceitamos a senha
    // como digitada, sem espaços nas pontas, e também toda em maiúsculas ou minúsculas.
    const typed = pw.trim();
    const hashes = await Promise.all([...new Set([pw, typed, typed.toUpperCase(), typed.toLowerCase()])].map((v) => sha256OfText(`usbi|${v}`)));
    setBusy(false);
    if (hashes.includes(PASS_HASH)) {
      memoryUnlocked = true;
      try { sessionStorage.setItem(KEY, '1'); } catch { /* sem sessionStorage: vale até fechar a aba */ }
      setOk(true);
      return;
    }
    tries.current++;
    setPw('');
    if (tries.current >= MAX_TRIES) {
      setLockedUntil(Date.now() + LOCK_MS);
      setNow(Date.now());
      setError(`Muitas tentativas. Aguarde ${LOCK_MS / 1000} segundos.`);
    } else {
      setError('Senha incorreta. Tente novamente.');
      input.current?.focus();
    }
  };

  return (
    <div className="gate" data-tone="grafite">
      <Topo seed={9} levels={11} className="gate-topo" />
      <main className="gate-card" aria-labelledby="gate-title">
        <LogoMark size={48} />
        <span className="label">Acesso restrito</span>
        <h1 id="gate-title" className="h2">USB<br />Intelligence</h1>
        <p className="muted">Digite a senha para entrar. Seus arquivos continuam só neste aparelho.</p>
        <form onSubmit={submit} className="gate-form" noValidate>
          <label className="field" htmlFor="senha">
            <span>Senha</span>
            <span className="pw-wrap">
              <input
                ref={input}
                id="senha"
                className="input"
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                spellCheck={false}
                aria-invalid={!!error}
                aria-describedby="senha-erro"
                disabled={locked}
              />
              <button type="button" className="pw-eye" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}>
                {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </button>
            </span>
          </label>
          <p id="senha-erro" className="error-text gate-error" role="alert">{locked ? `Muitas tentativas. Tente de novo em ${Math.max(1, Math.ceil((lockedUntil - now) / 1000))} s.` : error}</p>
          <button className="btn btn-primary" type="submit" disabled={!pw || locked || busy}>
            <LockKeyhole aria-hidden /> {busy ? 'Conferindo…' : 'Entrar'}
          </button>
        </form>
        <p className="hint">A senha só barra o acesso a este app. Para proteger arquivos de verdade, use o cofre da área Segurança.</p>
      </main>
    </div>
  );
}
