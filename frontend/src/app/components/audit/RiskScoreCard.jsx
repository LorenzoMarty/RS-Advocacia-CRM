const LEVEL_COLORS = {
  healthy: 'var(--success)',
  warning: 'var(--warn)',
  critical: 'var(--danger)',
};

export function RiskScoreCard({ score, level, label, drivers = [] }) {
  const color = LEVEL_COLORS[level] || 'var(--gold)';
  const ring = {
    background: `conic-gradient(${color} ${score * 3.6}deg, var(--line) ${score * 3.6}deg)`,
  };

  return (
    <div className={`risk-score-card is-${level}`}>
      <div className="risk-score-ring" style={ring}>
        <div className="risk-score-inner">
          <strong>{score}</strong>
          <span>de 100</span>
        </div>
      </div>
      <div className="risk-score-body">
        <span className="risk-score-label" style={{ color }}>{label}</span>
        <p className="section-note">Índice de risco operacional</p>
        {drivers.length ? (
          <ul className="risk-score-drivers">
            {drivers.map((d) => (
              <li key={d.key}>
                <span>{d.label}</span>
                <strong>{d.value}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="risk-score-clean">Sem fatores de risco relevantes.</p>
        )}
      </div>
    </div>
  );
}
