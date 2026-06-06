import {
  Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts';

import { colorAt, TOOLTIP_STYLE } from './chartTheme';

// Área C — donut de processos por status.
export function StatusDistribution({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Processos por status</h2>
          <p className="section-note">{total} processo{total !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {data.length ? (
        <div className="audit-chart">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, i) => (
                  <Cell key={entry.status} fill={colorAt(i)} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="note-box">Sem processos cadastrados.</div>
      )}
    </section>
  );
}
