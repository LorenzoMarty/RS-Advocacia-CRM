import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { formatTimerSeconds } from '../productivity-utils';
import { useAppState } from '../store';
import { EmptyState, NotFoundState } from '../pages/common';

const PAGE_SIZE = 20;
const DEFAULT_GOAL = { dailyHours: 6, weeklyHours: 30 };

function formatHoursCompact(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (!hours && !minutes) {
    return '0h';
  }

  return `${hours ? `${hours}h` : ''}${hours && minutes ? ' ' : ''}${minutes ? `${minutes}m` : ''}`;
}

function timeEntryElapsedSeconds(entry, currentTime = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor(Number(entry?.totalSeconds) || 0));

  if (entry?.status !== 'running') {
    return totalSeconds;
  }

  const baseTime = new Date(entry.resumedAt || entry.startedAt).getTime();

  if (Number.isNaN(baseTime)) {
    return totalSeconds;
  }

  return totalSeconds + Math.max(0, Math.floor((currentTime - baseTime) / 1000));
}

function dateInputValue(value = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function endOfDay(value = new Date()) {
  const date = startOfDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function endOfWeek(value = new Date()) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfMonth(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
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

function entryDate(entry) {
  return new Date(entry.endedAt || entry.startedAt);
}

function isEntryInRange(entry, bounds) {
  const date = entryDate(entry);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (bounds.start && date < bounds.start) {
    return false;
  }

  if (bounds.end && date > bounds.end) {
    return false;
  }

  return true;
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

function goalForUser(goals, userId) {
  return goals.find((goal) => goal.userId === userId) || {
    userId,
    ...DEFAULT_GOAL,
    configured: false,
  };
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

function PeriodFilter({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) {
  return (
    <div className="productivity-filters">
      <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filtrar período">
        <option value="week">Esta semana</option>
        <option value="month">Este mês</option>
        <option value="custom">Período personalizado</option>
      </select>
      {period === 'custom' ? (
        <>
          <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Data inicial" />
          <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Data final" />
        </>
      ) : null}
    </div>
  );
}

export function TaskTimer({ taskId, taskType, title, processId = '', processNumber = '' }) {
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
  const elapsedSeconds = timeEntryElapsedSeconds(taskEntry, now);

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
      title: 'Timer ativo',
      message: `Você já tem um timer ativo em ${activeOtherEntry.taskName || 'outra tarefa'}. Deseja pausar aquele e iniciar aqui?`,
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
      addFlash('Não foi possível iniciar o timer.', 'error');
    }
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

  return (
    <div className="task-timer" onMouseDown={(event) => event.stopPropagation()}>
      {confirmPopup}
      <div className="task-timer-time">
        <span>Tempo</span>
        <strong>{formatTimerSeconds(elapsedSeconds)}</strong>
      </div>
      <div className="task-timer-actions">
        {!taskEntry || taskEntry.status === 'stopped' ? (
          <button className="timer-btn" type="button" onClick={handleStart} aria-label="Iniciar timer">Iniciar</button>
        ) : null}
        {taskEntry?.status === 'running' ? (
          <button className="timer-btn" type="button" onClick={() => pauseTimeEntry(taskEntry.id)} aria-label="Pausar timer">Pausar</button>
        ) : null}
        {taskEntry?.status === 'paused' ? (
          <button className="timer-btn" type="button" onClick={handleResume} aria-label="Retomar timer">Retomar</button>
        ) : null}
        {taskEntry && taskEntry.status !== 'stopped' ? (
          <button className="timer-btn timer-btn-stop" type="button" onClick={() => stopTimeEntry(taskEntry.id)} aria-label="Encerrar timer">Encerrar</button>
        ) : null}
      </div>
    </div>
  );
}

function ProductivityMetric({ label, value, target = 0, progress = null }) {
  const percent = progress ?? progressPercent(value, target);

  return (
    <article className="productivity-metric">
      <span>{label}</span>
      <strong>{formatHoursCompact(value)}</strong>
      {target ? (
        <>
          <div className="productivity-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
          <small>{percent}% da meta</small>
        </>
      ) : null}
    </article>
  );
}

function activeEntrySort(left, right) {
  return new Date(left.startedAt) - new Date(right.startedAt);
}

function ProductivityUserContent({ user, readOnly = false }) {
  const {
    currentUser,
    pauseTimeEntry,
    productivityGoals,
    resumeTimeEntry,
    stopTimeEntry,
    timeEntries,
  } = useAppState();
  const [now, setNow] = useState(() => Date.now());
  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState(dateInputValue(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(dateInputValue(new Date()));
  const [page, setPage] = useState(1);
  const goal = goalForUser(productivityGoals, user.id);
  const canControlTimers = !readOnly && currentUser?.id === user.id;
  const userEntries = timeEntries.filter((entry) => entry.userId === user.id);
  const activeEntries = userEntries
    .filter((entry) => ['running', 'paused'].includes(entry.status))
    .sort(activeEntrySort);
  const stoppedEntries = userEntries.filter((entry) => entry.status === 'stopped');
  const todayBounds = { start: startOfDay(), end: endOfDay() };
  const weekBounds = { start: startOfWeek(), end: endOfWeek() };
  const monthBounds = { start: startOfMonth(), end: endOfMonth() };
  const filterBounds = periodBounds(period, customStart, customEnd);
  const secondsForEntries = (entries) => entries.reduce(
    (total, entry) => total + timeEntryElapsedSeconds(entry, now),
    0,
  );
  const todaySeconds = secondsForEntries(userEntries.filter((entry) => isEntryInRange(entry, todayBounds)));
  const weekSeconds = secondsForEntries(userEntries.filter((entry) => isEntryInRange(entry, weekBounds)));
  const monthEntries = userEntries.filter((entry) => isEntryInRange(entry, monthBounds));
  const monthTaskCount = new Set(monthEntries.map(taskKey)).size;
  const monthSeconds = secondsForEntries(monthEntries);
  const averageTaskSeconds = monthTaskCount ? Math.round(monthSeconds / monthTaskCount) : 0;
  const filteredHistory = stoppedEntries
    .filter((entry) => isEntryInRange(entry, filterBounds))
    .sort((left, right) => new Date(right.endedAt || right.startedAt) - new Date(left.endedAt || left.startedAt));
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const pageItems = filteredHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
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
      <div className="productivity-metrics">
        <ProductivityMetric label="Horas hoje" value={todaySeconds} target={goal.dailyHours * 3600} />
        <ProductivityMetric label="Horas na semana" value={weekSeconds} target={goal.weeklyHours * 3600} />
        <article className="productivity-metric">
          <span>Tarefas no mês</span>
          <strong>{monthTaskCount}</strong>
        </article>
        <article className="productivity-metric">
          <span>Média por tarefa</span>
          <strong>{formatHoursCompact(averageTaskSeconds)}</strong>
        </article>
      </div>

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
            <h3 className="section-title">Histórico por tarefa</h3>
            <p className="section-note">Entradas encerradas</p>
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

      <section className="productivity-block">
        <div className="section-head">
          <div>
            <h3 className="section-title">Tempo por processo</h3>
            <p className="section-note">Mesmo filtro do histórico</p>
          </div>
        </div>

        {processTotals.length ? (
          <div className="productivity-bars">
            {processTotals.map((item) => (
              <article key={item.key} className="productivity-bar-row">
                <div>
                  <strong>{item.label}</strong>
                  <span>{formatHoursCompact(item.seconds)}</span>
                </div>
                <div className="productivity-bar"><span style={{ width: `${progressPercent(item.seconds, maxProcessSeconds)}%` }} /></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="note-box">Sem tempo agrupado por processo.</div>
        )}
      </section>
    </div>
  );
}

export function UserProductivitySection({ user, isAdmin = false }) {
  const { currentUser } = useAppState();
  const canView = isAdmin || currentUser?.id === user.id;

  if (!canView) {
    return (
      <section className="surface section-card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Produtividade</h2>
            <p className="section-note">Visível apenas para o próprio usuário ou admin</p>
          </div>
        </div>
        <div className="note-box">Dados de produtividade restritos.</div>
      </section>
    );
  }

  return (
    <section className="surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Produtividade</h2>
          <p className="section-note">Horas, timers e histórico</p>
        </div>
      </div>
      <ProductivityUserContent user={user} readOnly={isAdmin && currentUser?.id !== user.id} />
    </section>
  );
}

export function OfficeProductivityPage() {
  const {
    currentRole,
    productivityGoals,
    saveProductivityGoals,
    timeEntries,
    users,
  } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';
  const [now, setNow] = useState(() => Date.now());
  const [period, setPeriod] = useState('week');
  const [customStart, setCustomStart] = useState(dateInputValue(startOfWeek()));
  const [customEnd, setCustomEnd] = useState(dateInputValue(new Date()));
  const [selectedUserId, setSelectedUserId] = useState('');
  const [globalGoal, setGlobalGoal] = useState({ dailyHours: 6, weeklyHours: 30 });
  const [goalDrafts, setGoalDrafts] = useState({});
  const bounds = periodBounds(period, customStart, customEnd);
  const todayBounds = { start: startOfDay(), end: endOfDay() };
  const weekBounds = { start: startOfWeek(), end: endOfWeek() };
  const filteredEntries = timeEntries.filter((entry) => isEntryInRange(entry, bounds));
  const todaySeconds = timeEntries
    .filter((entry) => isEntryInRange(entry, todayBounds))
    .reduce((total, entry) => total + timeEntryElapsedSeconds(entry, now), 0);
  const runningCount = timeEntries.filter((entry) => entry.status === 'running').length;
  const weekSecondsByUser = users.map((user) => {
    const seconds = timeEntries
      .filter((entry) => entry.userId === user.id && isEntryInRange(entry, weekBounds))
      .reduce((total, entry) => total + timeEntryElapsedSeconds(entry, now), 0);
    return { user, seconds };
  });
  const averageWeeklySeconds = users.length
    ? Math.round(weekSecondsByUser.reduce((total, item) => total + item.seconds, 0) / users.length)
    : 0;
  const ranking = users.map((user) => {
    const seconds = filteredEntries
      .filter((entry) => entry.userId === user.id)
      .reduce((total, entry) => total + timeEntryElapsedSeconds(entry, now), 0);
    return { user, seconds };
  }).sort((left, right) => right.seconds - left.seconds);
  const maxRankingSeconds = ranking[0]?.seconds || 0;
  const selectedUser = users.find((user) => user.id === selectedUserId) || null;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  function goalDraftForUser(user) {
    const savedGoal = goalForUser(productivityGoals, user.id);
    const draft = goalDrafts[user.id] || {};
    return {
      dailyHours: draft.dailyHours ?? savedGoal.dailyHours,
      weeklyHours: draft.weeklyHours ?? savedGoal.weeklyHours,
    };
  }

  async function handleApplyGlobal(event) {
    event.preventDefault();
    await saveProductivityGoals({
      applyAll: true,
      dailyHours: globalGoal.dailyHours,
      weeklyHours: globalGoal.weeklyHours,
    });
  }

  function updateGoalDraft(userId, field, value) {
    setGoalDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {}),
        [field]: value,
      },
    }));
  }

  async function handleSavePerUser(event) {
    event.preventDefault();
    await saveProductivityGoals({
      goals: users.map((user) => {
        const goal = goalDraftForUser(user);
        return {
          userId: user.id,
          dailyHours: goal.dailyHours,
          weeklyHours: goal.weeklyHours,
        };
      }),
    });
  }

  if (!isAdmin) {
    return <NotFoundState title="Produtividade restrita." copy="Apenas administradores acessam a produtividade do escritório." />;
  }

  return (
    <>
      <PageChrome label="Produtividade" />
      <div className="office-productivity-page">
        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Produtividade do escritório</h1>
              <p className="section-note">Horas, metas e timers em andamento</p>
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

          <div className="productivity-metrics">
            <ProductivityMetric label="Total hoje" value={todaySeconds} />
            <ProductivityMetric label="Média semanal por pessoa" value={averageWeeklySeconds} />
            <article className="productivity-metric">
              <span>Timers rodando agora</span>
              <strong>{runningCount}</strong>
            </article>
          </div>
        </section>

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Ranking de usuários</h2>
              <p className="section-note">Total no período selecionado</p>
            </div>
          </div>

          {ranking.length ? (
            <div className="productivity-ranking">
              {ranking.map(({ user, seconds }) => (
                <button key={user.id} type="button" className="productivity-ranking-row" onClick={() => setSelectedUserId(user.id)}>
                  <span className="productivity-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                  <strong>{user.name}</strong>
                  <div className="productivity-bar"><span style={{ width: `${progressPercent(seconds, maxRankingSeconds)}%` }} /></div>
                  <span>{formatHoursCompact(seconds)}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem usuários." copy="Cadastre usuários para acompanhar produtividade." actions={<Link className="btn" to="/usuarios/novo">Novo usuário</Link>} />
          )}
        </section>

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Progresso vs meta semanal</h2>
              <p className="section-note">Verde atingiu, âmbar entre 50% e 99%, vermelho abaixo de 50%</p>
            </div>
          </div>

          <div className="productivity-goal-list">
            {weekSecondsByUser.map(({ user, seconds }) => {
              const goal = goalForUser(productivityGoals, user.id);
              const target = goal.weeklyHours * 3600;
              const percent = progressPercent(seconds, target);
              const tone = percent >= 100 ? 'success' : percent >= 50 ? 'warn' : 'danger';
              return (
                <article key={user.id} className={`productivity-goal-row is-${tone}`}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{formatHoursCompact(seconds)} de {goal.weeklyHours}h</span>
                  </div>
                  <div className="productivity-bar"><span style={{ width: `${percent}%` }} /></div>
                  <StatusBadge tone={tone}>{percent}%</StatusBadge>
                </article>
              );
            })}
          </div>
        </section>

        {selectedUser ? (
          <section className="surface section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">{selectedUser.name}</h2>
                <p className="section-note">Dados individuais somente leitura</p>
              </div>
              <button className="btn btn-secondary" type="button" onClick={() => setSelectedUserId('')}>Fechar painel</button>
            </div>
            <ProductivityUserContent user={selectedUser} readOnly />
          </section>
        ) : null}

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Configuração de metas</h2>
              <p className="section-note">Meta global ou sobrescrita por pessoa</p>
            </div>
          </div>

          <form className="productivity-goal-form" onSubmit={handleApplyGlobal}>
            <label>
              <span>Meta diária global</span>
              <input type="number" min="0" step="0.25" value={globalGoal.dailyHours} onChange={(event) => setGlobalGoal((current) => ({ ...current, dailyHours: event.target.value }))} />
            </label>
            <label>
              <span>Meta semanal global</span>
              <input type="number" min="0" step="0.25" value={globalGoal.weeklyHours} onChange={(event) => setGlobalGoal((current) => ({ ...current, weeklyHours: event.target.value }))} />
            </label>
            <button className="btn" type="submit">Aplicar a todos</button>
          </form>

          <form className="productivity-goal-table" onSubmit={handleSavePerUser}>
            {users.map((user) => {
              const goalDraft = goalDraftForUser(user);
              return (
                <div key={user.id} className="productivity-goal-input-row">
                  <strong>{user.name}</strong>
                  <label>
                    <span>Diária</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={goalDraft.dailyHours}
                      onChange={(event) => updateGoalDraft(user.id, 'dailyHours', event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Semanal</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={goalDraft.weeklyHours}
                      onChange={(event) => updateGoalDraft(user.id, 'weeklyHours', event.target.value)}
                    />
                  </label>
                </div>
              );
            })}
            <button className="btn" type="submit">Salvar metas por usuário</button>
          </form>
        </section>
      </div>
    </>
  );
}
