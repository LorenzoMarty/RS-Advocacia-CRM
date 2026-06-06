import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageChrome } from '../../layout';
import { useAppState } from '../../store';
import { EmptyState } from '../common';
import { ActiveTimers } from './ActiveTimers';
import { ActivityTimeline } from './ActivityTimeline';
import { HistoryAccordion } from './HistoryAccordion';
import { PeriodFilter } from './PeriodFilter';
import { Sparkline } from './charts/Sparkline';
import { TaskTimeList } from './TaskTimeList';
import { TimeDistributionChart } from './TimeDistributionChart';
import { dateInputValue, formatHoursCompact, startOfWeek } from './productivity-data';
import { useProductivityData } from './use-productivity-data';

function VariationNote({ variation }) {
  if (variation == null) {
    return <span className="productivity-delta muted">sem base anterior</span>;
  }
  const up = variation >= 0;
  return (
    <span className={`productivity-delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{variation}% vs período anterior
    </span>
  );
}

export function ProductivityPage() {
  const { currentUser, deadlines, petitions } = useAppState();

  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState(() => dateInputValue(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));

  const data = useProductivityData({ period, customStart, customEnd });

  const kpis = [
    { label: 'Tempo no período', value: formatHoursCompact(data.totalSeconds) },
    { label: 'Prazos realizados', value: data.deliverables.doneDeadlines.length },
    { label: 'Petições realizadas', value: data.deliverables.donePetitions.length },
    { label: 'Processos acompanhados', value: data.processCount },
    { label: 'Média/tarefa', value: formatHoursCompact(data.averageTaskSeconds) },
    { label: 'Timers rodando', value: data.runningCount },
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
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {data.totalSeconds > 0 ? (
            <div className="productivity-trend">
              <VariationNote variation={data.variation} />
              <Sparkline data={data.daySeries} height={48} />
            </div>
          ) : null}
        </section>

        {currentUser ? (
          <ActiveTimers entries={data.activeEntries} now={data.now} currentUserId={currentUser.id} />
        ) : null}

        <TimeDistributionChart byType={data.byType} byProcess={data.byProcess} byTask={data.byTask} />

        <TaskTimeList byTask={data.byTask} deadlines={deadlines} petitions={petitions} />

        <ActivityTimeline daySeries={data.daySeries} />

        {data.stoppedEntries.length ? (
          <HistoryAccordion entries={data.stoppedEntries} />
        ) : null}

        {!data.totalSeconds && !data.activeEntries.length ? (
          <EmptyState
            title="Nenhum tempo registrado ainda."
            copy="Inicie um timer em um prazo ou petição para acompanhar sua produtividade aqui."
            actions={<Link className="btn" to="/prazos">Ver prazos</Link>}
          />
        ) : null}
      </div>
    </>
  );
}
