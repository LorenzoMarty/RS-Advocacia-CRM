import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { PageHeader } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';

import { DEADLINE_STATUS_COLUMNS } from '../data';
import { TaskTimer } from '../components/productivity';
import { taskLoggedSeconds } from './productivity/productivity-data';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import {
  motion,
  AnimatePresence,
  pop,
  cardHover,
  prefersReducedMotion,
  DURATION,
  EASE_OUT,
} from '../motion';
import { useAppState } from '../store';
import {
  buildSearchText,
  formatCount,
  formatDate,
  formatRelativeDue,
  getStatusTone,
  normalizeText,
} from '../utils';
import { Select } from '../components/select';
import { EmptyState } from './common';
import {
  buildDeadlineTitle,
  deadlineColumnKey,
  deadlineCreatePath,
  deadlineMoment,
} from './deadlines-utils';

// Aliases de componentes motion (member access registra uso de `motion` no lint).
const MotionArticle = motion.article;
const MotionSpan = motion.span;
const MotionDiv = motion.div;

// Entrada/saída de cards dentro de uma coluna do kanban (AnimatePresence).
const kanbanCardMotion = prefersReducedMotion()
  ? {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    }
  : {
      initial: { opacity: 0, y: 8, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
      exit: { opacity: 0, scale: 0.96, transition: { duration: DURATION.fast, ease: EASE_OUT } },
    };

const COLUMN_DOT = {
  a_fazer: 'var(--subtle)',
  em_andamento: 'var(--info)',
  protocolar: 'var(--warn)',
  protocolado: 'var(--success)',
};

const PRIORITY_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'alta', label: 'Alta' },
  { value: 'semana', label: 'Esta semana' },
];

