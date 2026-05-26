import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PETITION_STATUS_COLUMNS, PROCESS_AREA_OPTIONS } from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import {
  buildSearchText,
  formatCount,
  formatDate,
  getStatusTone,
  normalizeText,
} from '../utils';
import { EmptyState, Field } from './common';

const PETITION_DEFAULT_STATUS = PETITION_STATUS_COLUMNS[0].label;

function sortedUnique(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR'));
}

function createPetitionForm(petition = null, overrides = {}) {
  return {
    clientId: petition?.clientId || '',
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
  if (!form.adversary.trim()) nextErrors.adversary = 'Informe o adverso.';
  if (!form.responsible.trim()) nextErrors.responsible = 'Informe o responsável pela ação.';
  if (!form.area.trim()) nextErrors.area = 'Informe a área jurídica.';
  if (form.driveLink.trim() && !/^https?:\/\//i.test(form.driveLink.trim())) {
    nextErrors.driveLink = 'Informe um link iniciado por http:// ou https://.';
  }

  return nextErrors;
}

function PetitionCard({
  clients,
  isDragging,
  isMoving,
  onDragEnd,
  onDragStart,
  onEdit,
  petition,
}) {
  const client = clients.find((item) => item.id === petition.clientId) || null;
  const clientName = client?.name || petition.clientName || 'Cliente';
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
        <div className="petition-card-meta">
          <span>{petition.responsible || 'Sem responsável'}</span>
          <span>{petition.area || 'Sem área'}</span>
        </div>
      </div>

      {petition.pendingReason && petitionColumnKey(petition) === 'pendente' ? (
        <p className="petition-card-reason">{petition.pendingReason}</p>
      ) : null}

      <div className="petition-card-footer">
        <StatusBadge tone={getStatusTone(statusLabel)}>{statusLabel}</StatusBadge>
        <div className="petition-card-actions">
          {petition.driveLink ? (
            <a href={petition.driveLink} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              Drive
            </a>
          ) : null}
          <button type="button" onClick={() => onEdit(petition)}>
            Editar
          </button>
        </div>
      </div>
    </article>
  );
}

