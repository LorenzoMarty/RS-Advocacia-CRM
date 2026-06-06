import { Link } from 'react-router-dom';

// Métrica de alerta como célula da faixa .productivity-kpis do projeto.
// `tone` colore só o valor: danger | warn | success | gold.
export function AlertCard({ label, value, hint, tone = 'gold', to }) {
  const content = (
    <>
      <span>{label}</span>
      <strong className={`audit-kpi-value is-${tone}`}>{value}</strong>
      {hint ? <em className="audit-kpi-hint">{hint}</em> : null}
    </>
  );

  if (to) {
    return <Link className="productivity-kpi audit-kpi" to={to}>{content}</Link>;
  }
  return <div className="productivity-kpi">{content}</div>;
}
