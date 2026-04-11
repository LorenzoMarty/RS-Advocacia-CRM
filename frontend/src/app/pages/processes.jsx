import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { buildSearchText, formatCount, getStatusTone, normalizeText } from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

function validateProcessForm(form) {
  const nextErrors = {};

  if (!form.number.trim()) nextErrors.number = 'Informe o número do processo.';
  if (!form.clientId) nextErrors.clientId = 'Selecione um cliente.';
  if (!form.owner.trim()) nextErrors.owner = 'Informe o responsável.';
  if (!form.status.trim()) nextErrors.status = 'Informe o status.';

  return nextErrors;
}

export function ProcessesListPage() {
  const { clients, processes } = useAppState();
  const [search, setSearch] = useState('');

  const filteredProcesses = processes.filter((process) =>
    buildSearchText([
      process.number,
      clients.find((client) => client.id === process.clientId)?.name,
      process.area,
      process.court,
      process.owner,
      process.status,
    ]).includes(normalizeText(search)),
  );

  return (
    <>
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

              <div className="process-list">
                {filteredProcesses.map((process) => (
                  <article key={process.id} className="process-row">
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
                      <Link className="action-link action-link-danger" to={`/processos/${process.id}/excluir`}>Excluir</Link>
                    </div>
                  </article>
                ))}
              </div>
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
                  <select
                    id="process-client"
                    value={form.clientId}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, clientId: event.target.value }))}
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </Field>

                <Field id="process-owner" label="Responsável" error={errors.owner}>
                  <input
                    id="process-owner"
                    value={form.owner}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, owner: event.target.value }))}
                  />
                </Field>

                <Field id="process-status" label="Status" error={errors.status}>
                  <input
                    id="process-status"
                    value={form.status}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value }))}
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
                  <input
                    id="process-area"
                    value={form.area}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, area: event.target.value }))}
                  />
                </Field>

                <Field id="process-court" label="Vara" error={errors.court}>
                  <input
                    id="process-court"
                    value={form.court}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, court: event.target.value }))}
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
  const { clients, events, processes } = useAppState();
  const process = processes.find((item) => item.id === params.processId) || null;

  if (!process) {
    return <NotFoundState title="Processo não encontrado." />;
  }

  const client = clients.find((item) => item.id === process.clientId) || null;
  const relatedEvents = events.filter((event) => event.processId === process.id);

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
                  <h2 className="section-title">Agenda</h2>
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
                      {event.responsible ? <span className="meta-chip">{event.responsible}</span> : null}
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

export function ProcessDeletePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { deleteProcess, processes } = useAppState();
  const process = processes.find((item) => item.id === params.processId) || null;

  if (!process) {
    return <NotFoundState title="Processo não encontrado." />;
  }

  async function handleDelete(event) {
    event.preventDefault();
    const wasDeleted = await deleteProcess(process.id);
    if (!wasDeleted) {
      return;
    }
    navigate('/processos', { replace: true });
  }

  return (
    <>
      <PageChrome label="Excluir" actions={<Link className="btn btn-secondary" to={`/processos/${process.id}`}>Voltar</Link>} />

      <div className="confirm-page">
        <section className="surface confirm-intro">
          <div className="section-head">
            <div>
              <h1 className="confirm-title">Excluir processo</h1>
              <p className="confirm-copy">Revise o registro antes de confirmar. A exclusão remove este item do fluxo principal.</p>
            </div>
          </div>
        </section>

        <section className="surface confirm-panel">
          <div className="confirm-box">
            <div className="confirm-alert">
              <strong>Ação irreversível.</strong>
              <p>Depois da confirmação, este registro não poderá ser recuperado pela interface.</p>
            </div>

            <div className="confirm-meta">
              <span>Registro selecionado</span>
              <strong>{process.number}</strong>
              <p>{process.area || 'Processo jurídico'}</p>
            </div>

            <form onSubmit={handleDelete}>
              <div className="confirm-actions">
                <button className="btn btn-danger" type="submit">Confirmar exclusão</button>
                <Link className="btn btn-secondary" to={`/processos/${process.id}`}>Cancelar</Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
