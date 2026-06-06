import { Link } from 'react-router-dom';

import { getClientTypeLabel } from '../../utils';

// Área D — clientes sem processo (lista no padrão .productivity-task-item + ver todos).
export function ClientWithoutProcessList({ clients, totalClients, limit = 6 }) {
  const shown = clients.slice(0, limit);
  const rest = clients.length - shown.length;

  return (
    <section className="surface section-card audit-card">
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
        <div className="productivity-task-list">
          {shown.map((c) => (
            <Link key={c.id} className="productivity-task-item" to={`/clientes/${c.id}`}>
              <span className="productivity-type-icon">{c.name.slice(0, 1).toUpperCase()}</span>
              <div className="productivity-task-info">
                <strong>{c.name}</strong>
                <span>{getClientTypeLabel(c.clientType)}</span>
              </div>
              <span className="audit-row-arrow">Ver →</span>
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
