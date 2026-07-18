import { Component, useCallback, useEffect, useState } from 'react';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { NotFoundState } from './common';

import { RiskSummary } from '../components/audit/RiskSummary';
import { PriorityActions } from '../components/audit/PriorityActions';
import { ActivityTimeline } from '../components/audit/ActivityTimeline';
import { LoadingSkeleton } from '../components/audit/LoadingSkeleton';
import { ErrorState } from '../components/audit/ErrorState';
import { ProcessStatusPanel } from '../components/audit/ProcessStatusPanel';
import { DeadlinesPanel } from '../components/audit/DeadlinesPanel';
import { EventsPanel } from '../components/audit/EventsPanel';
import { PetitionFunnel } from '../components/audit/PetitionFunnel';
import { ProductivityPanel } from '../components/audit/ProductivityPanel';

// Fallback neutro enquanto o overview não carregou.
const EMPTY_OVERVIEW = {
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
  processStatus: [],
  staleProcesses: { count: 0, itens: [] },
  prazos: { overdue: 0, today: 0, dueSoon: 0, done: 0 },
  eventos: { proximos: [], atrasados: [], totalPendentes: 0 },
  petitionFunnel: [],
  productivity: { semanaInicio: null, porUsuario: [], timersAtivos: 0 },
};

function AuditDashboard({
  overview,
  auditEntries,
  period,
  onPeriodChange,
  auditFilters,
  auditPagination,
  onFilterChange,
  onLoadMore,
}) {
  const data = overview || EMPTY_OVERVIEW;

  return (
    <div className="grid gap-4 p-5">
      <RiskSummary
        summary={data.summary}
        risk={data.risk}
        period={period}
        onPeriodChange={onPeriodChange}
      />
      <PriorityActions actions={data.priorityActions} />

      {/* Macro overview sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <ProcessStatusPanel
          processStatus={data.processStatus}
          staleProcesses={data.staleProcesses}
        />
        <DeadlinesPanel prazos={data.prazos} />
      </div>

      <EventsPanel eventos={data.eventos} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <PetitionFunnel petitionFunnel={data.petitionFunnel} />
        <ProductivityPanel productivity={data.productivity} />
      </div>

      {/* Activity log */}
      <ActivityTimeline
        entries={auditEntries}
        filters={auditFilters}
        pagination={auditPagination}
        onFilterChange={onFilterChange}
        onLoadMore={onLoadMore}
      />

    </div>
  );
}

export function AuditPage() {
  const {
    auditEntries,
    auditOverview,
    auditPagination,
    currentRole,
    isLoading,
    loadAudit,
    loadMoreAudit,
    loadAuditOverview,
  } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';
  const [period, setPeriod] = useState(7);
  const [auditFilters, setAuditFilters] = useState({});
  const [auditDataLoading, setAuditDataLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setAuditDataLoading(true);
    Promise.all([loadAudit({}), loadAuditOverview(period)]).finally(() => {
      setAuditDataLoading(false);
    });
    // loadAudit/loadAuditOverview estáveis; recarrega só quando o papel muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  function handlePeriodChange(value) {
    setPeriod(value);
    loadAuditOverview(value);
  }

  const handleFilterChange = useCallback(
    (filters) => {
      setAuditFilters(filters);
      loadAudit(filters);
    },
    [loadAudit],
  );

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
      {isLoading || auditDataLoading ? (
        <LoadingSkeleton />
      ) : (
        <AuditBoundary>
          <AuditDashboard
            overview={auditOverview}
            auditEntries={auditEntries}
            period={period}
            onPeriodChange={handlePeriodChange}
            auditFilters={auditFilters}
            auditPagination={auditPagination}
            onFilterChange={handleFilterChange}
            onLoadMore={loadMoreAudit}
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
