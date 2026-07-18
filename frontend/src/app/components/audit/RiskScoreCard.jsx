import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../motion';

const LEVEL_COLORS = {
  healthy: 'var(--success)',
  warning: 'var(--warn)',
  critical: 'var(--danger)',
};

const LEVEL_RAIL = {
  healthy: 'before:bg-success',
  warning: 'before:bg-warn',
  critical: 'before:bg-destructive',
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
    <div
      className={`relative flex items-center gap-3.5 overflow-hidden rounded-lg bg-muted/40 p-3 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${LEVEL_RAIL[level] || 'before:bg-primary'}`}
    >
      <div
        className="grid h-[94px] w-[94px] flex-shrink-0 place-items-center rounded-full shadow-[inset_0_0_0_1px_var(--line)]"
        style={ring}
      >
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-card text-center leading-none shadow-lg">
          <strong className="text-2xl tabular-nums tracking-tight">{displayScore}</strong>
          <span className="text-[0.58rem] uppercase tracking-wider text-muted-foreground">de 100</span>
        </div>
      </div>
      <div className="grid min-w-0 gap-0.5">
        <span className="font-serif text-2xl font-normal leading-tight" style={{ color }}>{label}</span>
        <p className="section-note">Índice de risco operacional</p>
        {drivers.length ? (
          <ul className="mt-2 grid list-none gap-1 p-0">
            {drivers.map((d) => (
              <li key={d.key} className="flex justify-between gap-2.5 text-sm text-muted-foreground">
                <span>{d.label}</span>
                <strong className="text-foreground tabular-nums">{d.value}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Sem fatores de risco relevantes.</p>
        )}
      </div>
    </div>
  );
}
