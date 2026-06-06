import { StatusBadge } from '../../layout';
import { useAppState } from '../../store';
import { formatTimerSeconds, statusLabel, statusTone, taskTypeLabel, timeEntryElapsedSeconds } from './productivity-data';

// Faixa discreta de timers ativos — o "agora" do dashboard.
export function ActiveTimers({ entries, now, currentUserId }) {
  const { pauseTimeEntry, resumeTimeEntry, stopTimeEntry } = useAppState();

  if (!entries.length) {
    return null;
  }

  return (
    <section className="pd-active" aria-label="Timers ativos">
      {entries.map((entry) => {
        const canControl = entry.userId === currentUserId;
        return (
        <article key={entry.id} className={`pd-active-pill pd-active-${entry.status}`}>
          <span className={`pd-pulse pd-pulse-${entry.status}`} aria-hidden="true" />
          <div className="pd-active-info">
            <strong>{entry.taskName || taskTypeLabel(entry.taskType)}</strong>
            <span>{entry.processNumber || 'Sem processo'}</span>
          </div>
          <span className="pd-active-time">{formatTimerSeconds(timeEntryElapsedSeconds(entry, now))}</span>
          <StatusBadge tone={statusTone(entry.status)}>{statusLabel(entry.status)}</StatusBadge>
          {canControl ? (
            <div className="pd-active-actions">
              {entry.status === 'running' ? (
                <button type="button" onClick={() => pauseTimeEntry(entry.id)}>Pausar</button>
              ) : (
                <button type="button" onClick={() => resumeTimeEntry(entry.id)}>Retomar</button>
              )}
              <button type="button" className="pd-btn-stop" onClick={() => stopTimeEntry(entry.id)}>Encerrar</button>
            </div>
          ) : null}
          </article>
        );
      })}
    </section>
  );
}
