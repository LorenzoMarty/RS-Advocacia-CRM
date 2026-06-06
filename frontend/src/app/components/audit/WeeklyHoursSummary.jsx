import { Link } from 'react-router-dom';

import { formatHoursCompact } from '../../lib/auditSelectors';

// Área D — horas registradas por usuário na semana, no padrão .pd-hbar.
export function WeeklyHoursSummary({ data }) {
  const max = data[0]?.seconds || 1;

  return (
    <section className="surface section-card audit-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Horas na semana</h2>
          <p className="section-note">Registradas por usuário</p>
        </div>
        <Link className="btn btn-secondary" to="/produtividade">Ver completo</Link>
      </div>
      {data.length ? (
        <ul className="pd-hbars">
          {data.map(({ user, seconds }) => (
            <li key={user.id} className="pd-hbar-row">
              <div className="pd-hbar-head">
                <span className="pd-hbar-label" title={user.name}>{user.name}</span>
                <span className="pd-hbar-value">{formatHoursCompact(seconds)}</span>
              </div>
              <div className="pd-hbar-track">
                <span
                  className="pd-hbar-fill"
                  style={{ width: `${Math.max(2, Math.round((seconds / max) * 100))}%`, background: 'var(--chart-1)' }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="note-box">Nenhum tempo registrado nesta semana.</div>
      )}
    </section>
  );
}
