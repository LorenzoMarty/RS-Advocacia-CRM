import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { DEADLINE_STATUS_COLUMNS } from '../data';
import { TaskTimer } from '../components/productivity';
import { taskLoggedSeconds } from './productivity/productivity-data';
import { PageChrome, StatusBadge } from '../layout';
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
  getStatusTone,
  normalizeText,
  startOfDay,
} from '../utils';
import { Select } from '../components/select';
import { EmptyState } from './common';
import {
  buildDeadlineTitle,
  deadlineColumnKey,
  deadlineCreatePath,
  deadlineMoment,
  deadlineStatusLabel,
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

function DeadlineCard({
  deadline,
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
  const statusLabel = deadlineStatusLabel(deadline);
  const currentColumnKey = deadlineColumnKey(deadline);
  const isOverdue = currentColumnKey !== 'protocolado' && startOfDay(deadlineMoment(deadline)) < startOfDay(new Date());

  return (
    <MotionArticle
      {...kanbanCardMotion}
      {...interactions}
      className={`deadline-card is-clickable${isDragging ? ' is-dragging' : ''}${isMoving ? ' is-moving' : ''}${isOverdue ? ' is-overdue' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, deadline.id)}
      onDragEnd={onDragEnd}
    >
      <h3 className="deadline-card-title">
        <Link to={`/prazos/${deadline.id}`}>
          {cardTitle}
        </Link>
      </h3>
      <div className="deadline-card-meta">
        <span>{formatDate(deadlineMoment(deadline))}</span>
        <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
          {statusLabel}
        </StatusBadge>
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
    </MotionArticle>
  );
}

export function DeadlinesPage() {
  const { addFlash, clients, deadlines, isDeadlinesLoading, processes, saveDeadline, timeEntries } = useAppState();
  const [search, setSearch] = useState('');
  const [responsible, setResponsible] = useState('');
  const [processId, setProcessId] = useState('');
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

        return true;
      }),
    [allDeadlines, clients, processId, processes, responsible, search],
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
      <PageChrome label="Prazos" />

      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Prazos</p>
              <p className="mt-1 text-sm text-muted-foreground">Organização dos prazos fatais</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{formatCount(filteredDeadlines.length, 'prazo', 'prazos')}</Badge>
              <Button asChild>
                <Link to={deadlineCreatePath()} data-tour="page-primary-action">
                  <Plus className="size-4" />
                  Novo prazo
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <label className="toolbar-search flex-1 basis-full sm:basis-auto" aria-label="Buscar prazos">
              <Search className="size-[17px]" strokeWidth={1.8} />
              <input
                type="search"
                placeholder="Buscar por prazo, processo ou cliente"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="w-full sm:w-[200px]">
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

            <div className="w-full sm:w-[200px]">
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
          </CardContent>
        </Card>

        {isDeadlinesLoading ? (
          <Card>
            <CardContent className="py-5">
              <div className="skeleton-stack">
                <span className="skeleton" style={{ height: 22, width: '40%' }} />
                <span className="skeleton" style={{ height: 120 }} />
                <span className="skeleton" style={{ height: 120 }} />
              </div>
            </CardContent>
          </Card>
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
                  <div>
                    <h2>{column.label}</h2>
                    <p>{formatCount(deadlinesByColumn[column.key].length, 'prazo', 'prazos')}</p>
                  </div>
                  <MotionSpan
                    key={deadlinesByColumn[column.key].length}
                    className="deadline-column-count"
                    variants={pop}
                    initial="hidden"
                    animate="visible"
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