function DeadlineCard({
  deadline,
  clientName,
  isDragging,
  isMoving,
  onDragStart,
  onDragEnd,
  onMove,
  onTimerStart,
  processes,
}) {
  const process = processes.find((item) => item.id === deadline.processId) || null;
  const cardTitle = buildDeadlineTitle(process, deadline.responsibleName) || deadline.title;
  const interactions = isDragging ? {} : cardHover;
  const currentColumnKey = deadlineColumnKey(deadline);
  const isClosed = currentColumnKey === 'protocolado';
  const due = formatRelativeDue(deadlineMoment(deadline));
  const isOverdue = !isClosed && due.days < 0;
  const isUrgent = !isClosed && due.days <= 1;
  const firstName = (deadline.responsibleName || '').split(' ')[0];

  return (
    <MotionArticle
      {...kanbanCardMotion}
      {...interactions}
      className={`deadline-card is-clickable${isDragging ? ' is-dragging' : ''}${isMoving ? ' is-moving' : ''}${isOverdue ? ' is-overdue' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, deadline.id)}
      onDragEnd={onDragEnd}
    >
      <div className="deadline-card-top">
        <StatusBadge pill tone={getStatusTone(deadline.priority)}>{deadline.priority || '—'}</StatusBadge>
        {isClosed ? null : <span className={`deadline-card-due${isUrgent ? ' is-urgent' : ''}`}>{due.label}</span>}
      </div>
      <h3 className="deadline-card-title">
        <Link to={`/prazos/${deadline.id}`}>
          {cardTitle}
        </Link>
      </h3>
      <div className="deadline-card-client">
        <span>{clientName || '—'}</span>
        <span className="deadline-card-number">{process?.number || deadline.processNumber || ''}</span>
      </div>
      <Select
        className="deadline-card-status-select"
        aria-label={`Mover "${cardTitle}" para outra coluna`}
        value={currentColumnKey}
        onChange={(event) => onMove(deadline, event.target.value)}
      >
        {DEADLINE_STATUS_COLUMNS.map((column) => (
          <option key={column.key} value={column.key}>{column.label}</option>
        ))}
      </Select>
      <TaskTimer
        taskId={deadline.id}
        taskType="prazo"
        title={cardTitle}
        processId={deadline.processId}
        processNumber={process?.number || deadline.processNumber || ''}
        taskStatus={deadline.status}
        onStart={() => onTimerStart?.(deadline)}
      />
      <div className="deadline-card-foot">
        <span className="deadline-card-owner">
          <Avatar name={deadline.responsibleName} seed={deadline.responsible || deadline.responsibleName} size={26} />
          {firstName}
        </span>
        <span className="deadline-card-date">
          <CalendarDays className="size-[13px]" aria-hidden="true" />
          {formatDate(deadlineMoment(deadline))}
        </span>
      </div>
    </MotionArticle>
  );
}

export function DeadlinesPage() {
  const { addFlash, clients, deadlines, isDeadlinesLoading, processes, saveDeadline, timeEntries } = useAppState();
  const [search, setSearch] = useState('');
  const [responsible, setResponsible] = useState('');
  const [processId, setProcessId] = useState('');
  const [priorityTab, setPriorityTab] = useState('todos');
  const [draggingDeadlineId, setDraggingDeadlineId] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');
  const [movingDeadlineId, setMovingDeadlineId] = useState('');

  const allDeadlines = useMemo(
    () =>
      [...deadlines].sort(
        (left, right) => new Date(deadlineMoment(left)) - new Date(deadlineMoment(right)),
      ),
    [deadlines],
  );

  const processOptions = useMemo(
    () =>
      processes
        .filter((process) => allDeadlines.some((deadline) => deadline.processId === process.id))
        .sort((left, right) => left.number.localeCompare(right.number, 'pt-BR')),
    [allDeadlines, processes],
  );

  const responsibleOptions = useMemo(
    () =>
      [...new Set(allDeadlines.map((deadline) => deadline.responsibleName).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right, 'pt-BR'),
      ),
    [allDeadlines],
  );

  const filteredDeadlines = useMemo(
    () =>
      allDeadlines.filter((deadline) => {
        const process = processes.find((item) => item.id === deadline.processId) || null;
        const client = clients.find((item) => item.id === deadline.clientId) || null;
        const haystack = buildSearchText([
          deadline.title,
          deadline.status,
          deadline.responsibleName,
          process?.number,
          process?.area,
          client?.name,
        ]);

        if (search && !haystack.includes(normalizeText(search))) {
          return false;
        }

        if (responsible && normalizeText(deadline.responsibleName) !== normalizeText(responsible)) {
          return false;
        }

        if (processId && deadline.processId !== processId) {
          return false;
        }

        if (priorityTab === 'alta' && !normalizeText(deadline.priority).includes('alta')) {
          return false;
        }

        if (priorityTab === 'semana' && formatRelativeDue(deadlineMoment(deadline)).days > 7) {
          return false;
        }

        return true;
      }),
    [allDeadlines, clients, priorityTab, processId, processes, responsible, search],
  );

  const deadlinesByColumn = useMemo(() => {
    const columns = DEADLINE_STATUS_COLUMNS.reduce((cols, column) => {
      cols[column.key] = [];
      return cols;
    }, {});
    filteredDeadlines.forEach((deadline) => {
      columns[deadlineColumnKey(deadline)].push(deadline);
    });
    return columns;
  }, [filteredDeadlines]);

  async function promoteDeadlineToActive(deadline) {
    if (deadlineColumnKey(deadline) !== 'a_fazer') {
      return;
    }
    const deadlineProcess = processes.find((process) => process.id === deadline.processId) || null;
    await saveDeadline({
      ...deadline,
      title: buildDeadlineTitle(deadlineProcess, deadline.responsibleName) || deadline.title,
      status: 'Em andamento',
    }, { silent: true });
  }

  async function moveDeadline(deadline, nextColumnKey) {
    const nextColumn = DEADLINE_STATUS_COLUMNS.find((column) => column.key === nextColumnKey);

    if (!nextColumn || deadlineColumnKey(deadline) === nextColumnKey) {
      return;
    }

    if (nextColumnKey === 'a_fazer' && taskLoggedSeconds(timeEntries, deadline.id, 'prazo') > 0) {
      addFlash('Tarefa com tempo registrado não volta para Pendente.', 'warn');
      return;
    }

    setMovingDeadlineId(deadline.id);

    try {
      const deadlineProcess = processes.find((process) => process.id === deadline.processId) || null;
      const savedDeadline = await saveDeadline({
        ...deadline,
        title: buildDeadlineTitle(deadlineProcess, deadline.responsibleName) || deadline.title,
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
      <PageChrome label="Prazos" primaryAction={{ label: 'Novo prazo', to: deadlineCreatePath(), tour: 'page-primary-action' }} />

      <div className="flex flex-col gap-[var(--gap-grid)]">
        <PageHeader title="Prazos" subtitle="Arraste entre colunas para atualizar o status">
          <PageSearch
            className="on-bg"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por prazo, processo ou cliente"
            label="Buscar prazos"
          />
          <div className="on-bg w-44">
            <Select
              aria-label="Filtrar por responsavel"
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
            >
              <option value="">Responsável</option>
              {responsibleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="on-bg w-44">
            <Select
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
            </Select>
          </div>
          <Segmented tone="bg" label="Filtro de prioridade" options={PRIORITY_TABS} value={priorityTab} onChange={setPriorityTab} />
        </PageHeader>

        {isDeadlinesLoading ? (
          <div className="rounded-lg bg-card p-[var(--pad-card)]">
            <div className="skeleton-stack">
              <span className="skeleton" style={{ height: 22, width: '40%' }} />
              <span className="skeleton" style={{ height: 120 }} />
              <span className="skeleton" style={{ height: 120 }} />
            </div>
          </div>
        ) : allDeadlines.length ? (
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
                  <span className="deadline-column-dot" style={{ background: COLUMN_DOT[column.key] }} aria-hidden="true" />
                  <h2>{column.label}</h2>
                  <MotionSpan
                    key={deadlinesByColumn[column.key].length}
                    className="deadline-column-count"
                    variants={pop}
                    initial="hidden"
                    animate="visible"
                    aria-label={formatCount(deadlinesByColumn[column.key].length, 'prazo', 'prazos')}
                  >
                    {deadlinesByColumn[column.key].length}
                  </MotionSpan>
                </div>

                <div className="deadline-column-list">
                  <AnimatePresence initial={false}>
                    {draggingDeadlineId && dragOverColumnKey === column.key ? (
                      <MotionDiv
                        className="deadline-drop-indicator"
                        initial={{ opacity: 0, scaleY: 0.6 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.6 }}
                        transition={{ duration: DURATION.fast, ease: EASE_OUT }}
                      >
                        Solte aqui
                      </MotionDiv>
                    ) : null}
                  </AnimatePresence>

                  {deadlinesByColumn[column.key].length ? (
                    <AnimatePresence initial={false}>
                      {deadlinesByColumn[column.key].map((deadline) => (
                        <DeadlineCard
                          key={deadline.id}
                          deadline={deadline}
                          clientName={deadline.clientName || clients.find((client) => client.id === deadline.clientId)?.name}
                          isDragging={draggingDeadlineId === deadline.id}
                          isMoving={movingDeadlineId === deadline.id}
                          onDragEnd={handleDragEnd}
                          onDragStart={handleDragStart}
                          onMove={moveDeadline}
                          onTimerStart={promoteDeadlineToActive}
                          processes={processes}
                        />
                      ))}
                    </AnimatePresence>
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
          <EmptyState
            title="Nenhum prazo cadastrado."
            copy="Crie uma tarefa de prazo para organiza-la no Kanban."
            actions={<Link className="btn" to={deadlineCreatePath()}>Novo prazo</Link>}
          />
        )}
      </div>
    </>
  );
}
