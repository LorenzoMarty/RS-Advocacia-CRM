import { Card, CardContent } from '@/components/ui/card';

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
    <Card>
      <CardContent className="py-5">
      <div className="mb-4">
        <p className="font-serif text-lg text-foreground">Distribuição do tempo</p>
        <p className="text-xs text-muted-foreground">Onde o tempo foi investido no período</p>
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
              <p className="text-sm text-muted-foreground">Sem tarefas cronometradas no período.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Sem tempo registrado no período.</p>
      )}
      </CardContent>
    </Card>
  );
}
