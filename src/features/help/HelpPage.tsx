import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, RefreshCw, X } from 'lucide-react';
import { runDiagnostics, type Check as CheckT } from './diagnostics';
import { cacheStatus, promptInstall, type CacheStatus } from '../../lib/pwa/pwa';
import { useDocumentTitle, useOnline, usePWA } from '../../app/hooks';
import { useConfirm, useToast } from '../../app/feedback';
import { formatInt } from '../../lib/format';
import './help.css';

const ICON = { ok: Check, aviso: AlertTriangle, falha: X };

export default function HelpPage() {
  useDocumentTitle('Ajuda e diagnóstico');
  const [checks, setChecks] = useState<CheckT[] | null>(null);
  const [cache, setCache] = useState<CacheStatus | null | 'sem'>(null);
  const pwa = usePWA();
  const online = useOnline();
  const toast = useToast();
  const confirm = useConfirm();

  const run = async () => {
    setChecks(null);
    setChecks(await runDiagnostics());
    const st = await cacheStatus();
    setCache(st ?? 'sem');
  };
  useEffect(() => { run(); }, [online, pwa.controlled]);

  const offlineReady = cache && cache !== 'sem' && cache.missing.length === 0;
  const byId = (id: string) => checks?.find((c) => c.id === id)?.status;

  const OFFLINE_FEATURES: [string, boolean, string][] = [
    ['Interface, navegação e páginas', !!offlineReady, 'Servidas pelo cache local.'],
    ['Central de arquivos: seleção, análise, duplicados, organização', !!offlineReady, 'Tudo é calculado no aparelho.'],
    ['Laboratório 3D e personagem', !!offlineReady && byId('webgl') === 'ok', byId('webgl') === 'ok' ? 'Modelos feitos em código: nada a baixar.' : 'Sem WebGL: ilustrações planas.'],
    ['Hash, verificação e cofre', !!offlineReady && byId('crypto') === 'ok', 'Web Crypto local.'],
    ['Histórico, relatórios, personagens salvos', byId('idb') === 'ok', 'IndexedDB deste navegador.'],
    ['Fontes', !!offlineReady, 'Hospedadas no próprio app (sem Google Fonts).'],
  ];

  return (
    <div className="page help-page">
      <div className="wrap">
        <header className="page-head">
          <span className="page-n outline-num" aria-hidden>09</span>
          <div>
            <span className="label">Ajuda e diagnóstico</span>
            <h1 className="h1">Como funciona,<br />de verdade.</h1>
          </div>
          <p className="lead muted">Verificações feitas agora neste aparelho, e guias para Android, pendrive e uso offline.</p>
        </header>

        <section className="diag" aria-labelledby="d-title">
          <div className="diag-head">
            <h2 id="d-title" className="h2">Diagnóstico</h2>
            <div className="btn-row">
              <button className="btn btn-ghost btn-sm" onClick={run}><RefreshCw aria-hidden /> Verificar de novo</button>
              {pwa.installable && (
                <button className="btn btn-primary btn-sm" onClick={async () => { const r = await promptInstall(); if (r === 'accepted') toast({ tone: 'ok', title: 'App instalado' }); }}>Instalar app</button>
              )}
            </div>
          </div>
          {!checks ? (
            <div className="progress indet" style={{ maxWidth: 240 }}><i /></div>
          ) : (
            <ul className="diag-list">
              {checks.map((c) => {
                const Icon = ICON[c.status];
                return (
                  <li key={c.id} className={`diag-item is-${c.status}`}>
                    <span className="diag-icon"><Icon aria-hidden /></span>
                    <span className="diag-label">{c.label}</span>
                    <span className="sr-only">{c.status === 'ok' ? 'ok' : c.status === 'aviso' ? 'atenção' : 'falha'}:</span>
                    <span className="diag-detail muted">{c.detail}</span>
                  </li>
                );
              })}
              <li className={`diag-item is-${offlineReady ? 'ok' : 'aviso'}`}>
                <span className="diag-icon">{offlineReady ? <Check aria-hidden /> : <AlertTriangle aria-hidden />}</span>
                <span className="diag-label">Arquivos essenciais em cache</span>
                <span className="diag-detail muted">
                  {cache === null ? 'Consultando…' : cache === 'sem' ? 'Service worker não está controlando esta página; nada foi verificado.' : `${formatInt(cache.total - cache.missing.length)} de ${formatInt(cache.total)} arquivos da versão ${cache.version}${cache.missing.length ? ` · faltam: ${cache.missing.slice(0, 3).join(', ')}${cache.missing.length > 3 ? '…' : ''}` : ''}`}
                </span>
              </li>
            </ul>
          )}

          <h3 className="h3 off-title">O que funciona sem internet neste aparelho</h3>
          <ul className="off-list">
            {OFFLINE_FEATURES.map(([name, ok, note]) => (
              <li key={name}>
                <span className={`tag ${ok ? 'ok' : 'warn'}`}>{ok ? 'pronto' : 'não preparado'}</span>
                <span>{name}</span>
                <span className="muted">{note}</span>
              </li>
            ))}
          </ul>
          {pwa.controlled && (
            <button className="btn btn-quiet btn-sm" onClick={async () => {
              if (!(await confirm({ title: 'Limpar o cache offline?', body: <p>O app é recarregado e baixa os arquivos de novo (precisa de internet). Seus dados locais não são afetados.</p>, confirm: 'Limpar e recarregar' }))) return;
              const keys = await caches.keys();
              await Promise.all(keys.filter((k) => k.startsWith('usbi-')).map((k) => caches.delete(k)));
              const regs = await navigator.serviceWorker.getRegistrations();
              await Promise.all(regs.map((r) => r.unregister()));
              location.reload();
            }}>Limpar cache offline</button>
          )}
        </section>

        <section className="guides" aria-label="Guias">
          <details className="guide" open>
            <summary><span className="mono">G1</span> Instalar no Android</summary>
            <ol className="prose">
              <li>Abra o endereço do USB Intelligence no <strong>Chrome</strong> (precisa ser HTTPS).</li>
              <li>Toque no menu <strong>⋮</strong> e escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. {pwa.installable ? 'Ou use o botão “Instalar app” acima.' : ''}</li>
              <li>Abra pelo ícone novo. Navegue uma vez por <Link to="/arquivos">Central</Link>, <Link to="/laboratorio">Laboratório</Link> e <Link to="/personagem">Personagem</Link> com internet.</li>
              <li>Volte aqui: “Arquivos essenciais em cache” deve indicar todos os arquivos. A partir daí, funciona sem internet.</li>
            </ol>
            <p className="hint">No iPhone (Safari): botão Compartilhar → “Adicionar à Tela de Início”. O Safari pode apagar dados de apps pouco usados.</p>
          </details>

          <details className="guide">
            <summary><span className="mono">G0</span> Apagar, renomear e mover arquivos de verdade</summary>
            <div className="prose">
              <p>Na Central de arquivos, use <strong>Conectar pasta</strong>. O sistema pede sua permissão para uma pasta (pode ser a raiz do pendrive) e, a partir daí, o app consegue:</p>
              <ul>
                <li>renomear (com checagem de nomes que o FAT32/Windows recusam);</li>
                <li>mover para outras pastas, criando-as quando preciso, sem nunca sobrescrever;</li>
                <li>mandar para a <strong>lixeira do USB Intelligence</strong> (pasta <code className="inline">.usbi-lixeira</code> dentro da própria pasta, com restauração);</li>
                <li>apagar definitivamente (exige digitar APAGAR);</li>
                <li>aplicar a organização proposta, movendo os arquivos;</li>
                <li>desfazer a última operação da sessão.</li>
              </ul>
              <p>Onde funciona: <strong>Chrome ou Edge no computador</strong> (Windows, macOS, Linux, ChromeOS) e o <strong>app Android do USB Intelligence</strong>. O Chrome do Android não oferece acesso a pastas para sites — por isso existe o app.</p>
            </div>
          </details>

          <details className="guide">
            <summary><span className="mono">G2</span> Usar o pendrive com OTG</summary>
            <ol className="prose">
              <li>Conecte o pendrive ao adaptador OTG e o adaptador ao celular. O Android mostra uma notificação de “Unidade USB”.</li>
              <li>Pendrives de 16 GB costumam vir em FAT32 ou exFAT, lidos pela maioria dos Android. NTFS geralmente não.</li>
              <li>No app, toque em <strong>Escolher arquivos</strong>. No seletor do Android, abra o menu lateral e escolha o pendrive. Marque vários arquivos com toque longo.</li>
              <li>No <strong>app Android</strong>: “Conectar pasta” → escolha o pendrive no seletor → “Usar esta pasta” → “Permitir”. Daí dá para renomear, mover e apagar direto no pendrive.</li>
              <li>Para salvar relatórios no pendrive: no app Android, a exportação abre o “Salvar como” do sistema; no navegador, exporte e mova pelo app “Arquivos”.</li>
              <li>Antes de desconectar, use “Ejetar” na notificação do Android.</li>
            </ol>
            <p className="hint">O app nunca abre o pendrive sozinho nem detecta quando ele é conectado: cada acesso passa pelo seletor do sistema e pela sua escolha.</p>
          </details>

          <details className="guide">
            <summary><span className="mono">G3</span> Levar o app no pendrive</summary>
            <div className="prose">
              <p>O pacote de distribuição (<code className="inline">npm run package:usb</code>) gera uma pasta com o app compilado, o servidor local e as instruções. Copie a pasta inteira para o pendrive.</p>
              <p>Num computador com Node.js: <code className="inline">node servir.mjs</code> dentro da pasta e abra <code className="inline">http://localhost:4321</code>. Por ser localhost, criptografia e modo offline funcionam.</p>
              <p>Dar dois cliques no <code className="inline">index.html</code> <strong>não funciona</strong>: navegadores bloqueiam módulos JavaScript abertos como arquivo.</p>
            </div>
          </details>

          <details className="guide">
            <summary><span className="mono">G4</span> PWA, pendrive, servidor local ou app nativo?</summary>
            <table className="cmp">
              <thead><tr><th>Forma</th><th>Como roda</th><th>Offline</th><th>Acesso a arquivos</th></tr></thead>
              <tbody>
                <tr><td>PWA instalada (HTTPS)</td><td>Ícone na tela inicial; cache do navegador</td><td>Sim, após a primeira visita</td><td>Só o que você seleciona</td></tr>
                <tr><td>Arquivos copiados no pendrive</td><td>Não rodam sozinhos: precisam de um servidor</td><td>—</td><td>—</td></tr>
                <tr><td>Servidor local (servir.mjs)</td><td>Node.js serve a pasta em localhost</td><td>Sim, sem internet nenhuma</td><td>Só o que você seleciona; no Chrome do PC, também pastas</td></tr>
                <tr><td>App Android (APK)</td><td>Capacitor + plugin nativo (pasta <code className="inline">android/</code>)</td><td>Sim, desde a instalação</td><td>Pasta ou pendrive escolhido: renomear, mover, apagar</td></tr>
              </tbody>
            </table>
            <p className="hint">Service worker não deixa qualquer cópia de arquivos offline por mágica: ele só funciona em HTTPS ou localhost, depois de uma visita que preencha o cache.</p>
          </details>

          <details className="guide">
            <summary><span className="mono">G5</span> Limites conhecidos</summary>
            <ul className="prose">
              <li>Arquivos escolhidos pelo seletor comum só podem ser analisados. Para apagar, mover ou renomear é preciso “Conectar pasta” (Chrome/Edge no computador ou app Android).</li>
              <li>A lixeira do app é uma pasta dentro da pasta conectada: só libera espaço quando é esvaziada.</li>
              <li>Hash compara conteúdo; não detecta vírus nem garante que o arquivo abre.</li>
              <li>Cofre: até 1 GB por arquivo, processado na memória.</li>
              <li>Arquivos selecionados não sobrevivem ao recarregar a página — o navegador não guarda esse acesso. Os relatórios ficam.</li>
              <li>Os números do “Painel” refletem só os arquivos da seleção atual.</li>
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}
