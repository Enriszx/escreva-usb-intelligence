import { useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { decryptBytes, encryptBytes, passwordStrength, VaultError } from '../../lib/crypto/vault';
import { formatBytes } from '../../lib/format';
import { saveBlob } from '../../lib/export';
import { useToast } from '../../app/feedback';
import { addHistory } from '../../lib/storage/repos';
import { useSettings } from '../../app/settings';

const WARN_SIZE = 300 * 1024 * 1024;
const MAX_SIZE = 1024 * 1024 * 1024;

export function VaultTool() {
  const [mode, setMode] = useState<'cifrar' | 'abrir'>('cifrar');
  return (
    <div className="vault">
      <div className="seg" role="radiogroup" aria-label="Operação do cofre">
        <label><input type="radio" name="vault" checked={mode === 'cifrar'} onChange={() => setMode('cifrar')} /><span><Lock aria-hidden size={16} /> Cifrar arquivo</span></label>
        <label><input type="radio" name="vault" checked={mode === 'abrir'} onChange={() => setMode('abrir')} /><span><Unlock aria-hidden size={16} /> Abrir cofre .usbi</span></label>
      </div>
      {mode === 'cifrar' ? <Encrypt /> : <Decrypt />}
    </div>
  );
}

function PasswordInput({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="pw-wrap">
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} spellCheck={false} />
        <button type="button" className="pw-eye" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}>
          {show ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      </span>
    </label>
  );
}

function Encrypt() {
  const toast = useToast();
  const { settings } = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(pw);
  const errors: string[] = [];
  if (pw && pw.length < 8) errors.push('Use pelo menos 8 caracteres.');
  if (pw2 && pw !== pw2) errors.push('As senhas não coincidem.');
  if (file && file.size > MAX_SIZE) errors.push('Arquivo acima de 1 GB: o navegador precisaria carregá-lo inteiro na memória. Divida-o antes.');
  const ready = !!file && pw.length >= 8 && pw === pw2 && ack && !errors.length && !busy;

  const go = async () => {
    if (!file) return;
    setBusy(true);
    const t0 = Date.now();
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const out = await encryptBytes(data, { name: file.name, type: file.type, size: file.size }, pw);
      const res = await saveBlob(new Blob([out], { type: 'application/octet-stream' }), `${file.name}.usbi`);
      if (res === 'cancelado') return;
      if (settings.saveHistory) await addHistory({ type: 'criptografia', title: `Cofre criado para ${file.name}`, files: 1, bytes: file.size, durationMs: Date.now() - t0, result: 'sucesso', notes: ['AES-256-GCM, chave PBKDF2-SHA-256 (600 mil iterações).', 'O arquivo original não foi alterado nem apagado.'] }).catch(() => {});
      toast({ tone: 'ok', title: 'Cofre criado', body: `${file.name}.usbi — o original continua onde estava; apague-o você mesmo se quiser.` });
      setPw('');
      setPw2('');
      setAck(false);
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível cifrar', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="vault-form" onSubmit={(e) => { e.preventDefault(); if (ready) go(); }}>
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()}>{file ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
        {file && <span className="mono muted">{file.name} · {formatBytes(file.size)}</span>}
        <input ref={input} type="file" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      </div>
      {file && file.size > WARN_SIZE && file.size <= MAX_SIZE && <p className="hint">Arquivo grande: o processo usa bastante memória e pode demorar no celular.</p>}
      <PasswordInput id="pw1" label="Senha" value={pw} onChange={setPw} autoComplete="new-password" />
      {pw && (
        <div className="strength" aria-live="polite">
          <div className="strength-bar">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= strength.score ? `on s${strength.score}` : ''} />)}</div>
          <span className="mono">{strength.label}</span>
        </div>
      )}
      <PasswordInput id="pw2" label="Repita a senha" value={pw2} onChange={setPw2} autoComplete="new-password" />
      {errors.map((e) => <p key={e} className="error-text">{e}</p>)}
      <label className="check ack">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>Entendo que a senha não fica guardada em lugar nenhum. Se eu esquecê-la, o conteúdo não pode ser recuperado.</span>
      </label>
      <button className="btn btn-primary" type="submit" disabled={!ready}>
        <Lock aria-hidden /> {busy ? 'Cifrando…' : 'Cifrar e salvar .usbi'}
      </button>
      {busy && <div className="progress indet"><i /></div>}
    </form>
  );
}

function Decrypt() {
  const toast = useToast();
  const { settings } = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const t0 = Date.now();
    try {
      const { meta, data } = await decryptBytes(new Uint8Array(await file.arrayBuffer()), pw);
      const res = await saveBlob(new Blob([data], { type: meta.type || 'application/octet-stream' }), meta.name);
      if (res === 'cancelado') return;
      if (settings.saveHistory) await addHistory({ type: 'descriptografia', title: `Cofre aberto: ${meta.name}`, files: 1, bytes: meta.size, durationMs: Date.now() - t0, result: 'sucesso', notes: [`Origem: ${file.name}`] }).catch(() => {});
      toast({ tone: 'ok', title: 'Arquivo recuperado', body: `${meta.name} (${formatBytes(meta.size)})` });
      setPw('');
    } catch (e) {
      setError(e instanceof VaultError ? e.message : `Falha inesperada: ${(e as Error).message}`);
      if (settings.saveHistory) addHistory({ type: 'descriptografia', title: `Tentativa de abrir ${file.name}`, files: 1, bytes: file.size, durationMs: Date.now() - t0, result: 'erro', notes: [(e as Error).message] }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="vault-form" onSubmit={(e) => { e.preventDefault(); if (file && pw) go(); }}>
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()}>{file ? 'Trocar cofre' : 'Escolher arquivo .usbi'}</button>
        {file && <span className="mono muted">{file.name} · {formatBytes(file.size)}</span>}
        <input ref={input} type="file" accept=".usbi,application/octet-stream" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); e.target.value = ''; }} />
      </div>
      <PasswordInput id="pw-open" label="Senha do cofre" value={pw} onChange={setPw} autoComplete="current-password" />
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={!file || !pw || busy}>
        <Unlock aria-hidden /> {busy ? 'Abrindo…' : 'Abrir e salvar original'}
      </button>
      {busy && <div className="progress indet"><i /></div>}
    </form>
  );
}
