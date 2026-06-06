import { StatusBadge } from '../../layout';
import { useAppState } from '../../store';
import { formatTimerSeconds, statusLabel, statusTone, taskTypeLabel, timeEntryElapsedSeconds } from './productivity-data';

// Timers ativos do usuário — o "agora" do dashboard.
export function ActiveTimers({ entries, now, currentUserId }) {
  const { pauseTimeEntry, resumeTimeEntry, stopTimeEntry } = useAppState();

  return (
    <section className="surface section-card productivity-block">
      <div className="section-head">
        <div>
          <h2 className="section-title">Timers ativos</h2>
          <p className="section-note">Rodando ou pausados</p>
        </div>
      </div>

      {entries.length ? (
        <div className="productivity-active-list">
          {entries.map((entry) => {
            const canControl = entry.userId === currentUserId;
            return (
              <article key={entry.id} className="productivity-active-item">
                <div>
                  <strong>{entry.taskName || taskTypeLabel(entry.taskType)}</strong>
                  <span>
                    {entry.processNumber || 'Sem processo'}
                    {' • iniciado às '}
                    {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.startedAt))}
                  </span>
                </div>
                <strong>{formatTimerSeconds(timeEntryElapsedSeconds(entry, now))}</strong>
                <StatusBadge tone={statusTone(entry.status)}>{statusLabel(entry.status)}</StatusBadge>
                {canControl ? (
                  <div className="productivity-inline-actions">
                    {entry.status === 'running' ? (
                      <button type="button" onClick={() => pauseTimeEntry(entry.id)}>Pausar</button>
                    ) : (
                      <button type="button" onClick={() => resumeTimeEntry(entry.id)}>Retomar</button>
                    )}
                    <button type="button" onClick={() => stopTimeEntry(entry.id)}>Encerrar</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="note-box">Nenhum timer ativo.</div>
      )}
    </section>
  );
}
