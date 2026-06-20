import { Link } from 'react-router-dom';

function horasFmt(horas) {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ProductivityPanel({ productivity = {} }) {
  const { semanaInicio, porUsuario = [], timersAtivos = 0 } = productivity;

  if (!porUsuario.length && !timersAtivos) {
    return null;
  }

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Produtividade</h2>
          <p className="section-note">
            Semana atual{semanaInicio ? ` — a partir de ${semanaInicio}` : ''}
            {timersAtivos > 0 && (
              <span className="audit-timers-badge"> · {timersAtivos} timer{timersAtivos !== 1 ? 's' : ''} ativos</span>
            )}
          </p>
        </div>
        <Link to="/produtividade" className="section-action">Ver detalhe →</Link>
      </div>
      <ul className="audit-prod-list">
        {porUsuario.map((u) => {
          const tone = u.pct >= 100 ? 'success' : u.pct >= 60 ? 'warn' : 'danger';
          return (
            <li key={u.userId} className="audit-prod-row">
              <span className="audit-prod-name">{u.userName}</span>
              <div className="audit-prod-bar-wrap">
                <div
                  className={`audit-prod-bar is-${tone}`}
                  style={{ width: `${Math.min(u.pct, 100)}%` }}
                />
              </div>
              <span className="audit-prod-hours">
                {horasFmt(u.horas)} / {u.metaHoras}h
              </span>
              <span className={`audit-prod-pct is-${tone}`}>{u.pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
