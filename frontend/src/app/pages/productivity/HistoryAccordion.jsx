import { useState } from 'react';

import { formatTimerSeconds, taskTypeIcon, taskTypeLabel } from './productivity-data';

const PAGE_SIZE = 20;

function weekdayLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(value));
}

// Histórico de atividades, paginado — fora do caminho principal.
export function HistoryAccordion({ entries }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageItems = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="surface section-card productivity-block">
      <div className="section-head">
        <div>
          <h2 className="section-title">Histórico por tarefa</h2>
          <p className="section-note">Entradas encerradas no período</p>
        </div>
      </div>

      <div className="productivity-history">
        {pageItems.map((entry) => (
          <article key={entry.id} className="productivity-history-row">
            <span className="productivity-type-icon">{taskTypeIcon(entry.taskType)}</span>
            <div>
              <strong>{entry.taskName || taskTypeLabel(entry.taskType)}</strong>
              <span>{taskTypeLabel(entry.taskType)}{entry.processNumber ? ` • ${entry.processNumber}` : ''}</span>
            </div>
            <span>{weekdayLabel(entry.endedAt || entry.startedAt)}</span>
            <strong>{formatTimerSeconds(entry.totalSeconds)}</strong>
          </article>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="productivity-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((c) => Math.max(1, c - 1))}>Anterior</button>
          <span>{page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((c) => Math.min(totalPages, c + 1))}>Próxima</button>
        </div>
      ) : null}
    </section>
  );
}
