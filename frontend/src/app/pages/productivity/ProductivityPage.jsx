import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageChrome } from '../../layout';
import { useAppState } from '../../store';
import { EmptyState } from '../common';
import { PeriodFilter } from './PeriodFilter';
import { TimeDistributionChart } from './TimeDistributionChart';
import { dateInputValue, formatHoursCompact, startOfWeek } from './productivity-data';
import { useProductivityData } from './use-productivity-data';

function variationMeta(variation) {
  if (!Number.isFinite(variation) || variation === 0) {
    return null;
  }
  const isUp = variation > 0;
  return {
    tone: isUp ? 'up' : 'down',
    label: `${isUp ? '▲' : '▼'} ${Math.abs(Math.round(variation))}%`,
  };
}

export function ProductivityPage() {
  const { deadlines, petitions, isLoading } = useAppState();

  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState(() => dateInputValue(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));

  const data = useProductivityData({ period, customStart, customEnd });

  const kpis = [
    {
      label: 'Tempo no período',
      value: formatHoursCompact(data.totalSeconds),
      delta: variationMeta(data.variation),
    },
    { label: 'Prazos realizados', value: data.deliverables.doneDeadlines.length },
    { label: 'Petições realizadas', value: data.deliverables.donePetitions.length },
    { label: 'Processos acompanhados', value: data.processCount },
    { label: 'Média/tarefa', value: formatHoursCompact(data.averageTaskSeconds) },
  ];

  return (
    <>
      <PageChrome label="Produtividade" />
      <div className="office-productivity-page">
        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Minha produtividade</h1>
              <p className="section-note">Seu tempo e suas entregas no período</p>
            </div>
            <PeriodFilter
              period={period}
              setPeriod={setPeriod}
              customStart={customStart}
              setCustomStart={setCustomStart}
              customEnd={customEnd}
              setCustomEnd={setCustomEnd}
            />
          </div>

          <div className="productivity-kpis">
            {kpis.map((item) => (
              <div key={item.label} className="productivity-kpi">
                <span>{item.label}</span>
                <strong>
                  {item.value}
                  {item.delta ? (
                    <em className={`kpi-delta kpi-delta-${item.delta.tone}`}>{item.delta.label}</em>
                  ) : null}
                </strong>
              </div>
            ))}
          </div>
        </section>

        {isLoading ? (
          <section className="surface section-card productivity-loading">
            <p className="section-note">Carregando sua produtividade...</p>
          </section>
        ) : (
          <>
            <TimeDistributionChart
              byType={data.byType}
              byTask={data.byTask}
              deadlines={deadlines}
              petitions={petitions}
            />

            {!data.totalSeconds ? (
              <EmptyState
                title="Nenhum tempo registrado ainda."
                copy="Inicie a contagem de tempo em um prazo ou petição para acompanhar sua produtividade aqui."
                actions={<Link className="btn" to="/prazos">Ver prazos</Link>}
              />
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
