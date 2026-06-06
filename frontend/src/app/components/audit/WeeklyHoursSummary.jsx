import { Link } from 'react-router-dom';

import { progressPercent, formatHoursCompact } from '../../lib/auditSelectors';

// Área D — horas registradas por usuário na semana.
export function WeeklyHoursSummary({ data }) {
  const max = data[0]?.seconds || 0;

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Horas na semana</h2>
          <p className="section-note">Registradas por usuário</p>
        </div>
        <Link className="btn btn-secondary" to="/produtividade">Ver completo</Link>
      </div>
      {data.length ? (
        <div className="audit-bar-list">
          {data.map(({ user, seconds }) => (
            <div key={user.id} className="audit-bar-row">
              <strong>{user.name}</strong>
              <div className="productivity-bar">
                <span style={{ width: `${progressPercent(seconds, max)}%` }} />
              </div>
              <span>{formatHoursCompact(seconds)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="note-box">Nenhum tempo registrado nesta semana.</div>
      )}
    </section>
  );
}
