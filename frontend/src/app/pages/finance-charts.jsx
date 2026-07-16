import { useEffect, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts';

import { colorAt } from '../components/audit/chartTheme';
import { AnimatePresence, motion as Motion, prefersReducedMotion } from '../motion';
import { formatCurrency } from './financeiro-utils';

export function SortArrow({ active, dir }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {active ? (
        <Motion.svg
          key={dir}
          className="financeiro-sort-arrow"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          initial={{ opacity: 0, y: dir === 'asc' ? 3 : -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: dir === 'asc' ? -3 : 3 }}
          transition={{ duration: 0.14 }}
        >
          {dir === 'asc' ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
        </Motion.svg>
      ) : null}
    </AnimatePresence>
  );
}

// Conta de um valor anterior até o alvo (easeOutCubic). Colapsa sob reduced-motion.
function useCountUp(target, duration = 0.7) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      fromRef.current = target;
      return undefined;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export function MetricValue({ value }) {
  return <strong>{formatCurrency(useCountUp(value))}</strong>;
}

// Setor destacado (cresce + halo) renderizado para a fatia em hover/foco.
function ActiveSlice(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 11}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.45}
      />
    </g>
  );
}

export function CategoryDonut({ title, data, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const total = data.reduce((sum, item) => sum + Number(item.total || item.value || 0), 0);
  const animatedTotal = useCountUp(total);

  if (!data.length || total <= 0) {
    return (
      <div className="finance-chart">
        <h3>{title}</h3>
        <p className="section-note">Sem dados.</p>
      </div>
    );
  }

  const chartData = data.map((item) => ({ name: item.categoria || item.name, value: Number(item.total || item.value || 0) }));
  const active = activeIndex >= 0 ? chartData[activeIndex] : null;
  const centerValue = active ? active.value : animatedTotal;
  const centerLabel = active ? active.name : 'Total';
  const percent = active ? Math.round((active.value / total) * 100) : 100;

  return (
    <div className="finance-chart">
      <h3>{title}</h3>
      <div className="finance-donut">
        <div className="finance-donut-chart" onMouseLeave={() => setActiveIndex(-1)}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="90%"
                paddingAngle={chartData.length > 1 ? 2 : 0}
                stroke="none"
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                activeShape={ActiveSlice}
                isAnimationActive={!prefersReducedMotion()}
                animationDuration={520}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onClick={(_, index) => onSelect?.(chartData[index].name)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={colorAt(index)}
                    style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="finance-donut-center">
            <span className="finance-donut-pct">{percent}%</span>
            <strong>{formatCurrency(centerValue)}</strong>
            <span className="finance-donut-label">{centerLabel}</span>
          </div>
        </div>
        <ul className="finance-legend">
          {chartData.map((entry, index) => (
            <li
              key={entry.name}
              className={`finance-legend-item${activeIndex === index ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <button
                type="button"
                className="finance-legend-btn"
                onClick={() => onSelect?.(entry.name)}
                title={onSelect ? `Filtrar por ${entry.name}` : undefined}
              >
                <span className="finance-dot" style={{ background: colorAt(index) }} />
                <span className="finance-legend-label">{entry.name}</span>
                <span className="finance-legend-value">{formatCurrency(entry.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
