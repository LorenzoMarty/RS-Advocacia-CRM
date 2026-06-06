import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { colorAt } from './chartTheme';

// Área C — donut de processos por status, no padrão .pd-donut do projeto.
export function StatusDistribution({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="surface section-card audit-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Processos por status</h2>
          <p className="section-note">{total} processo{total !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {data.length ? (
        <div className="pd-donut">
          <div className="pd-donut-chart" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="status"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={data.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {data.map((entry, i) => (
                    <Cell key={entry.status} fill={colorAt(i)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pd-donut-center">
              <span>Processos</span>
              <strong>{total}</strong>
            </div>
          </div>
          <ul className="pd-donut-legend">
            {data.map((entry, i) => (
              <li key={entry.status}>
                <span className="pd-dot" style={{ background: colorAt(i) }} />
                <span className="pd-legend-label">{entry.status}</span>
                <span className="pd-legend-value">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="note-box">Sem processos cadastrados.</div>
      )}
    </section>
  );
}
