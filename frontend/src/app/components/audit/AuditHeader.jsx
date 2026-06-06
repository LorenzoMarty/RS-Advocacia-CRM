import { PeriodFilter } from './PeriodFilter';

// Cabeçalho da Auditoria: título + filtro de período.
export function AuditHeader({ period, onPeriodChange }) {
  return (
    <header className="audit-header">
      <div>
        <h1 className="intro-title">Auditoria do escritório</h1>
        <p className="section-note">Painel de controle — risco, urgência e ação</p>
      </div>
      <PeriodFilter value={period} onChange={onPeriodChange} />
    </header>
  );
}
