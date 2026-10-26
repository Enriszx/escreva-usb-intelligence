import { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { useSettings, detectQuality } from '../../app/settings';
import { useDocumentTitle } from '../../app/hooks';
import { Modal, useConfirm, useToast } from '../../app/feedback';
import { StorageInfo } from './StorageInfo';
import { clear, clearAll, type StoreName } from '../../lib/storage/db';
import { makeBackup, checkBackup, restoreBackup, type BackupCheck } from '../../lib/storage/backup';
import { saveJSON, stamp } from '../../lib/export';
import { formatInt } from '../../lib/format';
import type { Settings } from '../../lib/storage/repos';
import './settings.css';

const CLEARABLE: { store: StoreName; label: string; note: string }[] = [
  { store: 'history', label: 'Histórico', note: 'Todos os registros de operações.' },
  { store: 'reports', label: 'Relatórios', note: 'Relatórios salvos (o histórico perde os links).' },
  { store: 'characters', label: 'Personagens', note: 'Toda a coleção do laboratório de personagem.' },
  { store: 'integrity', label: 'Referências de integridade', note: 'Hashes guardados para verificação posterior.' },
];

export default function SettingsPage() {
  useDocumentTitle('Configurações');
  const { settings, update, storageError, reducedMotion } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<BackupCheck | null>(null);
  const [nonce, setNonce] = useState(0);

  const set = async (patch: Partial<Settings>, msg: string) => {
    try {
      await update(patch);
      toast({ tone: 'ok', title: msg, body: 'Salvo neste dispositivo.' });
    } catch (e) {
      toast({ tone: 'erro', title: 'Não foi possível salvar', body: (e as Error).message });
    }
  };

  const onBackupFile = async (f?: File) => {
    if (!f) return;
    try {
      setPending(checkBackup(JSON.parse(await f.text())));
    } catch {
      setPending({ ok: false, errors: ['O arquivo não é um JSON válido.'], counts: {} });
    }
  };

  return (
    <div className="page settings-page">
      <div className="wrap">
        <header className="page-head">
          <span className="page-n outline-num" aria-hidden>08</span>
          <div>
            <span className="label">Configurações</span>
            <h1 className="h1">Do seu<br />jeito.</h1>
          </div>
          <p className="lead muted">Preferências e dados ficam só neste navegador, neste aparelho.</p>
        </header>
        {storageError && <p className="error-text" role="alert">{storageError}</p>}

        <div className="set-grid">
          <section className="set-sec" aria-labelledby="st-motion">
            <h2 id="st-motion" className="h3">Movimento</h2>
            <div className="seg seg-wrap" role="radiogroup" aria-label="Movimento">
              {(['sistema', 'reduzido', 'completo'] as const).map((m) => (
                <label key={m}>
                  <input type="radio" name="motion" checked={settings.motion === m} onChange={() => set({ motion: m }, 'Movimento atualizado')} />
                  <span>{m === 'sistema' ? 'Seguir o sistema' : m === 'reduzido' ? 'Reduzido' : 'Completo'}</span>
                </label>
              ))}
            </div>
            <p className="hint">Agora: {reducedMotion ? 'movimento reduzido — sem animações contínuas, 3D redesenha só quando algo muda.' : 'animações completas.'}</p>
            <label className="switch">
              <span>Animação de abertura na página inicial</span>
              <input type="checkbox" checked={settings.intro} onChange={(e) => set({ intro: e.target.checked }, e.target.checked ? 'Abertura ativada' : 'Abertura desativada')} />
            </label>
          </section>

          <section className="set-sec" aria-labelledby="st-3d">
            <h2 id="st-3d" className="h3">Qualidade 3D</h2>
            <div className="seg seg-wrap" role="radiogroup" aria-label="Qualidade 3D">
              {(['auto', 'economia', 'alta'] as const).map((q) => (
                <label key={q}>
                  <input type="radio" name="quality" checked={settings.quality === q} onChange={() => set({ quality: q }, 'Qualidade 3D atualizada')} />
                  <span>{q === 'auto' ? `Automática (${detectQuality()})` : q === 'economia' ? 'Economia' : 'Alta'}</span>
                </label>
              ))}
            </div>
            <p className="hint">Economia: menos resolução, menos polígonos e vidro simplificado — melhor para celulares e bateria.</p>
          </section>

          <section className="set-sec" aria-labelledby="st-hist">
            <h2 id="st-hist" className="h3">Histórico e relatórios</h2>
            <label className="switch">
              <span>Registrar operações e salvar relatórios automaticamente</span>
              <input type="checkbox" checked={settings.saveHistory} onChange={(e) => set({ saveHistory: e.target.checked }, e.target.checked ? 'Histórico ligado' : 'Histórico desligado')} />
            </label>
            <p className="hint">Desligado, nada novo é gravado. Os registros existentes continuam até você apagá-los.</p>
          </section>

          <section className="set-sec set-wide" aria-labelledby="st-data">
            <h2 id="st-data" className="h3">Dados locais</h2>
            <div className="data-grid">
              <StorageInfo key={nonce} />
              <div className="data-actions">
                <div>
                  <p className="label">Cópia de segurança</p>
                  <p className="muted">Um arquivo JSON com configurações, personagens, histórico, relatórios e referências. Guarde no pendrive para levar a outro aparelho.</p>
                  <div className="btn-row">
                    <button className="btn btn-ghost btn-sm" onClick={async () => { try { const r = await saveJSON(await makeBackup(), `usbi-backup-${stamp()}.json`); if (r !== 'cancelado') toast({ tone: 'ok', title: 'Backup exportado' }); } catch (e) { toast({ tone: 'erro', title: 'Falha no backup', body: (e as Error).message }); } }}>
                      <Download aria-hidden /> Exportar backup
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}><Upload aria-hidden /> Restaurar backup</button>
                    <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { onBackupFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </div>
                </div>
                <div>
                  <p className="label">Apagar dados</p>
                  <ul className="clear-list">
                    {CLEARABLE.map((c) => (
                      <li key={c.store}>
                        <span><strong>{c.label}</strong><span className="muted"> — {c.note}</span></span>
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          if (await confirm({ title: `Apagar ${c.label.toLowerCase()}?`, body: <p>{c.note} Não pode ser desfeito. Exporte um backup antes, se quiser guardar.</p>, confirm: 'Apagar', danger: true })) {
                            await clear(c.store);
                            setNonce((n) => n + 1);
                            toast({ tone: 'ok', title: `${c.label}: apagado` });
                          }
                        }}>
                          <Trash2 aria-hidden /> Apagar
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button className="btn btn-danger" onClick={async () => {
                    if (await confirm({ title: 'Apagar todos os dados locais?', body: <><p>Configurações, personagens, histórico, relatórios e referências deste aparelho serão removidos.</p><p><strong>Seus arquivos não são afetados</strong> — o app nunca guardou o conteúdo deles.</p></>, confirm: 'Apagar tudo', danger: true, typeToConfirm: 'APAGAR' })) {
                      await clearAll();
                      await update({ intro: true, motion: 'sistema', quality: 'auto', saveHistory: true });
                      setNonce((n) => n + 1);
                      toast({ tone: 'ok', title: 'Dados locais apagados' });
                    }
                  }}>
                    <Trash2 aria-hidden /> Apagar tudo
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {pending && (
        <Modal title={pending.ok ? 'Restaurar este backup?' : 'Backup recusado'} onClose={() => setPending(null)} tone={pending.ok ? undefined : 'danger'}>
          <div className="modal-body">
            {pending.ok ? (
              <>
                <p>Serão gravados:</p>
                <ul>{Object.entries(pending.counts).map(([k, v]) => <li key={k}>{k}: {formatInt(v ?? 0)}</li>)}</ul>
                <p>Registros com o mesmo identificador serão substituídos; os demais dados atuais são mantidos.</p>
              </>
            ) : (
              <>
                <p>Nada foi alterado. Problemas encontrados:</p>
                <ul className="err-list">{pending.errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </>
            )}
          </div>
          <div className="btn-row modal-actions">
            <button className="btn btn-ghost" onClick={() => setPending(null)}>{pending.ok ? 'Cancelar' : 'Fechar'}</button>
            {pending.ok && pending.data && (
              <button className="btn btn-primary" onClick={async () => {
                try {
                  const n = await restoreBackup(pending.data!);
                  setPending(null);
                  setNonce((x) => x + 1);
                  toast({ tone: 'ok', title: 'Backup restaurado', body: `${formatInt(n)} registros gravados. Recarregue a página para aplicar as configurações.` });
                } catch (e) {
                  toast({ tone: 'erro', title: 'Falha ao restaurar', body: (e as Error).message });
                }
              }}>Restaurar</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
