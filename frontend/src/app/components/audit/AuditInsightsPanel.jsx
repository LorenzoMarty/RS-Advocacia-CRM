// Área B (lateral) — insights automáticos derivados do resumo de risco.
export function AuditInsightsPanel({ insights }) {
  return (
    <aside className="audit-card surface section-card audit-insights">
      <div className="section-head">
        <div>
          <h2 className="section-title">Insights</h2>
          <p className="section-note">Leitura automática do escritório</p>
        </div>
      </div>
      <ul className="audit-insights-list">
        {insights.map((insight, i) => (
          <li key={i} className={`audit-insight is-${insight.tone}`}>
            <span className="audit-insight-dot" aria-hidden="true" />
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