export function PetitionsPage() {
  const { confirm, confirmPopup } = useConfirmPopup();
  const {
    clients,
    deletePetition,
    isPetitionsLoading,
    petitions,
    savePetition,
    users,
  } = useAppState();
  const [editingPetitionId, setEditingPetitionId] = useState('');
  const [form, setForm] = useState(() => createPetitionForm());
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [draggingPetitionId, setDraggingPetitionId] = useState('');
  const [dragOverColumnKey, setDragOverColumnKey] = useState('');
  const [movingPetitionId, setMovingPetitionId] = useState('');

  const clientOptions = [...clients].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  const responsibleOptions = sortedUnique([
    ...users.map((user) => user.name),
    ...petitions.map((petition) => petition.responsible),
  ]);
  const areaOptions = sortedUnique([
    ...PROCESS_AREA_OPTIONS,
    ...petitions.map((petition) => petition.area),
  ]);
  const allPetitions = [...petitions].sort((left, right) => {
    const leftClient = left.clientName || clients.find((client) => client.id === left.clientId)?.name || '';
    const rightClient = right.clientName || clients.find((client) => client.id === right.clientId)?.name || '';
    return leftClient.localeCompare(rightClient, 'pt-BR') || left.adversary.localeCompare(right.adversary, 'pt-BR');
  });

  const filteredPetitions = allPetitions.filter((petition) => {
    const client = clients.find((item) => item.id === petition.clientId) || null;
    const haystack = buildSearchText([
      petition.adversary,
      petition.responsible,
      petition.area,
      petition.pendingReason,
      petition.status,
      petition.clientName,
      client?.name,
    ]);

    if (search && !haystack.includes(normalizeText(search))) {
      return false;
    }

    if (responsibleFilter && normalizeText(petition.responsible) !== normalizeText(responsibleFilter)) {
      return false;
    }

    if (areaFilter && normalizeText(petition.area) !== normalizeText(areaFilter)) {
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

  function resetForm() {
    setEditingPetitionId('');
    setForm(createPetitionForm());
    setErrors({});
  }

  function beginEdit(petition, overrides = {}) {
    setEditingPetitionId(petition.id);
    setForm(createPetitionForm(petition, overrides));
    setErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validatePetitionForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedPetition = await savePetition({
      id: editingPetitionId || undefined,
      clientId: form.clientId,
      adversary: form.adversary.trim(),
      responsible: form.responsible.trim(),
      driveLink: form.driveLink.trim(),
      pendingReason: form.pendingReason.trim(),
      area: form.area.trim(),
      status: form.status || PETITION_DEFAULT_STATUS,
    });

    if (savedPetition) {
      resetForm();
    }
  }

  async function handleDelete() {
    if (!editingPetitionId) {
      return;
    }

    const canDelete = await confirm({
      title: 'Excluir peça',
      message: 'Esta petição ou contestação será removida permanentemente.',
      confirmLabel: 'Excluir peça',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deletePetition(editingPetitionId);
    if (wasDeleted) {
      resetForm();
    }
  }

  async function movePetition(petition, nextColumnKey) {
    const nextColumn = PETITION_STATUS_COLUMNS.find((column) => column.key === nextColumnKey);

    if (!nextColumn || petitionColumnKey(petition) === nextColumnKey) {
      return;
    }

    setMovingPetitionId(petition.id);

    try {
      await savePetition({
        ...petition,
        status: nextColumn.label,
      });
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
      <PageChrome label="Petições e contestações" />
      {confirmPopup}

      <div className="petitions-page">
        <section className="surface petitions-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Petições e contestações</h1>
              <p className="section-note">Kanban separado para peças, protocolo e acompanhamento.</p>
            </div>
            <span className="badge gold">
              {formatCount(filteredPetitions.length, 'peça', 'peças')}
            </span>
          </div>

          <div className="petitions-toolbar">
            <label className="toolbar-search" aria-label="Buscar petições e contestações">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                placeholder="Buscar por cliente, adverso, responsável ou área"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              className="filter-select"
              aria-label="Filtrar por responsável"
              value={responsibleFilter}
              onChange={(event) => setResponsibleFilter(event.target.value)}
            >
              <option value="">Responsável</option>
              {responsibleOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select
              className="filter-select"
              aria-label="Filtrar por área jurídica"
              value={areaFilter}
              onChange={(event) => setAreaFilter(event.target.value)}
            >
              <option value="">Área jurídica</option>
              {areaOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </section>

        {clientOptions.length ? (
          <div className="petitions-workspace">
            <section className="surface petition-form-panel">
              <div className="section-head">
                <div>
                  <h2 className="section-title">{editingPetitionId ? 'Editar peça' : 'Nova peça'}</h2>
                  <p className="section-note">Cadastro de petição ou contestação.</p>
                </div>
              </div>

              <form className="petition-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                  <Field id="petition-client" label="Cliente" className="span-2" error={errors.clientId}>
                    <select
                      id="petition-client"
                      value={form.clientId}
                      onChange={(event) => setForm((currentForm) => ({ ...currentForm, clientId: event.target.value }))}
                    >
                      <option value="">Selecione o cliente</option>
                      {clientOptions.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
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

                  <Field id="petition-area" label="Área jurídica" error={errors.area}>
                    <select
                      id="petition-area"
                      value={form.area}
                      onChange={(event) => setForm((currentForm) => ({ ...currentForm, area: event.target.value }))}
                    >
                      <option value="">Selecione a área</option>
                      {areaOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
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

                  <Field
                    id="petition-pending-reason"
                    label="Pendente: qual motivo?"
                    className="span-2"
                    error={errors.pendingReason}
                  >
                    <textarea
                      id="petition-pending-reason"
                      rows="4"
                      value={form.pendingReason}
                      onChange={(event) => setForm((currentForm) => ({ ...currentForm, pendingReason: event.target.value }))}
                    />
                  </Field>
                </div>

                <div className="form-actions">
                  <button className="btn" type="submit">
                    {editingPetitionId ? 'Atualizar peça' : 'Salvar peça'}
                  </button>
                  {editingPetitionId ? (
                    <button className="btn btn-danger" type="button" onClick={handleDelete}>
                      Excluir
                    </button>
                  ) : null}
                  <button className="btn btn-secondary" type="button" onClick={resetForm}>
                    Limpar
                  </button>
                </div>
              </form>
            </section>

            <section className={`petitions-board${draggingPetitionId ? ' is-dragging' : ''}`} aria-label="Kanban de petições e contestações">
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
                          isDragging={draggingPetitionId === petition.id}
                          isMoving={movingPetitionId === petition.id}
                          onDragEnd={handleDragEnd}
                          onDragStart={handleDragStart}
                          onEdit={beginEdit}
                          petition={petition}
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
          </div>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum cliente cadastrado."
              copy="Cadastre um cliente antes de criar uma petição ou contestação."
              actions={<Link className="btn" to="/clientes/novo">Novo cliente</Link>}
            />
          </section>
        )}

        {editingPetitionId ? (
          <section className="surface petition-editing-summary">
            <span>Editando</span>
            <strong>
              {clients.find((client) => client.id === form.clientId)?.name || 'Cliente'} x {form.adversary || 'adverso'}
            </strong>
            <small>Última atualização: {formatDate(petitions.find((petition) => petition.id === editingPetitionId)?.updatedAt)}</small>
          </section>
        ) : null}
      </div>
    </>
  );
}
