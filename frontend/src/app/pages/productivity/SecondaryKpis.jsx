import { formatHoursCompact } from './productivity-data';

// KPIs secundários compactos (bento 2x2).
export function SecondaryKpis({ averageTaskSeconds, deliverables, processCount, runningCount }) {
  const items = [
    { label: 'Média / tarefa', value: formatHoursCompact(averageTaskSeconds) },
    { label: 'Prazos + petições', value: deliverables.doneDeadlines.length + deliverables.donePetitions.length },
    { label: 'Processos acompanhados', value: processCount },
    { label: 'Timers rodando', value: runningCount, accent: runningCount > 0 },
  ];

  return (
    <div className="pd-kpis">
      {items.map((item) => (
        <div key={item.label} className={`pd-kpi${item.accent ? ' pd-kpi-accent' : ''}`}>
          <span className="pd-kpi-label">{item.label}</span>
          <strong className="pd-kpi-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
