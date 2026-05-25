import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DEADLINE_STATUS_COLUMNS } from '../data';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import {
  buildSearchText,
  formatCount,
  formatDate,
  formatTime,
  getStatusTone,
  isOverdueEvent,
  isSameDay,
  normalizeText,
} from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

const DEADLINE_TYPE = 'Prazo';
const DEADLINE_DEFAULT_STATUS = DEADLINE_STATUS_COLUMNS[0].label;
const DEADLINE_DEFAULT_TIME = '18:00';

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

function shiftDate(value, days) {
  const date = dateFromInput(value) || new Date();
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

function deadlineMoment(deadline) {
  return deadline.end || deadline.start;
}

function deadlineDateToIso(value) {
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : dateInputValue();
  return new Date(`${dateValue}T${DEADLINE_DEFAULT_TIME}:00`).toISOString();
}

function isDeadlineEvent(event) {
  return normalizeText(event.type).includes('prazo');
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

function deadlineCreatePath(selectedDate) {
  const params = new URLSearchParams({
    data: selectedDate || dateInputValue(),
  });

  return `/prazos/novo?${params.toString()}`;
}

function validateDeadlineForm(form) {
  const nextErrors = {};

  if (!form.processId) nextErrors.processId = 'Selecione o processo.';
  if (!form.description.trim()) nextErrors.description = 'Informe a descricao.';
  if (!form.responsible.trim()) nextErrors.responsible = 'Informe o responsavel.';

  return nextErrors;
}

function DeadlineCard({
  clients,
  deadline,
  isDragging,
  isMoving,
  onMove,
  onDragStart,
  onDragEnd,
  processes,
}) {
  const process = processes.find((item) => item.id === deadline.processId) || null;
  const client = clients.find((item) => item.id === deadline.clientId) || null;
  const currentColumnKey = deadlineColumnKey(deadline);
  const currentColumnIndex = DEADLINE_STATUS_COLUMNS.findIndex((column) => column.key === currentColumnKey);
  const previousColumn = DEADLINE_STATUS_COLUMNS[currentColumnIndex - 1] || null;
  const nextColumn = DEADLINE_STATUS_COLUMNS[currentColumnIndex + 1] || null;
  const isOverdue = isOverdueEvent(deadline) && currentColumnKey !== 'protocolado';

  return (
    <article
      className={`deadline-card${isOverdue ? ' is-overdue' : ''}${isDragging ? ' is-dragging' : ''}${isMoving ? ' is-moving' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, deadline.id)}
      onDragEnd={onDragEnd}
    >
      <div className="deadline-card-top">
        <StatusBadge tone={isOverdue ? 'danger' : getStatusTone(deadline.status, deadline.completed)}>
          {isOverdue ? 'Atrasado' : deadline.status || 'A fazer'}
        </StatusBadge>
        <span className="deadline-card-time">
          {formatTime(deadlineMoment(deadline))}
        </span>
      </div>

      <h3 className="deadline-card-title">
        <Link to={`/agenda/${deadline.id}`}>
          {buildDeadlineTitle(process, deadline.responsible) || deadline.title}
        </Link>
      </h3>

      <p className="deadline-card-date">
        Prazo fatal em {formatDate(deadlineMoment(deadline))}
      </p>

      <div className="deadline-card-meta">
        {process ? (
          <Link className="meta-chip" to={`/processos/${process.id}`}>
            {process.number}
          </Link>
        ) : (
          <span className="meta-chip">Processo nao vinculado</span>
        )}
        {deadline.responsible ? (
          <span className="meta-chip">{deadline.responsible}</span>
        ) : null}
        {client ? <span className="meta-chip">{client.name}</span> : null}
      </div>

      <div className="deadline-card-actions">
        {previousColumn ? (
          <button
            className="deadline-move"
            type="button"
            onClick={() => onMove(deadline, previousColumn.key)}
          >
            {previousColumn.label}
          </button>
        ) : null}
        {nextColumn ? (
          <button
            className="deadline-move deadline-move-primary"
            type="button"
            onClick={() => onMove(deadline, nextColumn.key)}
          >
            {nextColumn.label}
          </button>
        ) : null}
        <Link className="deadline-edit" to={`/prazos/${deadline.id}/editar`}>
          Editar
        </Link>
      </div>
    </article>
  );
}

export function DeadlinesPage() {
  const { clients, events, processes, saveEvent } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue(searchParams.get('data') || new Date()));
  const [search, setSearch] = useState('');
  const [responsible, setResponsible] = useState('');
  const [processId, setProcessId] = useState('');
  const [draggingDeadlineId, setDraggingDeadlineId] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');
  const [movingDeadlineId, setMovingDeadlineId] = useState('');

  const allDeadlines = events
    .filter(isDeadlineEvent)
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
      await saveEvent({
        ...deadline,
        title: buildDeadlineTitle(deadlineProcess, deadline.responsible) || deadline.title,
        status: nextColumn.label,
        completed: nextColumn.key === 'protocolado',
      });
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
              <p className="section-note">Kanban diario dos prazos fatais</p>
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
              <button
                className="icon-control"
                type="button"
                aria-label="Dia anterior"
                onClick={() => updateSelectedDate((value) => shiftDate(value, -1))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <label className="deadline-date-field">
                <span>Dia</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => updateSelectedDate(event.target.value)}
                />
              </label>
              <button
                className="icon-control"
                type="button"
                aria-label="Proximo dia"
                onClick={() => updateSelectedDate((value) => shiftDate(value, 1))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => updateSelectedDate(dateInputValue())}>
                Hoje
              </button>
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
                        clients={clients}
                        deadline={deadline}
                        isDragging={draggingDeadlineId === deadline.id}
                        isMoving={movingDeadlineId === deadline.id}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        onMove={moveDeadline}
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

export function DeadlineFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.deadlineId);
  const {
    events,
    isEventsLoading,
    processes,
    saveEvent,
    users,
  } = useAppState();
  const deadline = events.find((event) => event.id === params.deadlineId) || null;
  const initialDate = dateInputValue(searchParams.get('data') || new Date());
  const [form, setForm] = useState(() => ({
    processId: deadline?.processId || '',
    description: deadline?.description || '',
    responsible: deadline?.responsible || '',
    date: deadline ? dateInputValue(deadlineMoment(deadline)) : initialDate,
  }));
  const [errors, setErrors] = useState({});

  if (isEditing && !deadline) {
    if (isEventsLoading) {
      return null;
    }

    return <NotFoundState title="Prazo nao encontrado." />;
  }

  if (deadline && !isDeadlineEvent(deadline)) {
    return <NotFoundState title="Este registro nao e um prazo." />;
  }

  const selectedProcess = processes.find((process) => process.id === form.processId) || null;
  const generatedTitle = buildDeadlineTitle(selectedProcess, form.responsible);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateDeadlineForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const process = processes.find((item) => item.id === form.processId) || null;
    const savedDeadline = await saveEvent({
      id: deadline?.id,
      title: buildDeadlineTitle(process, form.responsible),
      type: DEADLINE_TYPE,
      priority: deadline?.priority || 'Alta',
      start: deadlineDateToIso(form.date),
      end: deadlineDateToIso(form.date),
      reminderAt: deadline?.reminderAt || '',
      clientId: process?.clientId || '',
      processId: form.processId,
      responsible: form.responsible.trim(),
      status: deadline?.status || DEADLINE_DEFAULT_STATUS,
      location: process?.court || 'Tarefa de prazo',
      description: form.description.trim(),
      notes: deadline?.notes || '',
      completed: deadline?.completed || false,
      createdBy: deadline?.createdBy || form.responsible.trim() || 'Interno',
    });

    if (!savedDeadline) {
      return;
    }

    navigate(`/prazos?data=${encodeURIComponent(form.date)}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar prazo' : 'Novo prazo'} />

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
                  <input
                    id="deadline-responsible"
                    list="deadline-responsibles"
                    value={form.responsible}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, responsible: event.target.value }))}
                  />
                  <datalist id="deadline-responsibles">
                    {users.map((user) => (
                      <option key={user.id} value={user.name} />
                    ))}
                  </datalist>
                </Field>

                <Field id="deadline-description" label="Descricao" className="span-2" error={errors.description}>
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
