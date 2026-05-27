import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DEADLINE_STATUS_COLUMNS } from '../data';
import { TaskTimer } from '../components/productivity';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import {
  buildSearchText,
  formatCount,
  formatDate,
  getStatusTone,
  isSameDay,
  normalizeText,
} from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

const DEADLINE_DEFAULT_STATUS = DEADLINE_STATUS_COLUMNS[0].label;

function sortedUnique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

function dateInputValue(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return dateInputValue();
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function dateFromInput(value) {
  return value ? new Date(`${value}T12:00:00`) : null;
}

function deadlineMoment(deadline) {
  return dateFromInput(deadline.date) || new Date();
}

function elapsedSecondsForDeadline(deadline, currentTime = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor(Number(deadline?.elapsedSeconds) || 0));

  if (!deadline?.timerStartedAt) {
    return elapsedSeconds;
  }

  const startedAt = new Date(deadline.timerStartedAt).getTime();

  if (Number.isNaN(startedAt)) {
    return elapsedSeconds;
  }

  return elapsedSeconds + Math.max(0, Math.floor((currentTime - startedAt) / 1000));
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function buildDeadlineTitle(process, responsible) {
  const processNumber = process?.number || '';
  const responsibleName = responsible.trim();

  if (!processNumber && !responsibleName) {
    return '';
  }

  return `${processNumber || 'Processo'} - ${responsibleName || 'Responsavel'}`;
}

function deadlineColumnKey(deadline) {
  const status = normalizeText(deadline.status);

  if (deadline.completed || status.includes('protocolado') || status.includes('conclu')) {
    return 'protocolado';
  }

  if (status.includes('protocolar')) {
    return 'protocolar';
  }

  if (status.includes('andamento')) {
    return 'em_andamento';
  }

  return 'a_fazer';
}

function deadlineStatusLabel(deadline) {
  return DEADLINE_STATUS_COLUMNS.find((column) => column.key === deadlineColumnKey(deadline))?.label || DEADLINE_DEFAULT_STATUS;
}

function deadlineCreatePath(selectedDate) {
  const params = new URLSearchParams({
    data: selectedDate || dateInputValue(),
  });

  return `/prazos/novo?${params.toString()}`;
}

function validateDeadlineForm(form) {
  const nextErrors = {};

  if (!form.processId) nextErrors.processId = 'Selecione o processo.';
  if (!form.responsible.trim()) nextErrors.responsible = 'Informe o responsavel.';

  return nextErrors;
}

function DeadlineCard({
  deadline,
  isDragging,
  isMoving,
  onDragStart,
  onDragEnd,
  processes,
}) {
  const process = processes.find((item) => item.id === deadline.processId) || null;
  const cardTitle = buildDeadlineTitle(process, deadline.responsible) || deadline.title;

  return (
    <article
      className={`deadline-card${isDragging ? ' is-dragging' : ''}${isMoving ? ' is-moving' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, deadline.id)}
      onDragEnd={onDragEnd}
    >
      <h3 className="deadline-card-title">
        <Link to={`/prazos/${deadline.id}`}>
          {cardTitle}
        </Link>
      </h3>
      <TaskTimer
        taskId={deadline.id}
        taskType="prazo"
        title={cardTitle}
        processId={deadline.processId}
        processNumber={process?.number || deadline.processNumber || ''}
      />
    </article>
  );
}

export function DeadlinesPage() {
  const { addFlash, clients, deadlines, processes, saveDeadline } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue(searchParams.get('data') || new Date()));
  const [search, setSearch] = useState('');
  const [responsible, setResponsible] = useState('');
  const [processId, setProcessId] = useState('');
  const [draggingDeadlineId, setDraggingDeadlineId] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');
  const [movingDeadlineId, setMovingDeadlineId] = useState('');

  const allDeadlines = [...deadlines]
    .sort((left, right) => new Date(deadlineMoment(left)) - new Date(deadlineMoment(right)));
  const selectedDateObject = dateFromInput(selectedDate);
  const processOptions = processes
    .filter((process) => allDeadlines.some((deadline) => deadline.processId === process.id))
    .sort((left, right) => left.number.localeCompare(right.number, 'pt-BR'));
  const responsibleOptions = [
    ...new Set(allDeadlines.map((deadline) => deadline.responsible).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right, 'pt-BR'));

  const filteredDeadlines = allDeadlines.filter((deadline) => {
    const process = processes.find((item) => item.id === deadline.processId) || null;
    const client = clients.find((item) => item.id === deadline.clientId) || null;
    const haystack = buildSearchText([
      deadline.title,
      deadline.status,
      deadline.responsible,
      process?.number,
      process?.area,
      client?.name,
    ]);

    if (selectedDateObject && !isSameDay(deadlineMoment(deadline), selectedDateObject)) {
      return false;
    }

    if (search && !haystack.includes(normalizeText(search))) {
      return false;
    }

    if (responsible && normalizeText(deadline.responsible) !== normalizeText(responsible)) {
      return false;
    }

    if (processId && deadline.processId !== processId) {
      return false;
    }

    return true;
  });

  const deadlinesByColumn = DEADLINE_STATUS_COLUMNS.reduce((columns, column) => {
    columns[column.key] = [];
    return columns;
  }, {});

  filteredDeadlines.forEach((deadline) => {
    deadlinesByColumn[deadlineColumnKey(deadline)].push(deadline);
  });

  async function moveDeadline(deadline, nextColumnKey) {
    const nextColumn = DEADLINE_STATUS_COLUMNS.find((column) => column.key === nextColumnKey);

    if (!nextColumn || deadlineColumnKey(deadline) === nextColumnKey) {
      return;
    }

    setMovingDeadlineId(deadline.id);

    try {
      const deadlineProcess = processes.find((process) => process.id === deadline.processId) || null;
      const savedDeadline = await saveDeadline({
        ...deadline,
        title: buildDeadlineTitle(deadlineProcess, deadline.responsible) || deadline.title,
        status: nextColumn.label,
        completed: nextColumn.key === 'protocolado',
      }, { silent: true });

      if (savedDeadline) {
        addFlash(`Prazo movido para ${nextColumn.label}.`, 'info');
      }
    } finally {
      window.setTimeout(() => {
        setMovingDeadlineId('');
      }, 220);
    }
  }

  function updateSelectedDate(nextDate) {
    const nextValue = typeof nextDate === 'function' ? nextDate(selectedDate) : nextDate;
    setSelectedDate(nextValue);

    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextValue) {
      nextSearchParams.set('data', nextValue);
    } else {
      nextSearchParams.delete('data');
    }
    setSearchParams(nextSearchParams, { replace: true });
  }

  function handleDragStart(event, deadlineId) {
    setDraggingDeadlineId(deadlineId);
    setDragOverColumnKey('');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', deadlineId);

    const dragImage = event.currentTarget.cloneNode(true);
    dragImage.classList.add('deadline-card-drag-preview');
    dragImage.style.width = `${event.currentTarget.offsetWidth}px`;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 24, 24);
    window.requestAnimationFrame(() => {
      dragImage.remove();
    });
  }

  function handleDragEnd() {
    setDraggingDeadlineId('');
    setDragOverColumnKey('');
  }

  function handleDragOver(event, columnKey) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (dragOverColumnKey !== columnKey) {
      setDragOverColumnKey(columnKey);
    }
  }

  function handleDragLeave(event, columnKey) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    if (dragOverColumnKey === columnKey) {
      setDragOverColumnKey('');
    }
  }

  function handleDrop(event, columnKey) {
    event.preventDefault();
    const deadlineId = event.dataTransfer.getData('text/plain') || draggingDeadlineId;
    const deadline = allDeadlines.find((item) => item.id === deadlineId);
    setDraggingDeadlineId('');
    setDragOverColumnKey('');

    if (deadline) {
      moveDeadline(deadline, columnKey);
    }
  }

  return (
    <>
      <PageChrome label="Prazos" />

      <div className="deadlines-page">
        <section className="surface deadlines-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Prazos</h1>
              <p className="section-note">Organização dos prazos fatais</p>
            </div>
            <div className="deadlines-head-actions">
              <span className="badge gold">
                {formatCount(filteredDeadlines.length, 'prazo', 'prazos')}
              </span>
              <Link className="btn" to={deadlineCreatePath(selectedDate)}>
                Novo prazo
              </Link>
            </div>
          </div>

          <div className="deadlines-toolbar">
            <div className="deadline-day-control">
              <label className="deadline-date-field">
                <span>Dia</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => updateSelectedDate(event.target.value)}
                />
              </label>
            </div>

            <div className="deadline-filter-grid">
              <label className="toolbar-search" aria-label="Buscar prazos">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  placeholder="Buscar por prazo, processo ou cliente"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <select
                className="filter-select"
                aria-label="Filtrar por responsavel"
                value={responsible}
                onChange={(event) => setResponsible(event.target.value)}
              >
                <option value="">Responsavel</option>
                {responsibleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                aria-label="Filtrar por processo"
                value={processId}
                onChange={(event) => setProcessId(event.target.value)}
              >
                <option value="">Processo</option>
                {processOptions.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.number}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {allDeadlines.length ? (
          <section className={`deadlines-board${draggingDeadlineId ? ' is-dragging' : ''}`} aria-label="Kanban de prazos fatais">
            {DEADLINE_STATUS_COLUMNS.map((column) => (
              <section
                className={`deadline-column${dragOverColumnKey === column.key ? ' is-drop-target' : ''}`}
                key={column.key}
                onDragEnter={(event) => handleDragOver(event, column.key)}
                onDragLeave={(event) => handleDragLeave(event, column.key)}
                onDragOver={(event) => handleDragOver(event, column.key)}
                onDrop={(event) => handleDrop(event, column.key)}
              >
                <div className="deadline-column-head">
                  <div>
                    <h2>{column.label}</h2>
                    <p>{formatCount(deadlinesByColumn[column.key].length, 'prazo', 'prazos')}</p>
                  </div>
                  <span className="deadline-column-count">
                    {deadlinesByColumn[column.key].length}
                  </span>
                </div>

                <div className="deadline-column-list">
                  {draggingDeadlineId && dragOverColumnKey === column.key ? (
                    <div className="deadline-drop-indicator">
                      Solte aqui
                    </div>
                  ) : null}

                  {deadlinesByColumn[column.key].length ? (
                    deadlinesByColumn[column.key].map((deadline) => (
                      <DeadlineCard
                        key={deadline.id}
                        deadline={deadline}
                        isDragging={draggingDeadlineId === deadline.id}
                        isMoving={movingDeadlineId === deadline.id}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        processes={processes}
                      />
                    ))
                  ) : (
                    <div className="deadline-column-empty">
                      Nenhum prazo nesta coluna.
                    </div>
                  )}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum prazo cadastrado."
              copy="Crie uma tarefa de prazo para organiza-la no Kanban."
              actions={<Link className="btn" to={deadlineCreatePath(selectedDate)}>Novo prazo</Link>}
            />
          </section>
        )}
      </div>
    </>
  );
}

export function DeadlineDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const {
    clients,
    deleteDeadline,
    deadlines,
    isDeadlinesLoading,
    loadDeadline,
    processes,
    saveDeadlineTimer,
  } = useAppState();
  const [remoteDeadline, setRemoteDeadline] = useState(null);
  const deadline = remoteDeadline || deadlines.find((item) => item.id === params.deadlineId) || null;
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isTimerSaving, setIsTimerSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchDeadline() {
      const deadlineData = await loadDeadline(params.deadlineId);

      if (isMounted) {
        setRemoteDeadline(deadlineData);
      }
    }

    fetchDeadline();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.deadlineId]);

  useEffect(() => {
    if (!deadline?.timerStartedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [deadline?.timerStartedAt]);

  if (!deadline) {
    if (isDeadlinesLoading) {
      return null;
    }

    return <NotFoundState title="Prazo nao encontrado." />;
  }

  const process = processes.find((item) => item.id === deadline.processId) || null;
  const client = clients.find((item) => item.id === deadline.clientId) || null;
  const deadlineTitle = buildDeadlineTitle(process, deadline.responsible) || deadline.title;
  const statusLabel = deadlineStatusLabel(deadline);
  const isTimerRunning = Boolean(deadline.timerStartedAt);
  const elapsedSeconds = elapsedSecondsForDeadline(deadline, currentTime);

  async function handleTimerStart() {
    if (isTimerRunning || isTimerSaving) {
      return;
    }

    setIsTimerSaving(true);
    try {
      await saveDeadlineTimer(deadline.id, {
        elapsedSeconds,
        timerStartedAt: new Date().toISOString(),
      });
      setCurrentTime(Date.now());
    } finally {
      setIsTimerSaving(false);
    }
  }

  async function handleTimerPause() {
    if (!isTimerRunning || isTimerSaving) {
      return;
    }

    setIsTimerSaving(true);
    try {
      await saveDeadlineTimer(deadline.id, {
        elapsedSeconds,
        timerStartedAt: '',
      });
      setCurrentTime(Date.now());
    } finally {
      setIsTimerSaving(false);
    }
  }

  async function handleDelete() {
    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O prazo "${deadlineTitle}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deleteDeadline(deadline.id);
    if (wasDeleted) {
      navigate(`/prazos?data=${encodeURIComponent(dateInputValue(deadlineMoment(deadline)))}`, { replace: true });
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome
        label="Prazo"
        actions={
          <>
            <Link className="btn btn-secondary" to={`/prazos/${deadline.id}/editar`}>
              Editar
            </Link>
            <button className="btn btn-danger" type="button" onClick={handleDelete}>
              Excluir
            </button>
          </>
        }
      />

      <div className="deadline-detail-page">
        <section className="surface deadline-detail-hero">
          <div className="crumbs">
            <Link to={`/prazos?data=${encodeURIComponent(dateInputValue(deadlineMoment(deadline)))}`}>
              Prazos
            </Link>
          </div>

          <div className="deadline-detail-head">
            <div>
              <h1 className="intro-title">{deadlineTitle}</h1>
              <p className="section-note">
                Tarefa do dia {formatDate(deadlineMoment(deadline))}
              </p>
            </div>
            <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
              {statusLabel}
            </StatusBadge>
          </div>
        </section>

        <div className="deadline-detail-layout">
          <section className="surface deadline-timer-panel">
            <div className="deadline-timer-copy">
              <span>Tempo gasto</span>
              <strong>{formatDuration(elapsedSeconds)}</strong>
              <p>{isTimerRunning ? 'Timer em andamento.' : 'Timer pausado.'}</p>
            </div>

            <div className="deadline-timer-actions">
              <button
                className="btn"
                type="button"
                onClick={handleTimerStart}
                disabled={isTimerRunning || isTimerSaving}
              >
                Iniciar
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleTimerPause}
                disabled={!isTimerRunning || isTimerSaving}
              >
                Pausar
              </button>
            </div>
          </section>

          <section className="surface deadline-detail-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Descricao</h2>
                <p className="section-note">Tarefa vinculada ao prazo</p>
              </div>
            </div>

            <div className="deadline-description-box">
              {deadline.description || 'Sem descricao cadastrada.'}
            </div>
          </section>

          <section className="surface deadline-detail-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Dados</h2>
                <p className="section-note">Vinculos do prazo</p>
              </div>
            </div>

            <div className="detail-grid">
              <article className="detail-item">
                <span>Processo</span>
                {process ? <Link to={`/processos/${process.id}`}>{process.number}</Link> : <strong>-</strong>}
              </article>
              <article className="detail-item">
                <span>Responsavel</span>
                <strong>{deadline.responsible || '-'}</strong>
              </article>
              <article className="detail-item">
                <span>Cliente</span>
                {client ? <Link to={`/clientes/${client.id}`}>{client.name}</Link> : <strong>-</strong>}
              </article>
              <article className="detail-item">
                <span>Status</span>
                <div className="detail-badge-wrap">
                  <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
                    {statusLabel}
                  </StatusBadge>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export function DeadlineFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const isEditing = Boolean(params.deadlineId);
  const {
    currentUser,
    deleteDeadline,
    deadlines,
    isDeadlinesLoading,
    processes,
    saveDeadline,
    users,
  } = useAppState();
  const deadline = deadlines.find((item) => item.id === params.deadlineId) || null;
  const initialDate = dateInputValue(searchParams.get('data') || new Date());
  const [form, setForm] = useState(() => ({
    processId: deadline?.processId || '',
    description: deadline?.description || '',
    responsible: deadline?.responsible || '',
    date: deadline ? dateInputValue(deadlineMoment(deadline)) : initialDate,
  }));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!deadline) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      processId: deadline.processId || '',
      description: deadline.description || '',
      responsible: deadline.responsible || '',
      date: dateInputValue(deadlineMoment(deadline)),
    });
  }, [deadline]);

  if (isEditing && !deadline) {
    if (isDeadlinesLoading) {
      return null;
    }

    return <NotFoundState title="Prazo nao encontrado." />;
  }

  const selectedProcess = processes.find((process) => process.id === form.processId) || null;
  const generatedTitle = buildDeadlineTitle(selectedProcess, form.responsible);
  const responsibleOptions = sortedUnique([
    currentUser?.name,
    ...users.map((user) => user.name),
    ...processes.map((process) => process.owner),
    ...deadlines.map((item) => item.responsible),
    deadline?.responsible,
  ]);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateDeadlineForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const process = processes.find((item) => item.id === form.processId) || null;
    const savedDeadline = await saveDeadline({
      id: deadline?.id,
      title: buildDeadlineTitle(process, form.responsible),
      priority: deadline?.priority || 'Alta',
      date: form.date,
      clientId: process?.clientId || '',
      processId: form.processId,
      responsible: form.responsible.trim(),
      status: deadline?.status || DEADLINE_DEFAULT_STATUS,
      description: form.description.trim(),
      notes: deadline?.notes || '',
      completed: deadline?.completed || false,
      elapsedSeconds: deadline?.elapsedSeconds || 0,
      timerStartedAt: deadline?.timerStartedAt || '',
      createdBy: deadline?.createdBy || form.responsible.trim() || 'Interno',
    });

    if (!savedDeadline) {
      return;
    }

    navigate(`/prazos?data=${encodeURIComponent(form.date)}`, { replace: true });
  }

  async function handleDelete() {
    if (!deadline) {
      return;
    }

    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O prazo "${generatedTitle || deadline.title}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deleteDeadline(deadline.id);
    if (wasDeleted) {
      navigate(`/prazos?data=${encodeURIComponent(form.date)}`, { replace: true });
    }
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar prazo' : 'Novo prazo'} />
      {confirmPopup}

      <div className="deadline-form-page">
        <section className="surface deadline-form-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={`/prazos?data=${encodeURIComponent(form.date)}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para prazos
            </Link>

            <div>
              <h1 className="intro-title">{isEditing ? 'Editar prazo' : 'Novo prazo'}</h1>
              <p className="intro-note">
                Tarefa do dia {formatDate(dateFromInput(form.date))}.
              </p>
            </div>
          </div>
        </section>

        {processes.length ? (
          <section className="surface deadline-form-panel">
            <form className="deadline-task-form" onSubmit={handleSubmit}>
              <div className="deadline-generated-name">
                <span>Nome do prazo</span>
                <strong>{generatedTitle || 'Selecione processo e responsavel'}</strong>
              </div>

              <div className="form-grid">
                <Field id="deadline-process" label="Processo" className="span-2" error={errors.processId}>
                  <select
                    id="deadline-process"
                    value={form.processId}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, processId: event.target.value }))}
                  >
                    <option value="">Selecione o processo</option>
                    {processes.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.number}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="deadline-responsible" label="Responsavel" className="span-2" error={errors.responsible}>
                  <select
                    id="deadline-responsible"
                    value={form.responsible}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, responsible: event.target.value }))}
                  >
                    <option value="">Selecione o responsavel</option>
                    {responsibleOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field id="deadline-description" label="Descricao opcional" className="span-2" error={errors.description}>
                  <textarea
                    id="deadline-description"
                    rows="6"
                    value={form.description}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))}
                  />
                </Field>
              </div>

              <div className="form-actions">
                <button className="btn" type="submit">
                  {isEditing ? 'Atualizar prazo' : 'Salvar prazo'}
                </button>
                {isEditing ? (
                  <button className="btn btn-danger" type="button" onClick={handleDelete}>
                    Excluir
                  </button>
                ) : null}
                <Link className="btn btn-secondary" to={`/prazos?data=${encodeURIComponent(form.date)}`}>
                  Cancelar
                </Link>
              </div>
            </form>
          </section>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum processo cadastrado."
              copy="Cadastre um processo antes de criar uma tarefa de prazo."
              actions={<Link className="btn" to="/processos/novo">Novo processo</Link>}
            />
          </section>
        )}
      </div>
    </>
  );
}
