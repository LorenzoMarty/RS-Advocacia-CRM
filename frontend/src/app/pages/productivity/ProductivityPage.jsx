import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageChrome } from '../../layout';
import { useAppState } from '../../store';
import { EmptyState } from '../common';
import { ActiveTimers } from './ActiveTimers';
import { ActivityTimeline } from './ActivityTimeline';
import { HeroMetrics } from './HeroMetrics';
import { HistoryAccordion } from './HistoryAccordion';
import { ProductivityHeader } from './ProductivityHeader';
import { SecondaryKpis } from './SecondaryKpis';
import { TaskTimeList } from './TaskTimeList';
import { TimeDistributionChart } from './TimeDistributionChart';
import { UserProductivityRanking } from './UserProductivityRanking';
import { dateInputValue, startOfWeek } from './productivity-data';
import { useProductivityData } from './use-productivity-data';

export function ProductivityPage() {
  const { currentRole, currentUser, users, timeEntries, deadlines, petitions } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';

  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState(() => dateInputValue(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));
  const [selectedUserId, setSelectedUserId] = useState('');

  const data = useProductivityData({ period, customStart, customEnd, selectedUserId, isAdmin });

  const selectedUser = isAdmin && selectedUserId
    ? users.find((u) => u.id === selectedUserId)
    : null;
  const officeView = isAdmin && !selectedUserId;

  const subtitle = officeView
    ? 'Visão geral do escritório no período'
    : selectedUser
      ? `Produtividade de ${selectedUser.name}`
      : 'Seu tempo e suas entregas no período';

  const hasNoData = !timeEntries.length;

  return (
    <>
      <PageChrome label="Produtividade" />
      <div className="pd-page">
        <ProductivityHeader
          title="Produtividade"
          subtitle={subtitle}
          period={period}
          setPeriod={setPeriod}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          isAdmin={isAdmin}
          users={users}
          selectedUserId={selectedUserId}
          setSelectedUserId={setSelectedUserId}
        />

        {hasNoData ? (
          <EmptyState
            title="Nenhum tempo registrado ainda."
            copy="Inicie um timer em um prazo ou petição para acompanhar a produtividade aqui."
            actions={<Link className="btn" to="/prazos">Ver prazos</Link>}
          />
        ) : (
          <>
            <ActiveTimers
              entries={data.activeEntries}
              now={data.now}
              currentUserId={currentUser?.id}
            />

            <div className="pd-bento">
              <div className="pd-cell pd-cell-hero">
                <HeroMetrics
                  totalSeconds={data.totalSeconds}
                  variation={data.variation}
                  daySeries={data.daySeries}
                />
              </div>
              <div className="pd-cell pd-cell-kpis">
                <SecondaryKpis
                  averageTaskSeconds={data.averageTaskSeconds}
                  deliverables={data.deliverables}
                  processCount={data.processCount}
                  runningCount={data.runningCount}
                />
              </div>

              <div className="pd-cell pd-cell-distribution">
                <TimeDistributionChart
                  byType={data.byType}
                  byProcess={data.byProcess}
                  byTask={data.byTask}
                />
              </div>

              {officeView ? (
                <div className="pd-cell pd-cell-ranking">
                  <UserProductivityRanking byUser={data.byUser} />
                </div>
              ) : null}

              <div className="pd-cell pd-cell-timeline">
                <ActivityTimeline daySeries={data.daySeries} />
              </div>

              <div className="pd-cell pd-cell-tasks">
                <TaskTimeList byTask={data.byTask} deadlines={deadlines} petitions={petitions} />
              </div>

              <div className="pd-cell pd-cell-history">
                <HistoryAccordion entries={data.stoppedEntries} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
