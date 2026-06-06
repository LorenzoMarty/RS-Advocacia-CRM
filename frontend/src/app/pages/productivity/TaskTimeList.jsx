import { StatusBadge } from '../../layout';
import { formatTimerSeconds, isTaskDone, taskTypeIcon, taskTypeLabel } from './productivity-data';

const VISIBLE = 8;

// Tarefas que mais consumiram tempo no período.
export function TaskTimeList({ byTask, deadlines, petitions }) {
  const top = byTask.slice(0, VISIBLE);

  return (
    <section className="surface section-card productivity-block">
      <div className="section-head">
        <div>
          <h2 className="section-title">Onde o tempo foi gasto</h2>
          <p className="section-note">Tarefas que mais consumiram tempo</p>
        </div>
      </div>

      {top.length ? (
        <div className="productivity-task-list">
          {top.map((item) => {
            const done = isTaskDone(item.taskType, item.taskId, deadlines, petitions);
            return (
              <article key={item.key} className="productivity-task-item">
                <span className="productivity-type-icon">{taskTypeIcon(item.taskType)}</span>
                <div className="productivity-task-info">
                  <strong title={item.label}>{item.label}</strong>
                  <span>
                    {taskTypeLabel(item.taskType)}
                    {item.processNumber ? ` • ${item.processNumber}` : ''}
                    {` • ${item.count} ${item.count === 1 ? 'sessão' : 'sessões'}`}
                  </span>
                </div>
                <StatusBadge tone={done ? 'success' : 'muted'}>{done ? 'Realizado' : 'Em andamento'}</StatusBadge>
                <strong className="productivity-task-time">{formatTimerSeconds(item.seconds)}</strong>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="note-box">Sem tarefas cronometradas no período.</div>
      )}
    </section>
  );
}
