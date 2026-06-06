import { Link } from 'react-router-dom';

import { getClientTypeLabel } from '../../utils';

// Área D — clientes sem processo vinculado (lista limitada + ver todos).
export function ClientWithoutProcessList({ clients, totalClients, limit = 6 }) {
  const shown = clients.slice(0, limit);
  const rest = clients.length - shown.length;

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Clientes sem processo</h2>
          <p className="section-note">
            {clients.length} de {totalClients} cliente{totalClients !== 1 ? 's' : ''}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/clientes">Ver todos</Link>
      </div>
      {shown.length ? (
        <div className="audit-orphan-list">
          {shown.map((c) => (
            <Link key={c.id} className="audit-orphan-item" to={`/clientes/${c.id}`}>
              <span className="audit-avatar">{c.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{c.name}</strong>
                <span>{getClientTypeLabel(c.clientType)}</span>
              </div>
              <span className="audit-orphan-arrow">Ver →</span>
            </Link>
          ))}
          {rest > 0 ? (
            <Link className="audit-orphan-more" to="/clientes">
              +{rest} cliente{rest !== 1 ? 's' : ''}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="note-box">Todos os clientes têm processos vinculados.</div>
      )}
    </section>
  );
}
