import { RefreshCw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOnline, usePWA } from '../../app/hooks';
import { applyUpdate } from '../../lib/pwa/pwa';

/** Faixa fina sob o cabeçalho: só aparece quando há algo a dizer. */
export function StatusBar() {
  const online = useOnline();
  const pwa = usePWA();
  if (online && !pwa.updateWaiting) return null;
  return (
    <div className="status-bar" role="status">
      {!online && (
        <p>
          <WifiOff aria-hidden /> Sem conexão. {pwa.controlled ? 'O app continua funcionando com o que já está salvo neste aparelho.' : 'Os recursos offline ainda não foram preparados neste aparelho.'}{' '}
          <Link to="/ajuda">Ver o que funciona offline</Link>
        </p>
      )}
      {pwa.updateWaiting && (
        <p>
          <RefreshCw aria-hidden /> Nova versão pronta.
          <button className="btn btn-sm btn-primary" onClick={applyUpdate}>Atualizar agora</button>
        </p>
      )}
    </div>
  );
}
