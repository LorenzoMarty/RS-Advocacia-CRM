import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { PETITION_STATUS_COLUMNS } from '../data';
import { TaskTimer } from '../components/productivity';
import { petitionTaskType } from '../productivity-utils';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { listClientDrive } from '../services/documentos';
import {
  buildSearchText,
  formatCount,
  getStatusTone,
  normalizeText,
} from '../utils';
import { EmptyState, Field } from './common';

const PETITION_DEFAULT_STATUS = PETITION_STATUS_COLUMNS[0].label;
const PETITION_TYPE_OPTIONS = ['Petição', 'Contestação'];
const PETITION_DEFAULT_TYPE = PETITION_TYPE_OPTIONS[0];

function sortedUnique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

function createPetitionForm(petition = null, overrides = {}) {
  return {
    clientId: petition?.clientId || '',
    processId: petition?.processId || '',
    type: petition?.type || PETITION_DEFAULT_TYPE,
    adversary: petition?.adversary || '',
    responsible: petition?.responsible || '',
    driveLink: petition?.driveLink || '',
    pendingReason: petition?.pendingReason || '',
    area: petition?.area || '',
    status: petition?.status || PETITION_DEFAULT_STATUS,
    ...overrides,
  };
}

function petitionColumnKey(petition) {
  const status = normalizeText(petition.status);

  if (status.includes('protocolado')) {
    return 'protocolado';
  }

  if (status.includes('protocolar')) {
    return 'protocolar';
  }

  if (status.includes('andamento')) {
    return 'em_andamento';
  }

  return 'pendente';
}

function petitionStatusLabel(petition) {
  return PETITION_STATUS_COLUMNS.find((column) => column.key === petitionColumnKey(petition))?.label || PETITION_DEFAULT_STATUS;
}

function validatePetitionForm(form) {
  const nextErrors = {};

  if (!form.clientId) nextErrors.clientId = 'Selecione o cliente.';
  if (!form.processId) nextErrors.processId = 'Selecione o processo vinculado.';
  if (!PETITION_TYPE_OPTIONS.includes(form.type)) nextErrors.type = 'Selecione o tipo da peça.';
  if (!form.adversary.trim()) nextErrors.adversary = 'Informe o adverso.';
  if (!form.responsible.trim()) nextErrors.responsible = 'Informe o responsável pela ação.';
  if (form.driveLink.trim() && !/^https?:\/\//i.test(form.driveLink.trim())) {
    nextErrors.driveLink = 'Informe um link iniciado por http:// ou https://.';
  }

  return nextErrors;
}

function PetitionCard({
  clients,
  docBusy,
  isDragging,
  isMoving,
  onCreateDocument,
  onDragEnd,
  onDragStart,
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

  return (
    <article
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
    </article>
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
  } = useAppState();
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
      const criar = window.confirm('Criar um documento no Google Drive para esta peça e abri-lo agora?');
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
    const apagar = window.confirm(
      'Remover o documento desta peça?\n\nOK = apagar o arquivo no Drive também (era temporário).\nCancelar = manter o arquivo, só desvincular.',
    );
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

    if (nextColumnKey === 'pendente') {
      addFlash('Tarefa em andamento não volta para Pendente.', 'warn');
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
      <PageChrome label="Petições ou contestações" />
      <div className="petitions-page">
        <section className="surface petitions-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Petições ou contestações</h1>
              <p className="section-note">Kanban separado para peças, protocolo e acompanhamento.</p>
            </div>
            <div className="petitions-head-actions">
              <span className="badge gold">
                {formatCount(filteredPetitions.length, 'peça', 'peças')}
              </span>
              <Link className="btn" to="/peticoes-contestacoes/novo">
                Nova peça
              </Link>
            </div>
          </div>

          <div className="petitions-toolbar">
            <label className="toolbar-search" aria-label="Buscar petições ou contestações">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                placeholder="Buscar por cliente, adverso, tipo ou área"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="filter-select"
              aria-label="Filtrar por petições ou contestações"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">Petições ou contestações</option>
              {PETITION_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </section>

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
                    petitionsByColumn[column.key].map((petition) => (
                      <PetitionCard
                        key={petition.id}
                        clients={clients}
                        docBusy={docBusyId === petition.id}
                        isDragging={draggingPetitionId === petition.id}
                        isMoving={movingPetitionId === petition.id}
                        onCreateDocument={handleCreateDocument}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        onRemoveDocument={handleRemoveDocument}
                        onTimerStart={promotePetitionToActive}
                        petition={petition}
                        processes={processes}
                      />
                    ))
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
          <section className="surface section-card">
            <EmptyState
              title="Nenhum cliente cadastrado."
              copy="Cadastre um cliente antes de criar uma petição ou contestação."
              actions={<Link className="btn" to="/clientes/novo">Novo cliente</Link>}
            />
          </section>
        )}

      </div>
    </>
  );
}

