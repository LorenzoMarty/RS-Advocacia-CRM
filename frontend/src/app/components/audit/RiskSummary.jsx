import { PeriodFilter } from './PeriodFilter';
import { RiskScoreCard } from './RiskScoreCard';
import { AlertCard } from './AlertCard';

// Área A — card-líder no padrão do projeto: cabeçalho + período + score + faixa de KPIs.
export function RiskSummary({ summary, risk, period, onPeriodChange }) {
  return (
    <section className="surface section-card audit-card audit-hero-card">
      <div className="section-head">
        <div>
          <h1 className="intro-title">Auditoria do escritório</h1>
          <p className="section-note">Painel de controle — risco, urgência e ação</p>
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
          <AlertCard
            label="Timers ativos"
            value={summary.runningTimers}
            tone="gold"
            to="/produtividade"
          />
        </div>
      </div>
    </section>
  );
}
