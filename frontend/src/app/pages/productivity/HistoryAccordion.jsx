import { formatTimerSeconds, taskTypeIcon, taskTypeLabel } from './productivity-data';

const MAX_ROWS = 50;

function weekdayLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(value));
}

// Histórico recolhível — fora do caminho principal para não poluir.
export function HistoryAccordion({ entries }) {
  const rows = entries.slice(0, MAX_ROWS);

  return (
    <details className="surface section-card pd-card pd-history">
      <summary className="pd-history-summary">
        <span className="section-title">Histórico de atividades</span>
        <span className="pd-history-count">{entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}</span>
      </summary>

      {rows.length ? (
        <ul className="pd-history-list">
          {rows.map((entry) => (
            <li key={entry.id} className="pd-history-row">
              <span className="pd-type-icon">{taskTypeIcon(entry.taskType)}</span>
              <div className="pd-history-info">
                <strong title={entry.taskName || taskTypeLabel(entry.taskType)}>
                  {entry.taskName || taskTypeLabel(entry.taskType)}
                </strong>
                <span>{taskTypeLabel(entry.taskType)}{entry.processNumber ? ` • ${entry.processNumber}` : ''}</span>
              </div>
              <span className="pd-history-day">{weekdayLabel(entry.endedAt || entry.startedAt)}</span>
              <strong className="pd-history-time">{formatTimerSeconds(entry.totalSeconds)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pd-note">Sem histórico no período.</p>
      )}
    </details>
  );
}
