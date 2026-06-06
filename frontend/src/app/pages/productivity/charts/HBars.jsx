import { formatHoursCompact } from '../productivity-data';

// Barras horizontais leves (CSS) — mais legíveis que eixos para listas curtas.
// data: [{ key, label, sublabel?, seconds, color? }]
export function HBars({ data, max, color = 'var(--chart-1)' }) {
  const peak = max || data.reduce((m, item) => Math.max(m, item.seconds), 0) || 1;

  return (
    <ul className="pd-hbars">
      {data.map((item) => (
        <li key={item.key} className="pd-hbar-row">
          <div className="pd-hbar-head">
            <span className="pd-hbar-label" title={item.label}>{item.label}</span>
            <span className="pd-hbar-value">{formatHoursCompact(item.seconds)}</span>
          </div>
          <div className="pd-hbar-track">
            <span
              className="pd-hbar-fill"
              style={{ width: `${Math.max(2, Math.round((item.seconds / peak) * 100))}%`, background: item.color || color }}
            />
          </div>
          {item.sublabel ? <span className="pd-hbar-sub">{item.sublabel}</span> : null}
        </li>
      ))}
    </ul>
  );
}
