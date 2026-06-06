import { Component, useMemo, useState } from 'react';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { NotFoundState } from './common';

import { AuditHeader } from '../components/audit/AuditHeader';
import { RiskSummary } from '../components/audit/RiskSummary';
import { PriorityActions } from '../components/audit/PriorityActions';
import { AuditInsightsPanel } from '../components/audit/AuditInsightsPanel';
import { ResponsibleWorkload } from '../components/audit/ResponsibleWorkload';
import { DeadlineHeatmap } from '../components/audit/DeadlineHeatmap';
import { StatusDistribution } from '../components/audit/StatusDistribution';
import { AreaDistribution } from '../components/audit/AreaDistribution';
import { ClientWithoutProcessList } from '../components/audit/ClientWithoutProcessList';
import { WeeklyHoursSummary } from '../components/audit/WeeklyHoursSummary';
import { LoadingSkeleton } from '../components/audit/LoadingSkeleton';
import { ErrorState } from '../components/audit/ErrorState';
import {
  buildRiskSummary,
  computeRiskScore,
  buildPriorityActions,
  deadlineHeatmap,
  statusDistribution,
  areaDistribution,
  weeklyHoursByUser,
  clientsWithoutProcess,
  buildInsights,
  rankByCount,
  classifyDeadline,
  deadlineDate,
  daysUntil,
  startOfToday,
} from '../lib/auditSelectors';

function AuditDashboard({ clients, deadlines, processes, timeEntries, users }) {
  const [period, setPeriod] = useState(7);
  const today = useMemo(() => startOfToday(), []);

  // Prazos acionáveis dentro do horizonte selecionado (vencidos sempre incluídos).
  const horizonDeadlines = useMemo(() => deadlines.filter((d) => {
    const bucket = classifyDeadline(d, today);
    if (!bucket) return false;
    if (!period || bucket === 'overdue') return true;
    return daysUntil(deadlineDate(d), today) <= period;
  }), [deadlines, period, today]);

  const summary = useMemo(
    () => buildRiskSummary(processes, deadlines, timeEntries, clients, today),
    [processes, deadlines, timeEntries, clients, today],
  );
  const risk = useMemo(() => computeRiskScore(summary), [summary]);

  const priorityActions = useMemo(
    () => buildPriorityActions(horizonDeadlines, processes, today),
    [horizonDeadlines, processes, today],
  );

  const workload = useMemo(() => {
    const pending = deadlines.filter((d) => !d.completed && d.status !== 'protocolado');
    return rankByCount(pending, (d) => d.responsible);
  }, [deadlines]);

  const heatmap = useMemo(() => deadlineHeatmap(horizonDeadlines, today), [horizonDeadlines, today]);
  const statusData = useMemo(() => statusDistribution(processes), [processes]);
  const areaData = useMemo(() => areaDistribution(processes), [processes]);
  const weeklyHours = useMemo(() => weeklyHoursByUser(users, timeEntries), [users, timeEntries]);
  const orphanClients = useMemo(() => clientsWithoutProcess(clients, processes), [clients, processes]);
  const insights = useMemo(
    () => buildInsights(summary, workload, heatmap),
    [summary, workload, heatmap],
  );

  return (
    <div className="audit-page">
      <AuditHeader period={period} onPeriodChange={setPeriod} />

      <RiskSummary summary={summary} risk={risk} />

      <div className="audit-grid-focus">
        <PriorityActions actions={priorityActions} />
        <AuditInsightsPanel insights={insights} />
      </div>

      <h2 className="audit-section-label">Gargalos operacionais</h2>
      <div className="audit-grid-2">
        <ResponsibleWorkload workload={workload} />
        <DeadlineHeatmap heatmap={heatmap} />
      </div>
      <div className="audit-grid-2">
        <StatusDistribution data={statusData} />
        <AreaDistribution rows={areaData.rows} statuses={areaData.statuses} />
      </div>

      <h2 className="audit-section-label">Monitoramento</h2>
      <div className="audit-grid-2">
        <ClientWithoutProcessList clients={orphanClients} totalClients={clients.length} />
        <WeeklyHoursSummary data={weeklyHours} />
      </div>
    </div>
  );
}

export function AuditPage() {
  const {
    clients, currentRole, deadlines, processes, timeEntries, users, isLoading,
  } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';

  if (!isAdmin) {
    return (
      <NotFoundState
        title="Auditoria restrita."
        copy="Apenas administradores acessam a auditoria do escritório."
      />
    );
  }

  return (
    <>
      <PageChrome label="Auditoria" />
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <AuditBoundary>
          <AuditDashboard
            clients={clients}
            deadlines={deadlines}
            processes={processes}
            timeEntries={timeEntries}
            users={users}
          />
        </AuditBoundary>
      )}
    </>
  );
}

// Defensive wrapper: any computation/render failure shows the error state
// instead of a blank screen.
class AuditBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
