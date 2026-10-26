import { Link } from 'react-router-dom';
import { useDocumentTitle } from './hooks';

export default function NotFound() {
  useDocumentTitle('Endereço não encontrado');
  return (
    <section className="page wrap notfound">
      <p className="label">Erro 404</p>
      <h1 className="mega">Fora<br />do mapa.</h1>
      <p className="lead muted">Este endereço não existe no USB Intelligence.</p>
      <Link className="btn btn-primary" to="/">Voltar ao início</Link>
    </section>
  );
}
