import { useEffect, useState } from 'react';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { StatusBadge } from '../layout';
import {
  belongsToUser,
  formatTimerSeconds,
  isDeadlineDone,
  isEventAttended,
  isPetitionDone,
} from '../productivity-utils';
import {
  dateInputValue,
  endOfDay,
  formatHoursCompact,
  isDateInRange,
  isEntryInRange,
  startOfDay,
  startOfMonth,
  startOfWeek,
  timeEntryElapsedSeconds,
} from '../pages/productivity/productivity-data';
import { Select } from './select';
import { useAppState } from '../store';

const PAGE_SIZE = 20;

function taskLoggedSeconds(timeEntries, userId, taskId, taskType, currentTime = Date.now()) {
  return (timeEntries || []).reduce((total, entry) => {
    if (
      entry.userId !== userId
      || entry.taskId !== String(taskId)
      || entry.taskType !== taskType
    ) {
      return total;
    }

    return total + timeEntryElapsedSeconds(entry, currentTime);
  }, 0);
}

function endOfWeek(value = new Date()) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function endOfMonth(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function periodBounds(period, customStart, customEnd) {
  if (period === 'custom') {
    return {
      start: customStart ? startOfDay(`${customStart}T12:00:00`) : null,
      end: customEnd ? endOfDay(`${customEnd}T12:00:00`) : null,
    };
  }

  if (period === 'month') {
    return { start: startOfMonth(), end: endOfMonth() };
  }

  return { start: startOfWeek(), end: endOfWeek() };
}

function deadlineDoneDate(deadline) {
  return deadline.atualizado_em || deadline.updatedAt || deadline.date || deadline.criado_em;
}

function petitionDoneDate(petition) {
  return petition.updatedAt || petition.createdAt;
}

function taskKey(entry) {
  return `${entry.taskType}:${entry.taskId}`;
}

function taskTypeLabel(type) {
  if (type === 'prazo') return 'Prazo';
  if (type === 'contestacao') return 'Contestação';
  return 'Petição';
}

function taskTypeIcon(type) {
  if (type === 'prazo') return 'P';
  if (type === 'contestacao') return 'C';
  return 'Pç';
}

function taskStatusTone(status) {
  if (status === 'running') return 'success';
  if (status === 'paused') return 'muted';
  return 'gold';
}

function taskStatusLabel(status) {
  if (status === 'running') return 'Rodando';
  if (status === 'paused') return 'Pausado';
  return 'Encerrado';
}

function progressPercent(value, target) {
  if (!target) {
    return 0;
  }

  return Math.min(100, Math.round((value / target) * 100));
}

function weekdayLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(value));
}

function isTaskDone(entry, deadlines, petitions) {
  if (entry.taskType === 'prazo') {
    const deadline = deadlines.find((item) => item.id === String(entry.taskId));
    return deadline ? isDeadlineDone(deadline) : false;
  }

  const petition = petitions.find((item) => item.id === String(entry.taskId));
  return petition ? isPetitionDone(petition) : false;
}

