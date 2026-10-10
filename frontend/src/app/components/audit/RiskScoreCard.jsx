import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from '../../motion';

const LEVEL_COLORS = {
  healthy: 'var(--success)',
  warning: 'var(--warn)',
  critical: 'var(--danger)',
};

// Fundo do bloco e cor do rótulo por nível (mock: bloco tingido à esquerda do resumo).
const LEVEL_TILE = {
  healthy: { bg: 'var(--success-soft)', ink: 'var(--success-ink)' },
  warning: { bg: 'var(--warn-soft)', ink: 'var(--warn-ink)' },
  critical: { bg: 'var(--danger-soft)', ink: 'var(--danger-ink)' },
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
  const color = LEVEL_COLORS[level] || 'var(--accent)';
  const tile = LEVEL_TILE[level] || { bg: 'var(--surface-2)', ink: 'var(--ink)' };
  const ring = {
    background: `conic-gradient(${color} ${displayScore * 3.6}deg, color-mix(in srgb, ${color} 25%, transparent) ${displayScore * 3.6}deg)`,
  };

  return (
    <div
      className="relative flex items-center gap-4 overflow-hidden rounded-md px-3.5 py-3"
      style={{ background: tile.bg }}
    >
      <div
        className="grid size-[60px] flex-shrink-0 place-items-center rounded-full"
        style={ring}
      >
        <div
          className="grid size-[46px] place-items-center rounded-full text-center leading-none"
          style={{ background: tile.bg }}
        >
          <strong className="text-[1.29rem] font-extrabold tabular-nums">{displayScore}</strong>
        </div>
      </div>
      <div className="grid min-w-0 gap-0.5">
        <span className="text-[1.14rem] font-extrabold" style={{ color: tile.ink }}>{label}</span>
        <p className="m-0 text-[.86rem] font-semibold text-ink-2">Índice de risco operacional · {displayScore}/100</p>
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
