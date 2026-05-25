import { useState } from 'react';
import { Link } from 'react-router-dom';

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
import { EmptyState } from './common';

const DEADLINE_TYPE = 'Prazo';

function dateInputValue(value = new Date()) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
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

function isDeadlineEvent(event) {
  return normalizeText(event.type).includes('prazo');
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
    tipo: DEADLINE_TYPE,
    status: DEADLINE_STATUS_COLUMNS[0].label,
    data: selectedDate || dateInputValue(),
    voltar: '/prazos',
  });

  return `/agenda/novo?${params.toString()}`;
}

function DeadlineCard({
  clients,
  deadline,
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
      className={`deadline-card${isOverdue ? ' is-overdue' : ''}`}
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
        <Link to={`/agenda/${deadline.id}`}>{deadline.title}</Link>
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
        <Link className="deadline-edit" to={`/agenda/${deadline.id}/editar`}>
          Editar
        </Link>
      </div>
    </article>
  );
}

export function DeadlinesPage() {
  const { clients, events, processes, saveEvent } = useAppState();
  const [selectedDate, setSelectedDate] = useState(() => dateInputValue());
  const [search, setSearch] = useState('');
  const [responsible, setResponsible] = useState('');
  const [processId, setProcessId] = useState('');
  const [draggingDeadlineId, setDraggingDeadlineId] = useState('');

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

    await saveEvent({
      ...deadline,
      status: nextColumn.label,
      completed: nextColumn.key === 'protocolado',
    });
  }

  function handleDragStart(event, deadlineId) {
    setDraggingDeadlineId(deadlineId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', deadlineId);
  }

  function handleDrop(event, columnKey) {
    event.preventDefault();
    const deadlineId = event.dataTransfer.getData('text/plain') || draggingDeadlineId;
    const deadline = allDeadlines.find((item) => item.id === deadlineId);
    setDraggingDeadlineId('');

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
                onClick={() => setSelectedDate((value) => shiftDate(value, -1))}
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
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </label>
              <button
                className="icon-control"
                type="button"
                aria-label="Proximo dia"
                onClick={() => setSelectedDate((value) => shiftDate(value, 1))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => setSelectedDate(dateInputValue())}>
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
          <section className="deadlines-board" aria-label="Kanban de prazos fatais">
            {DEADLINE_STATUS_COLUMNS.map((column) => (
              <section
                className="deadline-column"
                key={column.key}
                onDragOver={(event) => event.preventDefault()}
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
                  {deadlinesByColumn[column.key].length ? (
                    deadlinesByColumn[column.key].map((deadline) => (
                      <DeadlineCard
                        key={deadline.id}
                        clients={clients}
                        deadline={deadline}
                        onDragEnd={() => setDraggingDeadlineId('')}
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
              copy="Crie um compromisso do tipo Prazo para organiza-lo no Kanban."
              actions={<Link className="btn" to={deadlineCreatePath(selectedDate)}>Novo prazo</Link>}
            />
          </section>
        )}
      </div>
    </>
  );
}