function PeriodFilter({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) {
  return (
    <div className="productivity-filters">
      <Select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filtrar período">
        <option value="week">Esta semana</option>
        <option value="month">Este mês</option>
        <option value="custom">Período personalizado</option>
      </Select>
      {period === 'custom' ? (
        <>
          <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Data inicial" />
          <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Data final" />
        </>
      ) : null}
    </div>
  );
}

export function TaskTimer({ taskId, taskType, title, processId = '', processNumber = '', taskStatus = '', onStart }) {
  const {
    addFlash,
    currentUser,
    pauseTimeEntry,
    resumeTimeEntry,
    startTimeEntry,
    stopTimeEntry,
    timeEntries,
  } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [now, setNow] = useState(() => Date.now());
  const currentUserId = currentUser?.id || '';
  const taskEntry = timeEntries.find((entry) =>
    entry.userId === currentUserId
    && entry.taskId === String(taskId)
    && entry.taskType === taskType
    && entry.status !== 'stopped',
  );
  const activeOtherEntry = timeEntries.find((entry) =>
    entry.userId === currentUserId
    && entry.status === 'running'
    && !(entry.taskId === String(taskId) && entry.taskType === taskType),
  );
  const elapsedSeconds = taskLoggedSeconds(timeEntries, currentUserId, taskId, taskType, now);

  useEffect(() => {
    if (!taskEntry || taskEntry.status !== 'running') {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [taskEntry]);

  async function confirmPauseOther() {
    if (!activeOtherEntry) {
      return true;
    }

    return confirm({
      title: 'Tarefa em andamento',
      message: `Você já tem uma tarefa em andamento em ${activeOtherEntry.taskName || 'outra tarefa'}. Deseja pausar aquela e iniciar aqui?`,
      confirmLabel: 'Pausar e iniciar',
      tone: 'danger',
    });
  }

  async function handleStart() {
    const canStart = await confirmPauseOther();
    if (!canStart) {
      return;
    }

    const savedEntry = await startTimeEntry({
      taskId,
      taskType,
      taskName: title,
      processId,
      processNumber,
    }, { pauseExisting: Boolean(activeOtherEntry) });

    if (!savedEntry) {
      addFlash('Não foi possível iniciar a tarefa.', 'error');
      return;
    }

    onStart?.();
  }

  async function handleResume() {
    const canResume = await confirmPauseOther();
    if (!canResume || !taskEntry) {
      return;
    }

    await resumeTimeEntry(taskEntry.id, { pauseExisting: Boolean(activeOtherEntry) });
  }

  if (!currentUser) {
    return null;
  }

  // Tarefa finalizada (Protocolado/Concluído) não mostra mais o Iniciar.
  const isDone = /protocolad|conclu/.test(String(taskStatus || '').toLowerCase());

  return (
    <div className="task-timer" onMouseDown={(event) => event.stopPropagation()}>
      {confirmPopup}
      <div className="task-timer-time">
        <span>Tempo</span>
        <strong>{formatTimerSeconds(elapsedSeconds)}</strong>
      </div>
      <div className="task-timer-actions">
        {(!taskEntry || taskEntry.status === 'stopped') && !isDone ? (
          <button className="timer-btn" type="button" onClick={handleStart} aria-label="Iniciar tarefa">Iniciar</button>
        ) : null}
        {taskEntry?.status === 'running' ? (
          <button className="timer-btn" type="button" onClick={() => pauseTimeEntry(taskEntry.id)} aria-label="Pausar tarefa">Pausar</button>
        ) : null}
        {taskEntry?.status === 'paused' ? (
          <button className="timer-btn" type="button" onClick={handleResume} aria-label="Retomar tarefa">Retomar</button>
        ) : null}
        {taskEntry && taskEntry.status !== 'stopped' ? (
          <button className="timer-btn timer-btn-stop" type="button" onClick={() => stopTimeEntry(taskEntry.id)} aria-label="Encerrar tarefa">Encerrar</button>
        ) : null}
      </div>
    </div>
  );
}

function ProductivityKpis({ items }) {
  return (
    <div className="productivity-kpis">
      {items.map((item) => (
        <div key={item.label} className="productivity-kpi">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

const BREAKDOWN_TABS = [
  { key: 'process', label: 'Processo' },
  { key: 'type', label: 'Tipo' },
];

function breakdownItemMeta(breakdown, item) {
  if (breakdown === 'task') {
    return `${taskTypeLabel(item.taskType)} • ${formatHoursCompact(item.seconds)}${item.done ? ' • Realizado' : ''}`;
  }

  if (breakdown === 'type') {
    return `${item.count} ${item.count === 1 ? 'entrada' : 'entradas'} • ${formatHoursCompact(item.seconds)}`;
  }

  return formatHoursCompact(item.seconds);
}

function activeEntrySort(left, right) {
  return new Date(left.startedAt) - new Date(right.startedAt);
}

function ProductivityUserContent({ user, readOnly = false }) {
  const {
    currentUser,
    deadlines,
    events,
    pauseTimeEntry,
    petitions,
    resumeTimeEntry,
    stopTimeEntry,
    timeEntries,
  } = useAppState();
  const [now, setNow] = useState(() => Date.now());
  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState(dateInputValue(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(dateInputValue(new Date()));
  const [page, setPage] = useState(1);
  const [breakdown, setBreakdown] = useState('process');
  const canControlTimers = !readOnly && currentUser?.id === user.id;
  const userEntries = timeEntries.filter((entry) => entry.userId === user.id);
  const activeEntries = userEntries
    .filter((entry) => ['running', 'paused'].includes(entry.status))
    .sort(activeEntrySort);
  const stoppedEntries = userEntries.filter((entry) => entry.status === 'stopped');
  const monthBounds = { start: startOfMonth(), end: endOfMonth() };
  const filterBounds = periodBounds(period, customStart, customEnd);
  const secondsForEntries = (entries) => entries.reduce(
    (total, entry) => total + timeEntryElapsedSeconds(entry, now),
    0,
  );
  const monthEntries = userEntries.filter((entry) => isEntryInRange(entry, monthBounds));
  const monthTaskCount = new Set(monthEntries.map(taskKey)).size;
  const monthSeconds = secondsForEntries(monthEntries);
  const averageTaskSeconds = monthTaskCount ? Math.round(monthSeconds / monthTaskCount) : 0;
  const filteredHistory = stoppedEntries
    .filter((entry) => isEntryInRange(entry, filterBounds))
    .sort((left, right) => new Date(right.endedAt || right.startedAt) - new Date(left.endedAt || left.startedAt));
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const pageItems = filteredHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Entregas no período, atribuídas pelo nome do responsável.
  const doneDeadlines = deadlines.filter((deadline) =>
    belongsToUser(deadline.responsible, user)
    && isDeadlineDone(deadline)
    && isDateInRange(deadlineDoneDate(deadline), filterBounds),
  );
  const donePetitions = petitions.filter((petition) =>
    belongsToUser(petition.responsible, user)
    && isPetitionDone(petition)
    && isDateInRange(petitionDoneDate(petition), filterBounds),
  );
  const attendedEvents = events.filter((event) =>
    belongsToUser(event.responsibleName, user)
    && isEventAttended(event, now)
    && isDateInRange(event.start, filterBounds),
  );
  const followedProcessIds = new Set(
    [
      ...filteredHistory.map((entry) => entry.processId),
      ...doneDeadlines.map((deadline) => deadline.processId),
      ...donePetitions.map((petition) => petition.processId),
      ...attendedEvents.map((event) => event.processId),
    ].filter(Boolean),
  );

  const totalFilteredSeconds = filteredHistory.reduce(
    (total, entry) => total + timeEntryElapsedSeconds(entry, now), 0,
  );

  // Tempo agregado por tarefa (prazo/petição) no período.
  const perTaskTotals = Object.values(filteredHistory.reduce((groups, entry) => {
    const key = taskKey(entry);
    groups[key] ||= {
      key,
      taskId: entry.taskId,
      taskType: entry.taskType,
      label: entry.taskName || taskTypeLabel(entry.taskType),
      processNumber: entry.processNumber || '',
      seconds: 0,
      count: 0,
      done: isTaskDone(entry, deadlines, petitions),
    };
    groups[key].seconds += timeEntryElapsedSeconds(entry, now);
    groups[key].count += 1;
    if (!groups[key].processNumber && entry.processNumber) {
      groups[key].processNumber = entry.processNumber;
    }
    return groups;
  }, {})).sort((left, right) => right.seconds - left.seconds);

  const processTotals = Object.values(filteredHistory.reduce((groups, entry) => {
    const key = entry.processId || entry.processNumber || 'sem-processo';
    groups[key] ||= {
      key,
      label: entry.processNumber || 'Sem processo',
      seconds: 0,
    };
    groups[key].seconds += timeEntryElapsedSeconds(entry, now);
    return groups;
  }, {})).sort((left, right) => right.seconds - left.seconds);
  const maxProcessSeconds = processTotals[0]?.seconds || 0;

  const typeTotals = Object.values(filteredHistory.reduce((groups, entry) => {
    const type = entry.taskType || 'outro';
    groups[type] ||= { type, label: taskTypeLabel(type), seconds: 0, count: 0 };
    groups[type].seconds += timeEntryElapsedSeconds(entry, now);
    groups[type].count += 1;
    return groups;
  }, {})).sort((left, right) => right.seconds - left.seconds);
  const maxTypeSeconds = typeTotals[0]?.seconds || 0;
  const maxTaskSeconds = perTaskTotals[0]?.seconds || 0;
  const breakdownViews = {
    task: { items: perTaskTotals, max: maxTaskSeconds },
    process: { items: processTotals, max: maxProcessSeconds },
    type: { items: typeTotals, max: maxTypeSeconds },
  };
  const breakdownItems = breakdownViews[breakdown].items;
  const breakdownMax = breakdownViews[breakdown].max;

  useEffect(() => {
    const hasRunning = userEntries.some((entry) => entry.status === 'running');
    if (!hasRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [userEntries]);

  useEffect(() => {
    setPage(1);
  }, [period, customStart, customEnd, user.id]);

  return (
    <div className="productivity-section">
      <ProductivityKpis
        items={[
          { label: 'Tempo no período', value: formatHoursCompact(totalFilteredSeconds) },
          { label: 'Prazos realizados', value: doneDeadlines.length },
          { label: 'Petições realizadas', value: donePetitions.length },
          { label: 'Processos acompanhados', value: followedProcessIds.size },
          { label: 'Compromissos', value: attendedEvents.length },
          { label: 'Média/tarefa (mês)', value: formatHoursCompact(averageTaskSeconds) },
        ]}
      />

      <section className="productivity-block">
        <div className="section-head">
          <div>
            <h3 className="section-title">Timers ativos</h3>
            <p className="section-note">Rodando ou pausados</p>
          </div>
        </div>

        {activeEntries.length ? (
          <div className="productivity-active-list">
            {activeEntries.map((entry) => (
              <article key={entry.id} className="productivity-active-item">
                <div>
                  <strong>{entry.taskName || taskTypeLabel(entry.taskType)}</strong>
                  <span>{entry.processNumber || 'Sem processo'} • iniciado às {new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.startedAt))}</span>
                </div>
                <strong>{formatTimerSeconds(timeEntryElapsedSeconds(entry, now))}</strong>
                <StatusBadge tone={taskStatusTone(entry.status)}>{taskStatusLabel(entry.status)}</StatusBadge>
                {canControlTimers ? (
                  <div className="productivity-inline-actions">
                    {entry.status === 'running' ? <button type="button" onClick={() => pauseTimeEntry(entry.id)}>Pausar</button> : null}
                    {entry.status === 'paused' ? <button type="button" onClick={() => resumeTimeEntry(entry.id)}>Retomar</button> : null}
                    <button type="button" onClick={() => stopTimeEntry(entry.id)}>Encerrar</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="note-box">Nenhum timer ativo.</div>
        )}
      </section>

      <section className="productivity-block">
        <div className="section-head">
          <div>
            <h3 className="section-title">Tempo por tarefa</h3>
            <p className="section-note">Quanto levou em cada prazo ou petição no período</p>
          </div>
          <PeriodFilter
            period={period}
            setPeriod={setPeriod}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
        </div>

        {perTaskTotals.length ? (
          <div className="productivity-task-list">
            {perTaskTotals.map((item) => (
              <article key={item.key} className="productivity-task-item">
                <span className="productivity-type-icon">{taskTypeIcon(item.taskType)}</span>
                <div className="productivity-task-info">
                  <strong>{item.label}</strong>
                  <span>
                    {taskTypeLabel(item.taskType)}
                    {item.processNumber ? ` • ${item.processNumber}` : ''}
                    {' • '}{item.count} {item.count === 1 ? 'sessão' : 'sessões'}
                  </span>
                </div>
                <StatusBadge tone={item.done ? 'success' : 'muted'}>{item.done ? 'Realizado' : 'Em andamento'}</StatusBadge>
                <strong className="productivity-task-time">{formatTimerSeconds(item.seconds)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="note-box">Sem tarefas cronometradas no período.</div>
        )}
      </section>

      <section className="productivity-block">
        <div className="section-head">
          <div>
            <h3 className="section-title">Distribuição do tempo</h3>
            <p className="section-note">Agrupado no período selecionado</p>
          </div>
        </div>

        <div className="productivity-segmented" role="group" aria-label="Agrupar tempo por">
          {BREAKDOWN_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={breakdown === tab.key}
              onClick={() => setBreakdown(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {breakdownItems.length ? (
          <div className="productivity-bars">
            {breakdownItems.map((item) => (
              <article key={item.key || item.type} className="productivity-bar-row">
                <div>
                  <strong>
                    {breakdown === 'task' ? <span className="productivity-type-icon">{taskTypeIcon(item.taskType)}</span> : null}
                    {item.label}
                  </strong>
                  <span>{breakdownItemMeta(breakdown, item)}</span>
                </div>
                <div className="productivity-bar"><span style={{ width: `${progressPercent(item.seconds, breakdownMax)}%` }} /></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="note-box">Sem tempo registrado no período.</div>
        )}
      </section>

      <section className="productivity-block">
        <div className="section-head">
          <div>
            <h3 className="section-title">Histórico por tarefa</h3>
            <p className="section-note">Entradas encerradas no período</p>
          </div>
        </div>

        {pageItems.length ? (
          <>
            <div className="productivity-history">
              {pageItems.map((entry) => (
                <article key={entry.id} className="productivity-history-row">
                  <span className="productivity-type-icon">{taskTypeIcon(entry.taskType)}</span>
                  <div>
                    <strong>{entry.taskName || taskTypeLabel(entry.taskType)}</strong>
                    <span>{taskTypeLabel(entry.taskType)}</span>
                  </div>
                  <span>{weekdayLabel(entry.endedAt || entry.startedAt)}</span>
                  <strong>{formatTimerSeconds(entry.totalSeconds)}</strong>
                </article>
              ))}
            </div>
            <div className="productivity-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
              <span>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Próxima</button>
            </div>
          </>
        ) : (
          <div className="note-box">Sem histórico no período.</div>
        )}
      </section>

    </div>
  );
}
