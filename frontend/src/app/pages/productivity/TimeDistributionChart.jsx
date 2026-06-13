import { StatusBadge } from '../../layout';
import { Donut } from './charts/Donut';
import { formatMinutes, isTaskDone, taskTypeColor, taskTypeIcon, taskTypeLabel } from './productivity-data';

const VISIBLE = 8;

// Distribuição do tempo: donut por tipo + lista "onde o tempo foi gasto" ao lado.
export function TimeDistributionChart({ byType, byTask, deadlines, petitions }) {
  const donutData = byType.map((item) => ({
    name: taskTypeLabel(item.taskType),
    value: item.seconds,
    color: taskTypeColor(item.taskType),
  }));

  const top = byTask.slice(0, VISIBLE);

  return (
    <section className="surface section-card productivity-block">
      <div className="section-head">
        <div>
          <h2 className="section-title">Distribuição do tempo</h2>
          <p className="section-note">Onde o tempo foi investido no período</p>
        </div>
      </div>

      {donutData.length ? (
        <div className="productivity-distribution">
          <Donut data={donutData} formatValue={formatMinutes} />
          <div className="productivity-distribution-tasks">
            <h3 className="section-subtitle">Onde o tempo foi gasto</h3>
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
                      <strong className="productivity-task-time">{formatMinutes(item.seconds)}</strong>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="note-box">Sem tarefas cronometradas no período.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="note-box">Sem tempo registrado no período.</div>
      )}
    </section>
  );
}
