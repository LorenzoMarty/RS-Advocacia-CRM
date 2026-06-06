import { Area, AreaChart, ResponsiveContainer } from 'recharts';

// Mini gráfico de tendência (sem eixos) para o Hero KPI.
export function Sparkline({ data, height = 56 }) {
  if (!data?.length) {
    return null;
  }
  return (
    <div className="pd-sparkline" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id="pd-spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="seconds"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#pd-spark-fill)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