function PetitionFolderFiles({ clientId }) {
  const [state, setState] = useState({ status: 'loading', files: [] });

  useEffect(() => {
    let isMounted = true;

    if (!clientId) {
      return undefined;
    }

    async function loadFiles() {
      try {
        const root = await listClientDrive(clientId);
        const peticoesFolder = root.folders.find(
          (folder) => normalizeText(folder.name) === normalizeText('Petições'),
        );
        if (!peticoesFolder) {
          if (isMounted) setState({ status: 'empty', files: [] });
          return;
        }
        const content = await listClientDrive(clientId, peticoesFolder.id);
        if (isMounted) {
          setState({ status: content.files.length ? 'ready' : 'empty', files: content.files });
        }
      } catch {
        if (isMounted) setState({ status: 'error', files: [] });
      }
    }

    loadFiles();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  return (
    <section className="surface petition-form-panel">
      <div className="section-head">
        <div>
          <h2 className="section-title">Arquivos na pasta Petições</h2>
          <p className="section-note">Documentos do cliente no Google Drive</p>
        </div>
      </div>

      {state.status === 'loading' ? <p className="section-note">Carregando…</p> : null}
      {state.status === 'error' ? <p className="section-note">Não foi possível listar os arquivos.</p> : null}
      {state.status === 'empty' ? <p className="section-note">Nenhum arquivo nesta pasta.</p> : null}
      {state.status === 'ready' ? (
        <ul className="petition-drive-files">
          {state.files.map((file) => (
            <li key={file.id}>
              {file.link ? (
                <a href={file.link} target="_blank" rel="noreferrer">{file.name}</a>
              ) : (
                <span>{file.name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PetitionFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const {
    clients,
    deletePetition,
    isPetitionsLoading,
    petitions,
    processes,
    savePetition,
    users,
  } = useAppState();
  const isEditing = Boolean(params.petitionId);
  const petition = petitions.find((item) => item.id === params.petitionId) || null;
  const initialClientId = searchParams.get('cliente') || '';
  const initialProcessId = searchParams.get('processo') || '';
  const [form, setForm] = useState(() => createPetitionForm(
    petition,
    isEditing ? {} : { clientId: initialClientId, processId: initialProcessId },
  ));
  const [errors, setErrors] = useState({});

  const clientOptions = [...clients].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  const processOptions = [...processes]
    .filter((process) => !form.clientId || process.clientId === form.clientId)
    .sort((left, right) => left.number.localeCompare(right.number, 'pt-BR'));
  const responsibleOptions = sortedUnique([
    ...users.map((user) => user.name),
    ...petitions.map((item) => item.responsible),
  ]);
  const derivedArea = processes.find((process) => process.id === form.processId)?.area || form.area || '';

  useEffect(() => {
    if (!petition) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(createPetitionForm(petition));
  }, [petition]);

  useEffect(() => {
    if (isEditing || !initialProcessId) {
      return;
    }

    const selectedProcess = processes.find((process) => process.id === initialProcessId);
    if (!selectedProcess) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((currentForm) => ({
      ...currentForm,
      clientId: currentForm.clientId || selectedProcess.clientId,
      processId: currentForm.processId || selectedProcess.id,
    }));
  }, [initialProcessId, isEditing, processes]);

  if (isEditing && !petition) {
    if (isPetitionsLoading) {
      return null;
    }

    return (
      <>
        <PageChrome label="Peça" />
        <section className="surface section-card">
          <EmptyState
            title="Peça não encontrada."
            copy="Volte para o kanban de petições ou contestações."
            actions={<Link className="btn" to="/peticoes-contestacoes">Voltar</Link>}
          />
        </section>
      </>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const selectedProcess = processes.find((process) => process.id === form.processId) || null;
    const clientId = form.clientId || selectedProcess?.clientId || '';
    const nextErrors = validatePetitionForm({ ...form, clientId });

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedPetition = await savePetition({
      id: petition?.id,
      clientId,
      processId: form.processId,
      processNumber: selectedProcess?.number || form.processNumber || '',
      type: form.type || PETITION_DEFAULT_TYPE,
      adversary: form.adversary.trim(),
      responsible: form.responsible.trim(),
      driveLink: form.driveLink.trim(),
      pendingReason: form.pendingReason.trim(),
      area: derivedArea,
      status: form.status || PETITION_DEFAULT_STATUS,
    });

    if (savedPetition) {
      navigate('/peticoes-contestacoes', { replace: true });
    }
  }

  async function handleDelete() {
    if (!petition) {
      return;
    }

    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: 'Esta petição ou contestação será deletada.',
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deletePetition(petition.id);
    if (wasDeleted) {
      navigate('/peticoes-contestacoes', { replace: true });
    }
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar peça' : 'Nova peça'} />
      {confirmPopup}

      <div className="petition-form-page">
        <section className="surface petition-form-intro">
          <div className="intro-grid">
            <Link className="intro-link" to="/peticoes-contestacoes">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para petições
            </Link>

            <div>
              <h1 className="intro-title">{isEditing ? 'Editar peça' : 'Nova peça'}</h1>
              <p className="intro-note">Cadastro de petição ou contestação.</p>
            </div>
          </div>
        </section>

        {clientOptions.length ? (
          <section className="surface petition-form-panel">
            <form className="petition-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <Field id="petition-client" label="Cliente" className="span-2" error={errors.clientId}>
                  <select
                    id="petition-client"
                    value={form.clientId}
                    onChange={(event) => {
                      const clientId = event.target.value;
                      setForm((currentForm) => {
                        const currentProcess = processes.find((process) => process.id === currentForm.processId);
                        return {
                          ...currentForm,
                          clientId,
                          processId: currentProcess?.clientId === clientId ? currentForm.processId : '',
                        };
                      });
                    }}
                  >
                    <option value="">Selecione o cliente</option>
                    {clientOptions.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </Field>

                <Field id="petition-process" label="Processo vinculado" className="span-2" error={errors.processId}>
                  <select
                    id="petition-process"
                    value={form.processId}
                    onChange={(event) => {
                      const processId = event.target.value;
                      const selectedProcess = processes.find((process) => process.id === processId) || null;
                      setForm((currentForm) => ({
                        ...currentForm,
                        processId,
                        clientId: selectedProcess?.clientId || currentForm.clientId,
                        area: selectedProcess?.area || '',
                      }));
                    }}
                  >
                    <option value="">Selecione o processo</option>
                    {processOptions.map((process) => {
                      const client = clients.find((item) => item.id === process.clientId) || null;
                      return (
                        <option key={process.id} value={process.id}>
                          {process.number}{client ? ` - ${client.name}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field id="petition-type" label="Tipo de peça" error={errors.type}>
                  <select
                    id="petition-type"
                    value={form.type}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, type: event.target.value }))}
                  >
                    {PETITION_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field id="petition-adversary" label="Adverso" error={errors.adversary}>
                  <input
                    id="petition-adversary"
                    value={form.adversary}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, adversary: event.target.value }))}
                  />
                </Field>

                <Field id="petition-responsible" label="Responsável pela ação" error={errors.responsible}>
                  <select
                    id="petition-responsible"
                    value={form.responsible}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, responsible: event.target.value }))}
                  >
                    <option value="">Selecione o responsável</option>
                    {responsibleOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>

                <Field id="petition-area" label="Área jurídica" note="Herdada do processo vinculado.">
                  <input
                    id="petition-area"
                    value={derivedArea}
                    readOnly
                    disabled
                    placeholder="Selecione um processo"
                  />
                </Field>

                <Field id="petition-status" label="Status" error={errors.status}>
                  <select
                    id="petition-status"
                    value={form.status}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value }))}
                  >
                    {PETITION_STATUS_COLUMNS.map((column) => (
                      <option key={column.key} value={column.label}>{column.label}</option>
                    ))}
                  </select>
                </Field>

                <Field id="petition-drive" label="Link do Drive" className="span-2" error={errors.driveLink}>
                  <input
                    id="petition-drive"
                    type="url"
                    value={form.driveLink}
                    placeholder="https://drive.google.com/..."
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, driveLink: event.target.value }))}
                  />
                </Field>

                <Field id="petition-pending-reason" label="Pendente: qual motivo?" className="span-2" error={errors.pendingReason}>
                  <textarea
                    id="petition-pending-reason"
                    rows="6"
                    value={form.pendingReason}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, pendingReason: event.target.value }))}
                  />
                </Field>
              </div>

              <div className="form-actions">
                <button className="btn" type="submit">
                  {isEditing ? 'Atualizar peça' : 'Salvar peça'}
                </button>
                {isEditing ? (
                  <button className="btn btn-danger" type="button" onClick={handleDelete}>
                    Excluir
                  </button>
                ) : null}
                <Link className="btn btn-secondary" to="/peticoes-contestacoes">
                  Cancelar
                </Link>
              </div>
            </form>
          </section>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum cliente cadastrado."
              copy="Cadastre um cliente antes de criar uma petição ou contestação."
              actions={<Link className="btn" to="/clientes/novo">Novo cliente</Link>}
            />
          </section>
        )}

        {isEditing && form.clientId ? (
          <PetitionFolderFiles key={form.clientId} clientId={form.clientId} />
        ) : null}
      </div>
    </>
  );
}
