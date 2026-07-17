import { PeriodFilter } from './PeriodFilter';
import { RiskScoreCard } from './RiskScoreCard';
import { AlertCard } from './AlertCard';

// Área A — card-líder no padrão do projeto: cabeçalho + período + score + faixa de KPIs.
export function RiskSummary({ summary, risk, period, onPeriodChange }) {
  return (
    <div className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-serif text-3xl text-foreground">Auditoria do escritório</p>
          <p className="mt-1 text-sm text-muted-foreground">Painel de controle — risco, urgência e ação</p>
        </div>
        <PeriodFilter value={period} onChange={onPeriodChange} />
      </div>

      <div className="audit-risk-hero">
        <RiskScoreCard {...risk} />
        <div className="productivity-kpis audit-kpis">
          <AlertCard
            label="Prazos vencidos"
            value={summary.overdue}
            tone={summary.overdue ? 'danger' : 'success'}
            hint={summary.overdue ? 'Ação imediata' : 'Em dia'}
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
            hint="+30 dias sem movimentação"
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
