import { Link } from 'react-router-dom';

import { formatDateTime } from '../../utils';

function EventItem({ evento }) {
  return (
    <li className="audit-event-item">
      <div className="audit-event-main">
        <strong className="audit-event-title">{evento.titulo}</strong>
        <span className="audit-event-meta">
          {evento.tipoEvento && <span>{evento.tipoEvento}</span>}
          {evento.responsavelNome && <span> · {evento.responsavelNome}</span>}
          {evento.processoNumero && <span> · {evento.processoNumero}</span>}
        </span>
        <span className="audit-event-date">{formatDateTime(evento.dataInicio)}</span>
      </div>
    </li>
  );
}

export function EventsPanel({ eventos = {} }) {
  const { proximos = [], atrasados = [], totalPendentes = 0 } = eventos;

  if (!proximos.length && !atrasados.length) {
    return null;
  }

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Compromissos</h2>
          <p className="section-note">
            {totalPendentes} pendente{totalPendentes !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/agenda" className="section-action">Ver agenda →</Link>
      </div>
      <div className="audit-events-grid">
        {atrasados.length > 0 && (
          <div className="audit-events-col">
            <h3 className="audit-events-col-head is-danger">
              Atrasados <span>{atrasados.length}</span>
            </h3>
            <ul className="audit-event-list">
              {atrasados.map((e) => <EventItem key={e.id} evento={e} />)}
            </ul>
          </div>
        )}
        {proximos.length > 0 && (
          <div className="audit-events-col">
            <h3 className="audit-events-col-head">
              Próximos <span>{proximos.length}</span>
            </h3>
            <ul className="audit-event-list">
              {proximos.map((e) => <EventItem key={e.id} evento={e} />)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
