import { useState } from 'react';

import { Donut } from './charts/Donut';
import { HBars } from './charts/HBars';
import { taskTypeColor, taskTypeLabel } from './productivity-data';

const TABS = [
  { key: 'process', label: 'Processo' },
  { key: 'task', label: 'Tarefa' },
];

// Distribuição do tempo: donut por tipo + barras por processo/tarefa.
export function TimeDistributionChart({ byType, byProcess, byTask }) {
  const [tab, setTab] = useState('process');

  const donutData = byType.map((item) => ({
    name: taskTypeLabel(item.taskType),
    value: item.seconds,
    color: taskTypeColor(item.taskType),
  }));

  const barsData = (tab === 'process' ? byProcess : byTask).slice(0, 6).map((item) => ({
    key: item.key,
    label: item.label,
    sublabel: tab === 'task' ? `${item.count} ${item.count === 1 ? 'sessão' : 'sessões'}` : null,
    seconds: item.seconds,
  }));

  return (
    <section className="surface section-card productivity-block">
      <div className="section-head">
        <div>
          <h2 className="section-title">Distribuição do tempo</h2>
          <p className="section-note">Onde o tempo foi investido no período</p>
        </div>
      </div>

      {donutData.length ? (
        <div className="productivity-distribution">
          <Donut data={donutData} />
          <div className="productivity-distribution-bars">
            <div className="productivity-segmented" role="group" aria-label="Agrupar por">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={tab === item.key}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {barsData.length ? <HBars data={barsData} /> : <div className="note-box">Sem dados para esse agrupamento.</div>}
          </div>
        </div>
      ) : (
        <div className="note-box">Sem tempo registrado no período.</div>
      )}
    </section>
  );
}
