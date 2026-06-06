import { StatusBadge } from '../../layout';
import { formatTimerSeconds, isTaskDone, taskTypeIcon, taskTypeLabel } from './productivity-data';

const VISIBLE = 6;

// Tarefas que mais consumiram tempo no período.
export function TaskTimeList({ byTask, deadlines, petitions }) {
  const top = byTask.slice(0, VISIBLE);

  return (
    <section className="surface section-card pd-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Onde o tempo foi gasto</h2>
          <p className="section-note">Tarefas que mais consumiram tempo</p>
        </div>
      </div>

      {top.length ? (
        <ul className="pd-task-list">
          {top.map((item) => {
            const done = isTaskDone(item.taskType, item.taskId, deadlines, petitions);
            return (
              <li key={item.key} className="pd-task-row">
                <span className="pd-type-icon">{taskTypeIcon(item.taskType)}</span>
                <div className="pd-task-info">
                  <strong title={item.label}>{item.label}</strong>
                  <span>
                    {taskTypeLabel(item.taskType)}
                    {item.processNumber ? ` • ${item.processNumber}` : ''}
                    {` • ${item.count} ${item.count === 1 ? 'sessão' : 'sessões'}`}
                  </span>
                </div>
                <StatusBadge tone={done ? 'success' : 'muted'}>{done ? 'Realizado' : 'Em andamento'}</StatusBadge>
                <strong className="pd-task-time">{formatTimerSeconds(item.seconds)}</strong>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="pd-note">Sem tarefas cronometradas no período.</p>
      )}
    </section>
  );
}
