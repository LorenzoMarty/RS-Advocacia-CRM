import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { colorAt, TOOLTIP_STYLE } from './chartTheme';

// Área C — barras empilhadas: processos por área, segmentadas por status.
export function AreaDistribution({ rows, statuses }) {
  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Processos por área</h2>
          <p className="section-note">Volume e composição por status</p>
        </div>
      </div>
      {rows.length ? (
        <div className="audit-chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis dataKey="area" tick={{ fontSize: 11, fill: 'var(--soft)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--soft)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {statuses.map((status, i) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="area"
                  fill={colorAt(i)}
                  radius={i === statuses.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={56}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="note-box">Sem processos cadastrados.</div>
      )}
    </section>
  );
}
