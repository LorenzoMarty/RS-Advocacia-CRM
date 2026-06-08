import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  INTERACTION_TYPE_OPTIONS,
  PROSPECT_ORIGIN_OPTIONS,
  PROSPECT_PRIORITY_OPTIONS,
  PROSPECT_STATUS_COLUMNS,
} from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { buildSearchText, formatCount, formatDate, getStatusTone, normalizeText } from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

const STATUS_LABELS = PROSPECT_STATUS_COLUMNS.map((column) => column.label);

function priorityTone(priority) {
  const normalized = normalizeText(priority);
  if (normalized.includes('alta')) return 'danger';
  if (normalized.includes('baixa')) return 'success';
  return 'warn';
}

function todayIso() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

// Auditoria contextual: prazos ativos / críticos do responsável (por nome).
function deadlineAuditFor(responsibleName, deadlines) {
  if (!responsibleName) {
    return { active: 0, critical: 0 };
  }
  const target = normalizeText(responsibleName);
  const today = todayIso();
  let active = 0;
  let critical = 0;
  deadlines.forEach((deadline) => {
    if (normalizeText(deadline.responsible) !== target || deadline.completed) {
      return;
    }
    active += 1;
    if (deadline.date && deadline.date < today) {
      critical += 1;
    }
  });
  return { active, critical };
}

