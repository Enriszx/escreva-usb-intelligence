import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HashTool } from './HashTool';
import { IntegrityRefs } from './IntegrityRefs';
import { VaultTool } from './VaultTool';
import { listIntegrityRefs, type IntegrityRef } from '../../lib/storage/repos';
import { useDocumentTitle } from '../../app/hooks';
import { Topo } from '../../components/ui/Topo';
import { StorageInfo } from '../settings/StorageInfo';
import './security.css';

export default function SecurityPage() {
  useDocumentTitle('Segurança');
  const [refs, setRefs] = useState<IntegrityRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    listIntegrityRefs().then(setRefs).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);
  const cryptoOk = !!globalThis.crypto?.subtle;

  return (
    <div className="page sec-page">
      <Topo seed={44} levels={9} className="sec-topo" />
      <div className="wrap">
        <header className="page-head">
          <span className="page-n outline-num" aria-hidden>05</span>
          <div>
            <span className="label">Segurança e integridade</span>
            <h1 className="h1">Prova,<br />não promessa.</h1>
          </div>
          <p className="lead muted">Ferramentas com garantias matemáticas claras — e com os limites delas escritos ao lado.</p>
        </header>

        {!cryptoOk && (
          <div className="callout-err" role="alert">
            A Web Crypto API não está disponível. Ela exige HTTPS ou localhost. Abra o app pelo endereço seguro ou pelo servidor local (veja Ajuda).
          </div>
        )}

        <div className="sec-grid">
          <section className="sec-block sec-hash" aria-labelledby="s-hash">
            <div className="sec-label"><span className="mono">A</span><h2 id="s-hash" className="h2">Impressão digital SHA-256</h2></div>
            <p className="muted sec-intro">Calcule o hash de qualquer arquivo e compare com o valor publicado por quem o distribuiu. Se bater, o conteúdo é idêntico, byte a byte.</p>
            <HashTool onSaved={reload} />
          </section>

          <aside className="sec-truth" aria-label="O que o hash não faz">
            <p className="label">Leia antes</p>
            <p className="sec-truth-big">Hash não é antivírus.</p>
            <p>Um SHA-256 igual prova que dois arquivos têm o mesmo conteúdo. Ele <strong>não</strong> diz se o conteúdo é seguro, se está livre de malware ou se o arquivo abre corretamente.</p>
            <p>Um hash diferente prova apenas que algo mudou — não o quê, nem por quê.</p>
          </aside>

          <section className="sec-block" aria-labelledby="s-refs">
            <div className="sec-label"><span className="mono">B</span><h2 id="s-refs" className="h2">Verificação posterior</h2></div>
            <p className="muted sec-intro">Referências guardadas neste dispositivo. Escolha o arquivo de novo meses depois — por exemplo, do pendrive — e confirme se ele continua igual.</p>
            {error ? <p className="error-text">{error}</p> : <IntegrityRefs refs={refs} reload={reload} />}
          </section>

          <section className="sec-block sec-vault" aria-labelledby="s-vault" data-tone="noite">
            <div className="sec-label"><span className="mono">C</span><h2 id="s-vault" className="h2">Cofre AES-256-GCM</h2></div>
            <div className="vault-grid">
              <div>
                <p className="muted sec-intro">
                  Transforma um arquivo num cofre <code className="inline">.usbi</code> que só abre com a sua senha. Tudo acontece neste aparelho.
                </p>
                <VaultTool />
              </div>
              <dl className="vault-spec">
                <div><dt className="mono muted">Cifra</dt><dd>AES-256-GCM (autenticada: detecta alteração)</dd></div>
                <div><dt className="mono muted">Chave</dt><dd>PBKDF2-SHA-256, 600 mil iterações, salt aleatório de 16 bytes</dd></div>
                <div><dt className="mono muted">Nonce</dt><dd>12 bytes aleatórios, novos a cada cofre</dd></div>
                <div><dt className="mono muted">Senha</dt><dd>Nunca é guardada. Sem ela, não há recuperação — nem por nós.</dd></div>
                <div><dt className="mono muted">Original</dt><dd>Não é apagado. Decida você o que fazer com ele.</dd></div>
                <div><dt className="mono muted">Limite</dt><dd>Até 1 GB por arquivo (processado na memória)</dd></div>
              </dl>
            </div>
            <p className="hint">O pendrive em si continua sendo um pendrive comum: a proteção está no arquivo cifrado, não no hardware.</p>
          </section>

          <section className="sec-block" aria-labelledby="s-priv">
            <div className="sec-label"><span className="mono">D</span><h2 id="s-priv" className="h2">Privacidade</h2></div>
            <div className="priv-grid">
              <div className="prose">
                <p>O USB Intelligence não tem servidor de dados. Não há contas, rastreadores nem envio de arquivos.</p>
                <p>Ficam neste dispositivo, no IndexedDB do navegador: configurações, personagens, histórico, relatórios (nomes, tamanhos e hashes — nunca o conteúdo) e referências de integridade.</p>
                <p><Link to="/configuracoes">Exportar ou apagar os dados locais</Link></p>
              </div>
              <StorageInfo />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
