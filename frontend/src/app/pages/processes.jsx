import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { motion as Motion, staggerContainer, staggerItem } from '../motion';
import { PROCESS_AREA_OPTIONS, PROCESS_STATUS_OPTIONS } from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { buildSearchText, formatCount, getStatusTone, normalizeText } from '../utils';
import { Select } from '../components/select';
import { ComboField, EmptyState, Field, NotFoundState } from './common';

function validateProcessForm(form) {
  const nextErrors = {};

  if (!form.number.trim()) nextErrors.number = 'Informe o número do processo.';
  if (!form.clientId) nextErrors.clientId = 'Selecione um cliente.';
  if (!form.owner.trim()) nextErrors.owner = 'Informe o responsável.';
  if (!form.status.trim()) nextErrors.status = 'Informe o status.';

  return nextErrors;
}

export function ProcessesListPage() {
  const { clients, deleteProcess, processes } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');

  const filteredProcesses = useMemo(
    () =>
      processes.filter((process) =>
        buildSearchText([
          process.number,
          clients.find((client) => client.id === process.clientId)?.name,
          process.area,
          process.court,
          process.owner,
          process.status,
        ]).includes(normalizeText(search)),
      ),
    [clients, processes, search],
  );

  async function handleDeleteProcess(process) {
    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O processo "${process.number}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    await deleteProcess(process.id);
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Processos" />

      <div className="process-page">
        <section className="surface process-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Processos</h1>
              <p className="section-note">Gerencie seus processos jurídicos</p>
            </div>
            <span className="badge gold" data-list-count>{formatCount(filteredProcesses.length)}</span>
          </div>

          <div className="list-intro-toolbar">
            <PageSearch
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              label="Buscar processos"
            />
            <Link className="btn list-intro-action" to="/processos/novo">Novo</Link>
          </div>
        </section>

        <section className="surface process-panel">
          {filteredProcesses.length ? (
            <>
              <div className="process-head" aria-hidden="true">
                <span>Processo</span>
                <span>Área</span>
                <span>Responsável</span>
                <span>Status</span>
                <span>Ações</span>
              </div>

              <Motion.div
                className="process-list"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filteredProcesses.map((process) => (
                  <Motion.article key={process.id} className="process-row" variants={staggerItem}>
                    <div className="process-main">
                      <h2 className="process-number">{process.number}</h2>
                      <span className="process-client">{clients.find((client) => client.id === process.clientId)?.name}</span>
                    </div>

                    <div className="process-meta">
                      <div className="meta-stack">
                        {process.area ? <span className="meta-chip">{process.area}</span> : null}
                        {process.court ? <span className="meta-chip">{process.court}</span> : null}
                      </div>
                    </div>

                    <div className="process-owner">
                      <div className="owner-stack">
                        <span className="owner-chip">{process.owner}</span>
                      </div>
                    </div>

                    <div className="process-status">
                      <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
                    </div>

                    <div className="process-actions">
                      <Link className="action-link" to={`/processos/${process.id}`}>Ver</Link>
                      <Link className="action-link" to={`/processos/${process.id}/editar`}>Editar</Link>
                      <button className="action-link action-link-danger" type="button" onClick={() => handleDeleteProcess(process)}>Excluir</button>
                    </div>
                  </Motion.article>
                ))}
              </Motion.div>
            </>
          ) : (
            <EmptyState
              title="Nenhum processo encontrado."
              copy="Ajuste a busca para localizar o registro desejado."
              actions={<Link className="btn" to="/processos/novo">Novo</Link>}
            />
          )}
        </section>
      </div>
    </>
  );
}

