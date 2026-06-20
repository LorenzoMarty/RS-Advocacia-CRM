import { Link } from 'react-router-dom';

function KpiTile({ label, value, tone }) {
  return (
    <div className={`audit-deadline-tile is-${tone}`}>
      <strong className="audit-deadline-value">{value}</strong>
      <span className="audit-deadline-label">{label}</span>
    </div>
  );
}

export function DeadlinesPanel({ prazos = {} }) {
  const { overdue = 0, today = 0, dueSoon = 0, done = 0 } = prazos;
  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Prazos</h2>
          <p className="section-note">Visão geral de vencimentos</p>
        </div>
        <Link to="/prazos" className="section-action">Ver todos →</Link>
      </div>
      <div className="audit-deadline-grid">
        <KpiTile label="Vencidos" value={overdue} tone={overdue ? 'danger' : 'neutral'} />
        <KpiTile label="Vencem hoje" value={today} tone={today ? 'warn' : 'neutral'} />
        <KpiTile label="Vencendo em breve" value={dueSoon} tone={dueSoon ? 'gold' : 'neutral'} />
        <KpiTile label="Concluídos" value={done} tone="success" />
      </div>
    </section>
  );
}
