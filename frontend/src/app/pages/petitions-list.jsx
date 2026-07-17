import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { PETITION_STATUS_COLUMNS } from '../data';
import { TaskTimer } from '../components/productivity';
import { petitionTaskType } from '../productivity-utils';
import { taskLoggedSeconds } from './productivity/productivity-data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import {
  motion,
  AnimatePresence,
  prefersReducedMotion,
  DURATION,
  EASE_OUT,
} from '../motion';
import { useAppState } from '../store';
import {
  buildSearchText,
  formatCount,
  getStatusTone,
  normalizeText,
} from '../utils';
import { Select } from '../components/select';
import { EmptyState } from './common';
import {
  PETITION_DEFAULT_TYPE,
  PETITION_TYPE_OPTIONS,
  petitionColumnKey,
  petitionStatusLabel,
} from './petitions-utils';

// Aliases de componentes motion (member access registra uso de `motion` no lint).
const MotionArticle = motion.article;

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

function PetitionCard({
  clients,
  docBusy,
  isDragging,
  isMoving,
  onCreateDocument,
  onDragEnd,
  onDragStart,
  onMove,
  onRemoveDocument,
  onTimerStart,
  petition,
  processes,
}) {
  const client = clients.find((item) => item.id === petition.clientId) || null;
  const process = processes.find((item) => item.id === petition.processId) || null;
  const clientName = client?.name || petition.clientName || 'Cliente';
  const processNumber = process?.number || petition.processNumber || '';
  const statusLabel = petitionStatusLabel(petition);
  const currentColumnKey = petitionColumnKey(petition);

  return (
    <MotionArticle
      layout
      {...kanbanCardMotion}
      className={`petition-card${isDragging ? ' is-dragging' : ''}${isMoving ? ' is-moving' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, petition.id)}
      onDragEnd={onDragEnd}
    >
      <div className="petition-card-main">
        <span className="petition-card-client">{clientName}</span>
        <h3>{petition.adversary || 'Adverso não informado'}</h3>
        <TaskTimer
          taskId={petition.id}
          taskType={petitionTaskType(petition)}
          title={petition.adversary || petition.type || PETITION_DEFAULT_TYPE}
          processId={petition.processId}
          processNumber={processNumber}
          taskStatus={petition.status}
          onStart={() => onTimerStart?.(petition)}
        />
        <div className="petition-card-meta">
          {processNumber ? <span>{processNumber}</span> : null}
          <span>{petition.type || PETITION_DEFAULT_TYPE}</span>
          <span>{petition.responsible || 'Sem responsável'}</span>
          <span>{petition.area || 'Sem área'}</span>
        </div>
      </div>

      {petition.pendingReason && petitionColumnKey(petition) === 'pendente' ? (
        <p className="petition-card-reason">{petition.pendingReason}</p>
      ) : null}

      {petition.driveFileId ? (
        <p className="petition-card-docbadge">📄 Documento criado no Drive</p>
      ) : null}

      <Select
        className="petition-card-status-select"
        aria-label={`Mover peça de "${clientName}" para outra coluna`}
        value={currentColumnKey}
        onChange={(event) => onMove(petition, event.target.value)}
      >
        {PETITION_STATUS_COLUMNS.map((column) => (
          <option key={column.key} value={column.key}>{column.label}</option>
        ))}
      </Select>

      <div className="petition-card-footer">
        <StatusBadge tone={getStatusTone(statusLabel)}>{statusLabel}</StatusBadge>
        <div className="petition-card-actions">
          {petition.driveLink ? (
            <a href={petition.driveLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              Abrir no Drive
            </a>
          ) : null}
          {!petition.driveFileId && !petition.driveLink ? (
            <button
              type="button"
              className="linklike"
              disabled={docBusy}
              onClick={(event) => {
                event.stopPropagation();
                onCreateDocument?.(petition, { open: true });
              }}
            >
              {docBusy ? 'Criando…' : 'Criar documento'}
            </button>
          ) : null}
          {petition.driveFileId ? (
            <button
              type="button"
              className="linklike"
              disabled={docBusy}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveDocument?.(petition);
              }}
            >
              Remover doc
            </button>
          ) : null}
          <Link to={`/peticoes-contestacoes/${petition.id}/editar`}>
            Editar
          </Link>
        </div>
      </div>
    </MotionArticle>
  );
}

export function PetitionsPage() {
  const {
    addFlash,
    clients,
    createPetitionDocument,
    isPetitionsLoading,
    petitions,
    processes,
    removePetitionDocument,
    savePetition,
    timeEntries,
  } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');
  const [docBusyId, setDocBusyId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [draggingPetitionId, setDraggingPetitionId] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');
  const [movingPetitionId, setMovingPetitionId] = useState('');

  const clientOptions = [...clients].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  const allPetitions = [...petitions].sort((left, right) => {
    const leftClient = left.clientName || clients.find((client) => client.id === left.clientId)?.name || '';
    const rightClient = right.clientName || clients.find((client) => client.id === right.clientId)?.name || '';
    return leftClient.localeCompare(rightClient, 'pt-BR') || left.adversary.localeCompare(right.adversary, 'pt-BR');
  });

  const filteredPetitions = allPetitions.filter((petition) => {
    const client = clients.find((item) => item.id === petition.clientId) || null;
    const process = processes.find((item) => item.id === petition.processId) || null;
    const haystack = buildSearchText([
      petition.adversary,
      petition.responsible,
      petition.area,
      petition.type,
      petition.processNumber,
      petition.pendingReason,
      petition.status,
      petition.clientName,
      client?.name,
      process?.number,
    ]);

    if (search && !haystack.includes(normalizeText(search))) {
      return false;
    }

    if (typeFilter && normalizeText(petition.type) !== normalizeText(typeFilter)) {
      return false;
    }

    return true;
  });

  const petitionsByColumn = PETITION_STATUS_COLUMNS.reduce((columns, column) => {
    columns[column.key] = [];
    return columns;
  }, {});

  filteredPetitions.forEach((petition) => {
    petitionsByColumn[petitionColumnKey(petition)].push(petition);
  });

  async function promotePetitionToActive(petition) {
    if (petitionColumnKey(petition) !== 'pendente') {
      return;
    }
    await savePetition({ ...petition, status: 'Em andamento' }, { silent: true });
    // Ao iniciar, oferecer criar o documento no Drive e abri-lo automaticamente.
    if (!petition.driveFileId && !petition.driveLink) {
      const criar = await confirm({
        title: 'Criar documento no Drive?',
        message: 'Cria um documento no Google Drive para esta peça e abre em uma nova aba.',
        confirmLabel: 'Criar e abrir',
        cancelLabel: 'Agora não',
        tone: 'default',
      });
      if (criar) {
        await handleCreateDocument(petition, { open: true });
      }
    }
  }

  async function handleCreateDocument(petition, { open = false } = {}) {
    if (docBusyId) return;
    setDocBusyId(petition.id);
    try {
      const saved = await createPetitionDocument(petition.id);
      if (saved?.driveLink && open) {
        window.open(saved.driveLink, '_blank', 'noopener');
      }
    } finally {
      setDocBusyId('');
    }
  }

  async function handleRemoveDocument(petition) {
    if (docBusyId) return;
    const apagar = await confirm({
      title: 'Remover o documento desta peça?',
      message: 'Apagar o arquivo também remove o arquivo do Drive (era temporário). Manter só desvincula o documento da peça, sem apagá-lo.',
      confirmLabel: 'Apagar arquivo',
      cancelLabel: 'Manter arquivo',
      tone: 'danger',
    });
    setDocBusyId(petition.id);
    try {
      await removePetitionDocument(petition.id, { deleteFile: apagar });
    } finally {
      setDocBusyId('');
    }
  }

  async function movePetition(petition, nextColumnKey) {
    const nextColumn = PETITION_STATUS_COLUMNS.find((column) => column.key === nextColumnKey);

    if (!nextColumn || petitionColumnKey(petition) === nextColumnKey) {
      return;
    }

    if (nextColumnKey === 'pendente' && taskLoggedSeconds(timeEntries, petition.id, petitionTaskType(petition)) > 0) {
      addFlash('Tarefa com tempo registrado não volta para Pendente.', 'warn');
      return;
    }

    setMovingPetitionId(petition.id);

    try {
      const savedPetition = await savePetition({
        ...petition,
        status: nextColumn.label,
      }, { silent: true });

      if (savedPetition) {
        addFlash(`Peça movida para ${nextColumn.label}.`, 'info');
      }
    } finally {
      window.setTimeout(() => {
        setMovingPetitionId('');
      }, 220);
    }
  }

  function handleDragStart(event, petitionId) {
    setDraggingPetitionId(petitionId);
    setDragOverColumnKey('');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', petitionId);

    const dragImage = event.currentTarget.cloneNode(true);
    dragImage.classList.add('petition-card-drag-preview');
    dragImage.style.width = `${event.currentTarget.offsetWidth}px`;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 24, 24);
    window.requestAnimationFrame(() => {
      dragImage.remove();
    });
  }

  function handleDragEnd() {
    setDraggingPetitionId('');
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
    const petitionId = event.dataTransfer.getData('text/plain') || draggingPetitionId;
    const petition = allPetitions.find((item) => item.id === petitionId);
    setDraggingPetitionId('');
    setDragOverColumnKey('');

    if (petition) {
      movePetition(petition, columnKey);
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Petições ou contestações" />
      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Petições ou contestações</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kanban separado para peças, protocolo e acompanhamento.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge>{formatCount(filteredPetitions.length, 'peça', 'peças')}</Badge>
              <Button asChild>
                <Link to="/peticoes-contestacoes/novo" data-tour="page-primary-action">
                  <Plus className="size-4" />
                  Nova peça
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <label
              className="toolbar-search flex-1"
              aria-label="Buscar petições ou contestações"
            >
              <Search className="size-[17px]" strokeWidth={1.8} />
              <input
                type="search"
                placeholder="Buscar por cliente, adverso, tipo ou área"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="w-full sm:w-[240px]">
              <Select
                aria-label="Filtrar por petições ou contestações"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">Petições ou contestações</option>
                {PETITION_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {clientOptions.length ? (
          <section className={`petitions-board${draggingPetitionId ? ' is-dragging' : ''}`} aria-label="Kanban de petições ou contestações">
            {PETITION_STATUS_COLUMNS.map((column) => (
              <section
                className={`petition-column${dragOverColumnKey === column.key ? ' is-drop-target' : ''}`}
                key={column.key}
                onDragEnter={(event) => handleDragOver(event, column.key)}
                onDragLeave={(event) => handleDragLeave(event, column.key)}
                onDragOver={(event) => handleDragOver(event, column.key)}
                onDrop={(event) => handleDrop(event, column.key)}
              >
                <div className="petition-column-head">
                  <div>
                    <h2>{column.label}</h2>
                    <p>{formatCount(petitionsByColumn[column.key].length, 'peça', 'peças')}</p>
                  </div>
                  <span>{petitionsByColumn[column.key].length}</span>
                </div>

                <div className="petition-column-list">
                  {draggingPetitionId && dragOverColumnKey === column.key ? (
                    <div className="petition-drop-indicator">Solte aqui</div>
                  ) : null}

                  {petitionsByColumn[column.key].length ? (
                    <AnimatePresence initial={false}>
                      {petitionsByColumn[column.key].map((petition) => (
                        <PetitionCard
                          key={petition.id}
                          clients={clients}
                          docBusy={docBusyId === petition.id}
                          isDragging={draggingPetitionId === petition.id}
                          isMoving={movingPetitionId === petition.id}
                          onCreateDocument={handleCreateDocument}
                          onDragEnd={handleDragEnd}
                          onDragStart={handleDragStart}
                          onMove={movePetition}
                          onRemoveDocument={handleRemoveDocument}
                          onTimerStart={promotePetitionToActive}
                          petition={petition}
                          processes={processes}
                        />
                      ))}
                    </AnimatePresence>
                  ) : (
                    <div className="petition-column-empty">
                      {isPetitionsLoading ? 'Carregando peças.' : 'Nenhuma peça nesta coluna.'}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <EmptyState
            title="Nenhum cliente cadastrado."
            copy="Cadastre um cliente antes de criar uma petição ou contestação."
            actions={<Link className="btn" to="/clientes/novo">Novo cliente</Link>}
          />
        )}

      </div>
    </>
  );
}
