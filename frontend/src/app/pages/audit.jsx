import { Component, useEffect, useMemo, useState } from 'react';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { NotFoundState } from './common';

import { RiskSummary } from '../components/audit/RiskSummary';
import { PriorityActions } from '../components/audit/PriorityActions';
import { AuditInsightsPanel } from '../components/audit/AuditInsightsPanel';
import { StatusDistribution } from '../components/audit/StatusDistribution';
import { ActivityTimeline } from '../components/audit/ActivityTimeline';
import { LoadingSkeleton } from '../components/audit/LoadingSkeleton';
import { ErrorState } from '../components/audit/ErrorState';
import {
  buildRiskSummary,
  computeRiskScore,
  buildPriorityActions,
  statusDistribution,
  buildInsights,
  classifyDeadline,
  deadlineDate,
  daysUntil,
  startOfToday,
} from '../lib/auditSelectors';

function AuditDashboard({ auditEntries, clients, deadlines, processes, timeEntries }) {
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

  const statusData = useMemo(() => statusDistribution(processes), [processes]);
  const insights = useMemo(
    () => buildInsights(summary, deadlines, today),
    [summary, deadlines, today],
  );

  return (
    <div className="audit-page">
      <RiskSummary summary={summary} risk={risk} period={period} onPeriodChange={setPeriod} />

      <div className="audit-grid-focus">
        <PriorityActions actions={priorityActions} />
        <AuditInsightsPanel insights={insights} />
      </div>

      <ActivityTimeline entries={auditEntries} />

      <StatusDistribution data={statusData} />
    </div>
  );
}

export function AuditPage() {
  const {
    auditEntries, clients, currentRole, deadlines, processes, timeEntries, isLoading, loadAudit,
  } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';

  useEffect(() => {
    if (isAdmin) {
      loadAudit();
    }
    // loadAudit é estável; recarrega só quando o papel muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

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
            auditEntries={auditEntries}
            clients={clients}
            deadlines={deadlines}
            processes={processes}
            timeEntries={timeEntries}
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