function interactionLabel(type) {
  return INTERACTION_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

function ProspectCard({ prospect, deadlines, onDragStart, onDragEnd, isDragging }) {
  const audit = deadlineAuditFor(prospect.responsibleName, deadlines);

  return (
    <article
      className={`prospect-card${isDragging ? ' is-dragging' : ''}${audit.critical ? ' is-critical' : ''}`}
      draggable
      onDragStart={(event) => onDragStart(event, prospect.id)}
      onDragEnd={onDragEnd}
    >
      <div className="prospect-card-head">
        <Link to={`/prospeccao/${prospect.id}`} className="prospect-card-name">
          {prospect.name}
        </Link>
        <StatusBadge tone={priorityTone(prospect.priority)}>{prospect.priority}</StatusBadge>
      </div>
      <p className="prospect-card-demand">{prospect.demandType || 'Demanda não informada'}</p>
      <dl className="prospect-card-meta">
        <div>
          <dt>Responsável</dt>
          <dd>{prospect.responsibleName || '-'}</dd>
        </div>
        <div>
          <dt>Próximo passo</dt>
          <dd>{prospect.nextAction || '-'}</dd>
        </div>
        <div>
          <dt>Última interação</dt>
          <dd>{prospect.lastContact ? formatDate(prospect.lastContact) : '-'}</dd>
        </div>
      </dl>
      {audit.critical ? (
        <p className="prospect-card-alert">
          {audit.active} prazo(s) ativo(s) · {audit.critical} crítico(s)
        </p>
      ) : null}
    </article>
  );
}

export function ProspectKanbanPage() {
  const { prospects, deadlines, saveProspect, addFlash } = useAppState();
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [dragOverKey, setDragOverKey] = useState('');

  const responsibleOptions = useMemo(
    () => [...new Set(prospects.map((item) => item.responsibleName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [prospects],
  );

  const filtered = useMemo(
    () =>
      prospects.filter((prospect) => {
        if (responsibleFilter && prospect.responsibleName !== responsibleFilter) {
          return false;
        }
        if (!search) return true;
        const haystack = buildSearchText([
          prospect.name,
          prospect.email,
          prospect.phone,
          prospect.demandType,
          prospect.responsibleName,
        ]);
        return haystack.includes(normalizeText(search));
      }),
    [prospects, responsibleFilter, search],
  );

  const metrics = useMemo(() => {
    const total = prospects.length;
    const novosMes = prospects.filter((item) => isThisMonth(item.createdAt)).length;
    const convertidos = prospects.filter((item) => item.status === 'Convertido').length;
    const perdidos = prospects.filter((item) => item.status === 'Perdido').length;
    const taxa = total ? Math.round((convertidos / total) * 100) : 0;
    return { total, novosMes, convertidos, perdidos, taxa };
  }, [prospects]);

  const byColumn = PROSPECT_STATUS_COLUMNS.reduce((acc, column) => {
    acc[column.label] = filtered.filter((item) => item.status === column.label);
    return acc;
  }, {});

  function handleDragStart(event, id) {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }

  function handleDragEnd() {
    setDraggingId('');
    setDragOverKey('');
  }

  function handleDragOver(event, key) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) setDragOverKey(key);
  }

  async function handleDrop(event, label) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId('');
    setDragOverKey('');
    const prospect = prospects.find((item) => item.id === id);
    if (!prospect || prospect.status === label) return;
    const saved = await saveProspect({ ...prospect, status: label });
    if (saved) {
      addFlash(`Prospect movido para ${label}.`, 'info');
    }
  }

  return (
    <>
      <PageChrome label="Prospecção" />
      <div className="prospeccao-page">
        <section className="surface prospeccao-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Prospecção</h1>
              <p className="section-note">Funil de captação de clientes</p>
            </div>
            <Link className="btn" to="/prospeccao/novo">Novo prospect</Link>
          </div>

          <div className="prospeccao-metrics">
            <article className="metric"><span>Total</span><strong>{metrics.total}</strong></article>
            <article className="metric"><span>Novos no mês</span><strong>{metrics.novosMes}</strong></article>
            <article className="metric"><span>Convertidos</span><strong>{metrics.convertidos}</strong></article>
            <article className="metric"><span>Perdidos</span><strong>{metrics.perdidos}</strong></article>
            <article className="metric"><span>Taxa conversão</span><strong>{metrics.taxa}%</strong></article>
          </div>

          <div className="prospeccao-toolbar">
            <PageSearch
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, e-mail ou demanda"
            />
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
          </div>
        </section>

        {prospects.length ? (
          <section className={`prospeccao-board${draggingId ? ' is-dragging' : ''}`} aria-label="Funil de prospecção">
            {PROSPECT_STATUS_COLUMNS.map((column) => (
              <section
                className={`prospect-column${dragOverKey === column.label ? ' is-drop-target' : ''}`}
                key={column.key}
                onDragEnter={(event) => handleDragOver(event, column.label)}
                onDragOver={(event) => handleDragOver(event, column.label)}
                onDrop={(event) => handleDrop(event, column.label)}
              >
                <div className="prospect-column-head">
                  <h2>{column.label}</h2>
                  <span className="prospect-column-count">{byColumn[column.label].length}</span>
                </div>
                <div className="prospect-column-list">
                  {byColumn[column.label].length ? (
                    byColumn[column.label].map((prospect) => (
                      <ProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        deadlines={deadlines}
                        isDragging={draggingId === prospect.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  ) : (
                    <div className="prospect-column-empty">Nenhum prospect.</div>
                  )}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum prospect cadastrado."
              copy="Cadastre um contato para iniciar o funil de prospecção."
              actions={<Link className="btn" to="/prospeccao/novo">Novo prospect</Link>}
            />
          </section>
        )}
      </div>
    </>
  );
}

export function ProspectFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.prospectId);
  const { prospects, users, deadlines, saveProspect } = useAppState();
  const prospect = prospects.find((item) => item.id === params.prospectId) || null;

  const [form, setForm] = useState(() => ({
    name: prospect?.name || '',
    phone: prospect?.phone || '',
    email: prospect?.email || '',
    origin: prospect?.origin || '',
    demandType: prospect?.demandType || '',
    caseDescription: prospect?.caseDescription || '',
    responsibleId: prospect?.responsibleId || '',
    status: prospect?.status || 'Novo',
    priority: prospect?.priority || 'Media',
    nextAction: prospect?.nextAction || '',
    notes: prospect?.notes || '',
    lastContact: prospect?.lastContact || '',
  }));
  const [errors, setErrors] = useState({});

  if (isEditing && !prospect) {
    return <NotFoundState title="Prospect não encontrado." />;
  }

  const selectedUser = users.find((user) => user.id === form.responsibleId) || null;
  const audit = deadlineAuditFor(selectedUser?.name, deadlines);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Informe o nome.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const saved = await saveProspect({
      id: prospect?.id,
      ...form,
      name: form.name.trim(),
      responsibleName: selectedUser?.name || prospect?.responsibleName || '',
    });
    if (!saved) return;
    navigate(`/prospeccao/${saved.id || prospect?.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar prospect' : 'Novo prospect'} />
      <div className="prospect-form-page">
        <section className="surface section-card">
          <div className="intro-grid">
            <Link className="intro-link" to="/prospeccao">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para prospecção
            </Link>
            <h1 className="intro-title">{isEditing ? 'Editar prospect' : 'Novo prospect'}</h1>
          </div>

          <form className="prospect-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <Field id="prospect-name" label="Nome" className="span-2" error={errors.name}>
                <input id="prospect-name" value={form.name} onChange={(event) => update('name', event.target.value)} />
              </Field>
              <Field id="prospect-phone" label="Telefone">
                <input id="prospect-phone" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
              </Field>
              <Field id="prospect-email" label="E-mail">
                <input id="prospect-email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
              </Field>
              <Field id="prospect-origin" label="Origem do contato">
                <select id="prospect-origin" value={form.origin} onChange={(event) => update('origin', event.target.value)}>
                  <option value="">Selecione</option>
                  {PROSPECT_ORIGIN_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field id="prospect-demand" label="Tipo de demanda jurídica">
                <input id="prospect-demand" value={form.demandType} onChange={(event) => update('demandType', event.target.value)} />
              </Field>
              <Field id="prospect-responsible" label="Responsável interno">
                <select
                  id="prospect-responsible"
                  value={form.responsibleId}
                  onChange={(event) => update('responsibleId', event.target.value)}
                >
                  <option value="">Selecione o responsável</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </Field>
              {form.responsibleId ? (
                <div className={`prospect-audit span-2${audit.critical ? ' is-critical' : ''}`}>
                  Responsável com <strong>{audit.active}</strong> prazo(s) ativo(s)
                  {audit.critical ? <> · <strong>{audit.critical}</strong> crítico(s)</> : null}
                </div>
              ) : null}
              <Field id="prospect-status" label="Status">
                <select id="prospect-status" value={form.status} onChange={(event) => update('status', event.target.value)}>
                  {STATUS_LABELS.map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field id="prospect-priority" label="Prioridade">
                <select id="prospect-priority" value={form.priority} onChange={(event) => update('priority', event.target.value)}>
                  {PROSPECT_PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field id="prospect-next" label="Próxima ação" className="span-2">
                <input id="prospect-next" value={form.nextAction} onChange={(event) => update('nextAction', event.target.value)} />
              </Field>
              <Field id="prospect-case" label="Descrição do caso" className="span-2">
                <textarea id="prospect-case" rows="4" value={form.caseDescription} onChange={(event) => update('caseDescription', event.target.value)} />
              </Field>
              <Field id="prospect-notes" label="Observações" className="span-2">
                <textarea id="prospect-notes" rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
              </Field>
            </div>

            <div className="form-actions">
              <button className="btn" type="submit">{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to="/prospeccao">Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function ProspectDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const { prospects, deadlines, addInteracao, convertProspect, deleteProspect } = useAppState();
  const prospect = prospects.find((item) => item.id === params.prospectId) || null;

  const [interactionType, setInteractionType] = useState('ligacao');
  const [interactionText, setInteractionText] = useState('');
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ cpf: '', tipo_cliente: 'esporadico' });

  if (!prospect) {
    return <NotFoundState title="Prospect não encontrado." />;
  }

  const audit = deadlineAuditFor(prospect.responsibleName, deadlines);
  const interactions = prospect.interactions || [];
  const isConverted = Boolean(prospect.convertedClientId);

  async function handleAddInteraction(event) {
    event.preventDefault();
    if (!interactionText.trim()) return;
    const saved = await addInteracao(prospect.id, {
      type: interactionType,
      description: interactionText.trim(),
    });
    if (saved) {
      setInteractionText('');
    }
  }

  async function handleConvert(event) {
    event.preventDefault();
    const ok = await confirm({
      title: 'Converter em cliente?',
      message: `${prospect.name} será cadastrado como cliente real.`,
      confirmLabel: 'Converter',
    });
    if (!ok) return;
    const result = await convertProspect(prospect.id, {
      cpf: convertForm.cpf,
      tipo_cliente: convertForm.tipo_cliente,
    });
    if (result?.client) {
      navigate(`/clientes/${result.client.id}`);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Tem certeza?',
      message: `O prospect "${prospect.name}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });
    if (!ok) return;
    const deleted = await deleteProspect(prospect.id);
    if (deleted) {
      navigate('/prospeccao', { replace: true });
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome
        label="Prospect"
        actions={
          <>
            <Link className="btn btn-secondary" to={`/prospeccao/${prospect.id}/editar`}>Editar</Link>
            <button className="btn btn-danger" type="button" onClick={handleDelete}>Excluir</button>
          </>
        }
      />

      <div className="prospect-detail-page">
        <section className="surface section-card">
          <div className="crumbs"><Link to="/prospeccao">Prospecção</Link></div>
          <div className="prospect-detail-head">
            <div>
              <h1 className="intro-title">{prospect.name}</h1>
              <p className="section-note">{prospect.demandType || 'Demanda não informada'}</p>
            </div>
            <StatusBadge tone={getStatusTone(prospect.status)}>{prospect.status}</StatusBadge>
          </div>

          <div className="detail-grid">
            <article className="detail-item"><span>Telefone</span><strong>{prospect.phone || '-'}</strong></article>
            <article className="detail-item"><span>E-mail</span><strong>{prospect.email || '-'}</strong></article>
            <article className="detail-item"><span>Origem</span><strong>{prospect.origin || '-'}</strong></article>
            <article className="detail-item"><span>Responsável</span><strong>{prospect.responsibleName || '-'}</strong></article>
            <article className="detail-item"><span>Prioridade</span><strong>{prospect.priority}</strong></article>
            <article className="detail-item"><span>Próxima ação</span><strong>{prospect.nextAction || '-'}</strong></article>
          </div>

          {audit.active ? (
            <p className={`prospect-audit${audit.critical ? ' is-critical' : ''}`}>
              Responsável com <strong>{audit.active}</strong> prazo(s) ativo(s)
              {audit.critical ? <> · <strong>{audit.critical}</strong> crítico(s)</> : null}
            </p>
          ) : null}

          {prospect.caseDescription ? (
            <div className="prospect-case-box">{prospect.caseDescription}</div>
          ) : null}
        </section>

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Conversão</h2>
              <p className="section-note">Transforme o prospect em cliente real</p>
            </div>
          </div>
          {isConverted ? (
            <p className="prospect-converted">
              Convertido. <Link to={`/clientes/${prospect.convertedClientId}`}>Ver cliente</Link>
            </p>
          ) : showConvert ? (
            <form className="prospect-convert-form" onSubmit={handleConvert}>
              <div className="form-grid">
                <Field id="convert-cpf" label="CPF/CNPJ (opcional)">
                  <input
                    id="convert-cpf"
                    value={convertForm.cpf}
                    onChange={(event) => setConvertForm((c) => ({ ...c, cpf: event.target.value }))}
                  />
                </Field>
                <Field id="convert-type" label="Tipo de cliente">
                  <select
                    id="convert-type"
                    value={convertForm.tipo_cliente}
                    onChange={(event) => setConvertForm((c) => ({ ...c, tipo_cliente: event.target.value }))}
                  >
                    <option value="esporadico">Esporádico</option>
                    <option value="mensalista">Mensalista</option>
                  </select>
                </Field>
              </div>
              <div className="form-actions">
                <button className="btn" type="submit">Confirmar conversão</button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowConvert(false)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <button className="btn" type="button" onClick={() => setShowConvert(true)}>Converter em cliente</button>
          )}
        </section>

        <section className="surface section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Interações</h2>
              <p className="section-note">{formatCount(interactions.length, 'interação', 'interações')}</p>
            </div>
          </div>

          <form className="prospect-interaction-form" onSubmit={handleAddInteraction}>
            <select value={interactionType} onChange={(event) => setInteractionType(event.target.value)}>
              {INTERACTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={interactionText}
              onChange={(event) => setInteractionText(event.target.value)}
              placeholder="Descreva a interação"
            />
            <button className="btn" type="submit">Registrar</button>
          </form>

          {interactions.length ? (
            <ul className="prospect-timeline">
              {interactions.map((interaction) => (
                <li key={interaction.id}>
                  <div className="prospect-timeline-head">
                    <StatusBadge tone="gold">{interactionLabel(interaction.type)}</StatusBadge>
                    <span>{interaction.date ? formatDate(interaction.date) : ''}</span>
                  </div>
                  <p>{interaction.description}</p>
                  {interaction.userName ? <small>{interaction.userName}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="section-note">Nenhuma interação registrada.</p>
          )}
        </section>
      </div>
    </>
  );
}
