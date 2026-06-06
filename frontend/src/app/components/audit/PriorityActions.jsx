import { Link } from 'react-router-dom';

import { StatusBadge } from '../../layout';
import { formatDate } from '../../utils';
import { EmptyState } from '../../pages/common';

// Área B — "Precisa de atenção agora": top itens ordenados por severidade.
export function PriorityActions({ actions }) {
  return (
    <section className="audit-card surface section-card audit-priority">
      <div className="section-head">
        <div>
          <h2 className="section-title">Precisa de atenção agora</h2>
          <p className="section-note">Itens mais urgentes, por severidade</p>
        </div>
      </div>
      {actions.length ? (
        <ol className="audit-priority-list">
          {actions.map((item) => (
            <li key={item.id}>
              <Link className={`audit-priority-item is-${item.tone}`} to={item.to}>
                <span className="audit-priority-rail" aria-hidden="true" />
                <div className="audit-priority-main">
                  <strong>{item.title}</strong>
                  <span>
                    {item.responsible}
                    {item.date ? ` • ${formatDate(item.date)}` : ''}
                  </span>
                </div>
                <StatusBadge tone={item.tone}>{item.action}</StatusBadge>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Nada urgente no momento."
          copy="Sem prazos críticos ou processos parados. Bom trabalho."
        />
      )}
    </section>
  );
}
