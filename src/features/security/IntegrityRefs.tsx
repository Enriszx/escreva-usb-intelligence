import { useRef, useState } from 'react';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { deleteIntegrityRef, updateIntegrityRef, addHistory, type IntegrityRef } from '../../lib/storage/repos';
import { sha256OfBlob } from '../../lib/analysis/hashing';
import { formatBytes, formatDateTime } from '../../lib/format';
import { useConfirm, useToast } from '../../app/feedback';
import { saveCSV, saveJSON, stamp } from '../../lib/export';
import { useSettings } from '../../app/settings';

export function IntegrityRefs({ refs, reload }: { refs: IntegrityRef[]; reload: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { settings } = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<IntegrityRef | null>(null);
  const [busy, setBusy] = useState<{ id: string; p: number } | null>(null);

  const verify = async (r: IntegrityRef, f: File) => {
    setBusy({ id: r.id, p: 0 });
    const t0 = Date.now();
    try {
      const h = await sha256OfBlob(f, { onProgress: (b) => setBusy({ id: r.id, p: f.size ? b / f.size : 1 }) });
      const ok = h === r.sha256;
      await updateIntegrityRef({ ...r, lastCheck: { at: Date.now(), ok } });
      if (settings.saveHistory) {
        await addHistory({ type: 'verificacao', title: `Verificação de “${r.label}”`, files: 1, bytes: f.size, durationMs: Date.now() - t0, result: ok ? 'sucesso' : 'erro', notes: [ok ? 'Conteúdo idêntico à referência.' : 'Conteúdo DIFERENTE da referência.', `arquivo verificado: ${f.name}`, `calculado: ${h}`, `referência: ${r.sha256}`] });
      }
      toast({ tone: ok ? 'ok' : 'erro', title: ok ? 'Íntegro: idêntico à referência' : 'Diferente da referência', body: ok ? f.name : `${f.name} não tem o mesmo conteúdo de quando a referência foi guardada.` });
      reload();
    } catch (e) {
      toast({ tone: 'erro', title: 'Falha na leitura', body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  if (!refs.length) return <p className="muted">Nenhuma referência guardada. Calcule o hash de um arquivo acima e guarde-o para comparar no futuro.</p>;

  return (
    <div className="refs">
      <div className="btn-row refs-export">
        <button className="btn btn-ghost btn-sm" onClick={async () => { const r = await saveCSV(refs.map((x) => ({ rotulo: x.label, arquivo: x.name, bytes: x.size, sha256: x.sha256, guardadoEm: new Date(x.at).toISOString(), ultimaVerificacao: x.lastCheck ? new Date(x.lastCheck.at).toISOString() : '', resultado: x.lastCheck ? (x.lastCheck.ok ? 'idêntico' : 'diferente') : '' })), `usbi-referencias-${stamp()}.csv`); if (r !== 'cancelado') toast({ tone: 'ok', title: 'Referências exportadas' }); }}>
          <Download aria-hidden /> CSV
        </button>
        <button className="btn btn-ghost btn-sm" onClick={async () => { const r = await saveJSON({ app: 'usb-intelligence', tipo: 'referencias-sha256', referencias: refs }, `usbi-referencias-${stamp()}.json`); if (r !== 'cancelado') toast({ tone: 'ok', title: 'Referências exportadas' }); }}>
          <Download aria-hidden /> JSON
        </button>
      </div>
      <ul className="ref-list">
        {refs.map((r) => (
          <li key={r.id}>
            <div className="ref-main">
              <strong>{r.label}</strong>
              <span className="mono muted">{r.name} · {formatBytes(r.size)} · guardado {formatDateTime(r.at)}</span>
              <code className="num ref-hash">{r.sha256}</code>
              {r.lastCheck && (
                <span className={`tag ${r.lastCheck.ok ? 'ok' : 'err'}`}>
                  {r.lastCheck.ok ? 'idêntico' : 'diferente'} em {formatDateTime(r.lastCheck.at)}
                </span>
              )}
              {busy?.id === r.id && <div className="progress"><i style={{ width: `${busy.p * 100}%` }} /></div>}
            </div>
            <div className="ref-actions">
              <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => { setTarget(r); input.current?.click(); }}>
                <ShieldCheck aria-hidden /> Verificar agora
              </button>
              <button
                className="btn btn-danger btn-sm btn-icon"
                aria-label={`Excluir referência ${r.label}`}
                onClick={async () => {
                  if (await confirm({ title: 'Excluir esta referência?', body: <p>Sem ela, não será possível verificar este arquivo depois. O arquivo em si não é afetado.</p>, confirm: 'Excluir', danger: true })) {
                    await deleteIntegrityRef(r.id);
                    reload();
                  }
                }}
              >
                <Trash2 aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <input ref={input} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f && target) verify(target, f); e.target.value = ''; }} />
    </div>
  );
}
