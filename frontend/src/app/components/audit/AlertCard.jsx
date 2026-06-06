import { Link } from 'react-router-dom';

// Compact KPI/alert card. `tone` controls accent: danger | warn | success | gold.
export function AlertCard({ label, value, hint, tone = 'gold', to }) {
  const content = (
    <>
      <span className="alert-card-label">{label}</span>
      <strong className="alert-card-value">{value}</strong>
      {hint ? <span className="alert-card-hint">{hint}</span> : null}
    </>
  );

  if (to) {
    return <Link className={`alert-card is-${tone}`} to={to}>{content}</Link>;
  }
  return <div className={`alert-card is-${tone}`}>{content}</div>;
}