export function ProcessFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.processId);
  const { clients, processes, saveProcess } = useAppState();
  const process = processes.find((item) => item.id === params.processId) || null;
  const initialClientId = searchParams.get('cliente') || '';
  const [form, setForm] = useState(() => ({
    id: process?.id || '',
    number: process?.number || '',
    clientId: process?.clientId || initialClientId,
    owner: process?.owner || '',
    status: process?.status || 'Ativo',
    area: process?.area || '',
    court: process?.court || '',
    description: process?.description || '',
  }));
  const [errors, setErrors] = useState({});

  const statusOptions = [...new Set([...PROCESS_STATUS_OPTIONS, ...processes.map((item) => item.status).filter(Boolean)])];
  const areaOptions = [...new Set([...PROCESS_AREA_OPTIONS, ...processes.map((item) => item.area).filter(Boolean)])];
  const courtOptions = [...new Set(processes.map((item) => item.court).filter(Boolean))];

  if (isEditing && !process) {
    return <NotFoundState title="Processo não encontrado." />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateProcessForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedProcess = await saveProcess({
      id: form.id || undefined,
      number: form.number.trim(),
      clientId: form.clientId,
      owner: form.owner.trim(),
      status: form.status.trim(),
      area: form.area.trim(),
      court: form.court.trim(),
      description: form.description.trim(),
    });

    if (!savedProcess) {
      return;
    }

    navigate(`/processos/${savedProcess.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar processo' : 'Novo processo'} />

      <div className="create-page">
        <section className="surface create-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={isEditing ? `/processos/${process.id}` : '/processos'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {isEditing ? 'Voltar para o processo' : 'Voltar para processos'}
            </Link>

            <div className="section-head">
              <div>
                <h1 className="intro-title">{isEditing ? 'Editar processo' : 'Novo processo'}</h1>
                <p className="intro-note">
                  {isEditing ? 'Ajuste os dados principais do processo sem trocar de fluxo.' : 'Registro claro e direto.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface form-panel">
          <form className="process-form" onSubmit={handleSubmit}>
            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Dados principais</h2>
              </div>

              <div className="form-grid">
                <Field id="process-number" label="Número" error={errors.number}>
                  <input
                    id="process-number"
                    value={form.number}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, number: event.target.value }))}
                  />
                </Field>

                <Field id="process-client" label="Cliente" error={errors.clientId}>
                  <Select
                    id="process-client"
                    value={form.clientId}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, clientId: event.target.value }))}
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field id="process-owner" label="Responsável" error={errors.owner}>
                  <input
                    id="process-owner"
                    value={form.owner}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, owner: event.target.value }))}
                  />
                </Field>

                <Field id="process-status" label="Status" error={errors.status}>
                  <ComboField
                    id="process-status"
                    value={form.status}
                    options={statusOptions}
                    selectPlaceholder="Selecione o status"
                    customLabel="+ Digitar novo status..."
                    customPlaceholder="Ex: Suspenso..."
                    onChange={(value) => setForm((currentForm) => ({ ...currentForm, status: value }))}
                  />
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Classificação</h2>
              </div>

              <div className="form-grid">
                <Field id="process-area" label="Área jurídica" error={errors.area}>
                  <ComboField
                    id="process-area"
                    value={form.area}
                    options={areaOptions}
                    selectPlaceholder="Selecione a área jurídica"
                    customLabel="+ Digitar nova área..."
                    customPlaceholder="Ex: Penal, Previdenciário..."
                    onChange={(value) => setForm((currentForm) => ({ ...currentForm, area: value }))}
                  />
                </Field>

                <Field id="process-court" label="Vara" error={errors.court}>
                  <ComboField
                    id="process-court"
                    value={form.court}
                    options={courtOptions}
                    selectPlaceholder="Selecione a vara"
                    customLabel="+ Digitar nova vara..."
                    customPlaceholder="Ex: 2ª Vara Criminal..."
                    onChange={(value) => setForm((currentForm) => ({ ...currentForm, court: value }))}
                  />
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Observações</h2>
              </div>

              <div className="form-grid">
                <Field id="process-description" label="Descrição" className="span-2" error={errors.description}>
                  <textarea
                    id="process-description"
                    rows="5"
                    value={form.description}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))}
                  />
                </Field>
              </div>
            </section>

            <div className="form-actions">
              <button className="btn" type="submit">{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to={isEditing ? `/processos/${process.id}` : '/processos'}>Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function ProcessDetailPage() {
  const params = useParams();
  const { clients, deadlines, events, petitions, processes } = useAppState();
  const process = processes.find((item) => item.id === params.processId) || null;

  if (!process) {
    return <NotFoundState title="Processo não encontrado." />;
  }

  const client = clients.find((item) => item.id === process.clientId) || null;
  const relatedEvents = events.filter((event) => event.processId === process.id);
  const relatedDeadlines = deadlines.filter((deadline) => deadline.processId === process.id);
  const relatedPetitions = petitions.filter((petition) => petition.processId === process.id);

  return (
    <>
      <PageChrome label="Processo" />

      <div className="process-page">
        <section className="surface process-hero">
          <div className="crumbs">
            <Link to="/processos">Processos</Link>
          </div>

          <div className="process-hero-grid">
            <div className="process-identity">
              <div className="identity-row">
                <div className="process-mark" aria-hidden="true">PJ</div>
                <div>
                  <h1 className="process-number">{process.number}</h1>
                  <p className="process-subtitle">{client?.name}</p>
                </div>
              </div>

              <aside className="hero-summary">
                <article className="summary-card">
                  <span>Status</span>
                  <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
                </article>
                <article className="summary-card">
                  <span>Compromissos</span>
                  <strong>{relatedEvents.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Prazos</span>
                  <strong>{relatedDeadlines.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Peças</span>
                  <strong>{relatedPetitions.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Responsável</span>
                  <strong>{process.owner || '-'}</strong>
                </article>
              </aside>
            </div>
          </div>
        </section>

        <div className="process-layout">
          <div className="stack">
            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Dados</h2>
                  <p className="section-note">Essenciais</p>
                </div>
              </div>

              <div className="detail-grid">
                <article className="detail-item">
                  <span>Número</span>
                  <strong>{process.number}</strong>
                </article>
                <article className="detail-item">
                  <span>Cliente</span>
                  {client ? <Link to={`/clientes/${client.id}`}>{client.name}</Link> : <strong>-</strong>}
                </article>
                <article className="detail-item">
                  <span>Área</span>
                  <strong>{process.area || '-'}</strong>
                </article>
                <article className="detail-item">
                  <span>Vara</span>
                  <strong>{process.court || '-'}</strong>
                </article>
                <article className="detail-item">
                  <span>Responsável</span>
                  <strong>{process.owner || '-'}</strong>
                </article>
                <article className="detail-item">
                  <span>Status</span>
                  <div className="detail-badge-wrap">
                    <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
                  </div>
                </article>
              </div>
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Compromissos</h2>
                  <p className="section-note">{formatCount(relatedEvents.length)}</p>
                </div>
              </div>

              <div className="list">
                {relatedEvents.length ? relatedEvents.map((event) => (
                  <article key={event.id} className="event-item">
                    <div className="list-top">
                      <div>
                        <h3 className="list-title">{event.title}</h3>
                        <p className="list-subtitle">{event.start.replace('T', ' ').slice(0, 16)}</p>
                      </div>
                      <StatusBadge tone={getStatusTone(event.status, event.completed)}>{event.status}</StatusBadge>
                    </div>

                    <div className="list-meta">
                      <span className="meta-chip">{event.type || 'Compromisso'}</span>
                      {event.responsibleName ? <span className="meta-chip">{event.responsibleName}</span> : null}
                      {event.location ? <span className="meta-chip">{event.location}</span> : null}
                    </div>
                  </article>
                )) : (
                  <EmptyState
                    title="Sem compromissos."
                    copy="Adicione um novo compromisso para este processo."
                    actions={<Link className="btn" to={`/agenda/novo?processo=${process.id}&cliente=${client?.id || ''}`}>Novo compromisso</Link>}
                  />
                )}
              </div>
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Prazos</h2>
                  <p className="section-note">{formatCount(relatedDeadlines.length, 'prazo', 'prazos')}</p>
                </div>
              </div>

              <div className="list">
                {relatedDeadlines.length ? relatedDeadlines.map((deadline) => (
                  <article key={deadline.id} className="event-item">
                    <div className="list-top">
                      <div>
                        <h3 className="list-title">{deadline.title}</h3>
                        <p className="list-subtitle">{new Date(`${deadline.date}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <StatusBadge tone={getStatusTone(deadline.status, deadline.completed)}>{deadline.status}</StatusBadge>
                    </div>

                    <div className="list-meta">
                      {deadline.responsible ? <span className="meta-chip">{deadline.responsible}</span> : null}
                    </div>
                  </article>
                )) : (
                  <EmptyState
                    title="Sem prazos."
                    copy="Cadastre prazos na area de prazos, separados dos compromissos."
                    actions={<Link className="btn" to="/prazos/novo">Novo prazo</Link>}
                  />
                )}
              </div>
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Petições ou contestações</h2>
                  <p className="section-note">{formatCount(relatedPetitions.length, 'peça', 'peças')}</p>
                </div>
              </div>

              <div className="list">
                {relatedPetitions.length ? relatedPetitions.map((petition) => (
                  <article key={petition.id} className="event-item">
                    <div className="list-top">
                      <div>
                        <h3 className="list-title">{petition.adversary || 'Adverso não informado'}</h3>
                        <p className="list-subtitle">{petition.type || 'Petição'}</p>
                      </div>
                      <StatusBadge tone={getStatusTone(petition.status)}>{petition.status}</StatusBadge>
                    </div>

                    <div className="list-meta">
                      {petition.responsible ? <span className="meta-chip">{petition.responsible}</span> : null}
                      {petition.area ? <span className="meta-chip">{petition.area}</span> : null}
                      {petition.driveLink ? (
                        <a className="meta-chip" href={petition.driveLink} target="_blank" rel="noreferrer">
                          Drive
                        </a>
                      ) : null}
                    </div>
                  </article>
                )) : (
                  <EmptyState
                    title="Sem peças."
                    copy="Vincule petições ou contestações a este processo."
                    actions={<Link className="btn" to={`/peticoes-contestacoes/novo?processo=${process.id}&cliente=${client?.id || ''}`}>Nova peça</Link>}
                  />
                )}
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Cliente</h2>
                  <p className="section-note">Vinculado</p>
                </div>
              </div>

              {client ? (
                <article className="client-card">
                  <div className="client-card-head">
                    <div className="client-mark" aria-hidden="true">{client.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <h3 className="client-name">{client.name}</h3>
                      <p className="client-copy">CPF/CNPJ {client.document}</p>
                    </div>
                  </div>

                  <div className="client-meta">
                    <a className="meta-chip" href={`mailto:${client.email}`}>{client.email}</a>
                    <a className="meta-chip" href={`tel:${client.phone}`}>{client.phone}</a>
                  </div>

                  <div className="empty-actions">
                    <Link className="btn btn-secondary" to={`/clientes/${client.id}`}>Ver cliente</Link>
                  </div>
                </article>
              ) : (
                <div className="note-box">Nenhum cliente vinculado.</div>
              )}
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Observações</h2>
                  <p className="section-note">Internas</p>
                </div>
              </div>

              {process.description ? (
                <div className="note-box">{process.description}</div>
              ) : (
                <div className="empty">
                  <strong>Sem observações.</strong>
                  <p>Nenhuma nota registrada.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
