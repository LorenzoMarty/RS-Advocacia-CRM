import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { formatHoursCompact } from '../productivity-data';

// Donut de distribuição. data: [{ name, value (segundos), color }]
export function Donut({ data, height = 200 }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="pd-donut">
      <div className="pd-donut-chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pd-donut-center">
          <span>Total</span>
          <strong>{formatHoursCompact(total)}</strong>
        </div>
      </div>
      <ul className="pd-donut-legend">
        {data.map((item) => (
          <li key={item.name}>
            <span className="pd-dot" style={{ background: item.color }} />
            <span className="pd-legend-label">{item.name}</span>
            <span className="pd-legend-value">{formatHoursCompact(item.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
