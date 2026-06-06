import { RiskScoreCard } from './RiskScoreCard';
import { AlertCard } from './AlertCard';

// Área A — hero de risco: score + cards de alerta.
export function RiskSummary({ summary, risk }) {
  return (
    <section className="audit-area audit-risk-hero">
      <RiskScoreCard {...risk} />
      <div className="audit-alert-grid">
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
        <AlertCard
          label="Timers ativos"
          value={summary.runningTimers}
          tone="gold"
          to="/produtividade"
        />
      </div>
    </section>
  );
}
