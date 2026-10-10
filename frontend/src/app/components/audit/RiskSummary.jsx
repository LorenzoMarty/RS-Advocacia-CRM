import { PageHeader } from '@/components/ui/page-header';
import { PeriodFilter } from './PeriodFilter';
import { RiskScoreCard } from './RiskScoreCard';
import { AlertCard } from './AlertCard';

// Área A — card-líder no padrão do projeto: cabeçalho + período + score + faixa de KPIs.
export function RiskSummary({ summary, risk, period, onPeriodChange }) {
  return (
    <div>
      <PageHeader title="Auditoria" subtitle="O que precisa de ação no escritório, por ordem de urgência">
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </PageHeader>

      <div className="mt-4 grid grid-cols-1 items-stretch gap-2 rounded-lg bg-card p-2.5 lg:grid-cols-[minmax(260px,1.2fr)_minmax(0,4fr)]">
        <RiskScoreCard {...risk} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <AlertCard
            label="Prazos vencidos"
            value={summary.overdue}
            tone={summary.overdue ? 'danger' : 'success'}
            hint={summary.overdue ? 'ação imediata' : 'em dia'}
            to="/prazos"
          />
          <AlertCard
            label="Vencendo em 7 dias"
            value={summary.dueSoon}
            tone={summary.dueSoon ? 'warn' : 'success'}
            to="/prazos"
          />
          <AlertCard
            label="Processos parados"
            value={summary.stale}
            tone={summary.stale ? 'warn' : 'success'}
            hint="+30 dias"
            to="/processos"
          />
          <AlertCard
            label="Clientes sem processo"
            value={summary.clientsWithoutProcess}
            tone={summary.clientsWithoutProcess ? 'gold' : 'success'}
            to="/clientes"
          />
        </div>
      </div>
    </div>
  );
}
