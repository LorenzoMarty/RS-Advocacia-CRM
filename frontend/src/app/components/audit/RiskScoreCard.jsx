import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../motion';

const LEVEL_COLORS = {
  healthy: 'var(--success)',
  warning: 'var(--warn)',
  critical: 'var(--danger)',
};

// Sobe de 0 até o score no primeiro paint (easeOutCubic) — o anel some
// "já pronto" sem dar contexto de que é um cálculo ao vivo. Colapsa sob
// prefers-reduced-motion.
function useRiseIn(target, duration = 0.8) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return undefined;
    startedRef.current = true;

    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

export function RiskScoreCard({ score, level, label, drivers = [] }) {
  const displayScore = useRiseIn(score);
  const color = LEVEL_COLORS[level] || 'var(--gold)';
  const ring = {
    background: `conic-gradient(${color} ${displayScore * 3.6}deg, var(--line) ${displayScore * 3.6}deg)`,
  };

  return (
    <div className={`risk-score-card is-${level}`}>
      <div className="risk-score-ring" style={ring}>
        <div className="risk-score-inner">
          <strong>{displayScore}</strong>
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
