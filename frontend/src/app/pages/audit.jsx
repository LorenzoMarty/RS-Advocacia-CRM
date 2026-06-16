import { Component, useEffect, useState } from 'react';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { NotFoundState } from './common';

import { RiskSummary } from '../components/audit/RiskSummary';
import { PriorityActions } from '../components/audit/PriorityActions';
import { StatusDistribution } from '../components/audit/StatusDistribution';
import { ActivityTimeline } from '../components/audit/ActivityTimeline';
import { LoadingSkeleton } from '../components/audit/LoadingSkeleton';
import { ErrorState } from '../components/audit/ErrorState';

// Render-only: o painel (risco, KPIs, prioridades, distribuição) é computado no
// backend (GET /api/auditoria/painel/). Fallback neutro enquanto carrega / em demo.
const EMPTY_PANEL = {
  risk: { score: 0, level: 'healthy', label: 'Saudável', drivers: [] },
  summary: {
    activeProcesses: 0,
    overdue: 0,
    dueSoon: 0,
    stale: 0,
    clientsWithoutProcess: 0,
    runningTimers: 0,
  },
  priorityActions: [],
  statusDistribution: [],
};

function AuditDashboard({ panel, auditEntries, period, onPeriodChange }) {
  const data = panel || EMPTY_PANEL;

  return (
    <div className="audit-page">
      <RiskSummary
        summary={data.summary}
        risk={data.risk}
        period={period}
        onPeriodChange={onPeriodChange}
      />
      <PriorityActions actions={data.priorityActions} />
      <ActivityTimeline entries={auditEntries} />
      <StatusDistribution data={data.statusDistribution} />
    </div>
  );
}

export function AuditPage() {
  const {
    auditEntries, auditPanel, currentRole, isLoading, loadAudit, loadAuditPanel,
  } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    if (isAdmin) {
      loadAudit();
      loadAuditPanel(period);
    }
    // loadAudit/loadAuditPanel são estáveis; recarrega só quando o papel muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function handlePeriodChange(value) {
    setPeriod(value);
    loadAuditPanel(value);
  }

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
            panel={auditPanel}
            auditEntries={auditEntries}
            period={period}
            onPeriodChange={handlePeriodChange}
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
