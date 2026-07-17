import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';

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
      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Minha produtividade</p>
              <p className="mt-1 text-sm text-muted-foreground">Seu tempo e suas entregas no período</p>
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
        </section>

        <Card>
          <CardContent className="py-5">
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
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground">Carregando sua produtividade...</p>
            </CardContent>
          </Card>
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
