import { useEffect, useState } from 'react';
import { HardDrive } from 'lucide-react';
import { formatBytes, formatInt, pct } from '../../lib/format';
import { dumpAll, type StoreName } from '../../lib/storage/db';
import { useToast } from '../../app/feedback';

const STORE_LABEL: Record<StoreName, string> = {
  settings: 'Configurações e rascunhos',
  characters: 'Personagens',
  history: 'Registros de histórico',
  reports: 'Relatórios',
  integrity: 'Referências de integridade',
};

export function useStorageEstimate() {
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const refresh = () => {
    navigator.storage?.estimate?.().then((e) => setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => setEst(null));
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  };
  useEffect(refresh, []);
  return { est, persisted, refresh };
}

export function StorageInfo({ counts: showCounts = true }: { counts?: boolean }) {
  const toast = useToast();
  const { est, persisted, refresh } = useStorageEstimate();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!showCounts) return;
    dumpAll().then((d) => setCounts(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.length])))).catch(() => setCounts(null));
  }, [showCounts]);
  const high = est && est.quota > 0 && est.usage / est.quota > 0.8;

  return (
    <div className="storage-info">
      <p className="label"><HardDrive size={14} aria-hidden /> Armazenamento deste navegador</p>
      {est ? (
        <>
          <p className="storage-num num">{formatBytes(est.usage)} <span className="muted">de {formatBytes(est.quota)} disponíveis para o app</span></p>
          <div className="progress"><i style={{ width: est.quota ? pct(est.usage, est.quota).replace(',', '.') : '0%' }} /></div>
          {high && <p className="error-text">Mais de 80% da cota usada. Exporte e apague relatórios antigos em Configurações.</p>}
          <p className="hint">Inclui o cache offline do app. A cota é definida pelo navegador e pode mudar.</p>
        </>
      ) : (
        <p className="muted">O navegador não informa o uso de armazenamento.</p>
      )}
      {counts && (
        <ul className="store-counts">
          {Object.entries(counts).map(([k, v]) => (
            <li key={k}><span>{STORE_LABEL[k as StoreName]}</span><span className="num">{formatInt(v)}</span></li>
          ))}
        </ul>
      )}
      <div className="persist-row">
        <span>{persisted === null ? 'Persistência: não informada' : persisted ? 'Armazenamento persistente: ativo' : 'Armazenamento persistente: não garantido'}</span>
        {persisted === false && navigator.storage?.persist && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              const ok = await navigator.storage.persist();
              refresh();
              toast({ tone: ok ? 'ok' : 'info', title: ok ? 'Persistência concedida' : 'O navegador recusou', body: ok ? 'O navegador não vai apagar estes dados para liberar espaço.' : 'Instalar o app na tela inicial costuma aumentar a chance de aceite.' });
            }}
          >
            Pedir persistência
          </button>
        )}
      </div>
    </div>
  );
}
