import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { useAppState } from '../store';
import {
  buildSearchText,
  documentLabel,
  formatCount,
  formatDate,
  formatTime,
  formatDocument,
  getClientTypeLabel,
  getStatusTone,
  normalizeText,
  stripDocument,
} from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

function validateClientForm(form) {
  const nextErrors = {};

  if (!form.name.trim()) nextErrors.name = 'Informe o nome.';
  if (!form.email.trim()) nextErrors.email = 'Informe o e-mail.';
  if (!form.phone.trim()) nextErrors.phone = 'Informe o telefone.';
  if (!stripDocument(form.document)) nextErrors.document = 'Informe o CPF ou CNPJ.';

  return nextErrors;
}

export function ClientsListPage() {
  const { clients, processes } = useAppState();
  const [search, setSearch] = useState('');
  const [clientType, setClientType] = useState('todos');

  const filteredClients = clients.filter((client) => {
    const matchesSearch = !search || buildSearchText([
      client.name,
      client.email,
      client.phone,
      client.document,
      getClientTypeLabel(client.clientType),
    ]).includes(normalizeText(search));
    const matchesType = clientType === 'todos' || client.clientType === clientType;
    return matchesSearch && matchesType;
  });

  return (
    <>
      <PageChrome label="Clientes" />

      <div className="clients-page">
        <section className="surface clients-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Clientes</h1>
              <p className="section-note">Gerencie seus clientes</p>
            </div>
            <span className="badge gold" data-list-count>{formatCount(filteredClients.length)}</span>
          </div>

          <div className="list-intro-toolbar clients-intro-toolbar">
            <div className="clients-filters">
              <PageSearch
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                label="Buscar clientes"
              />

              <div className="clients-type-filter">
                <label className="sr-only" htmlFor="clients-type-filter">Tipo do cliente</label>
                <select
                  id="clients-type-filter"
                  value={clientType}
                  onChange={(event) => setClientType(event.target.value)}
                  aria-label="Filtrar por tipo do cliente"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="esporadico">Esporádicos</option>
                  <option value="mensalista">Mensalistas</option>
                </select>
              </div>
            </div>

            <Link className="btn list-intro-action" to="/clientes/novo">Novo</Link>
          </div>
        </section>

        <section className="surface clients-panel">
          {filteredClients.length ? (
            <>
              <div className="list-head" aria-hidden="true">
                <span>Cliente</span>
                <span>Contato</span>
                <span>Processos</span>
                <span>Ações</span>
              </div>

              <div className="clients-list">
                {filteredClients.map((client) => {
                  const processCount = processes.filter((process) => process.clientId === client.id).length;
                  return (
                    <article key={client.id} className="client-row">
                      <div className="client-avatar" aria-hidden="true">{client.name.slice(0, 1).toUpperCase()}</div>

                      <div className="client-main">
                        <h2 className="client-name">{client.name}</h2>
                        <span className={`client-tier client-tier-${client.clientType}`}>{getClientTypeLabel(client.clientType)}</span>
                        <span className="client-doc">{documentLabel(client.document)} {formatDocument(client.document)}</span>
                      </div>

                      <div className="client-contact">
                        <div className="contact-stack">
                          <a className="contact-link" href={`mailto:${client.email}`}>{client.email}</a>
                          <a className="contact-link" href={`tel:${client.phone}`}>{client.phone}</a>
                        </div>
                      </div>

                      <div className="client-volume">
                        <strong className="volume-number">{processCount}</strong>
                        <span className="volume-label">processo{processCount === 1 ? '' : 's'}</span>
                      </div>

                      <div className="client-actions">
                        <Link className="action-link" to={`/clientes/${client.id}`}>Ver</Link>
                        <Link className="action-link" to={`/clientes/${client.id}/editar`}>Editar</Link>
                        <Link className="action-link action-link-danger" to={`/clientes/${client.id}/excluir`}>Excluir</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              title="Nenhum cliente encontrado."
              copy="Ajuste a busca ou troque o tipo selecionado."
              actions={<Link className="btn" to="/clientes/novo">Novo</Link>}
            />
          )}
        </section>
      </div>
    </>
  );
}

export function ClientFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.clientId);
  const { clients, saveClient } = useAppState();
  const client = clients.find((item) => item.id === params.clientId) || null;

  const [form, setForm] = useState(() => ({
    id: client?.id || '',
    name: client?.name || '',
    document: client ? formatDocument(client.document) : '',
    clientType: client?.clientType || 'esporadico',
    phone: client?.phone || '',
    email: client?.email || '',
    notes: client?.notes || '',
  }));
  const [errors, setErrors] = useState({});

  if (isEditing && !client) {
    return <NotFoundState title="Cliente não encontrado." />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateClientForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedClient = await saveClient({
      id: form.id || undefined,
      name: form.name.trim(),
      document: stripDocument(form.document),
      clientType: form.clientType,
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
    });

    if (!savedClient) {
      return;
    }

    navigate(`/clientes/${savedClient.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar cliente' : 'Novo cliente'} />

      <div className="create-page">
        <section className="surface create-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={isEditing ? `/clientes/${client.id}` : '/clientes'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {isEditing ? 'Voltar para o cliente' : 'Voltar para clientes'}
            </Link>

            <div className="section-head">
              <div>
                <h1 className="intro-title">{isEditing ? 'Editar cliente' : 'Novo cliente'}</h1>
                <p className="intro-note">
                  {isEditing ? 'Atualize os dados do cadastro com o mesmo fluxo da criação.' : 'Cadastro direto e objetivo.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface form-panel">
          <form className="client-form" onSubmit={handleSubmit}>
            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Identificação</h2>
              </div>

              <div className="form-grid">
                <Field id="client-name" label="Nome" error={errors.name}>
                  <input
                    id="client-name"
                    value={form.name}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                  />
                </Field>

                <Field id="client-document" label="CPF / CNPJ" error={errors.document}>
                  <input
                    id="client-document"
                    value={form.document}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, document: formatDocument(event.target.value) }))}
                  />
                </Field>

                <Field id="client-type" label="Tipo de cliente" error={errors.clientType}>
                  <select
                    id="client-type"
                    value={form.clientType}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, clientType: event.target.value }))}
                  >
                    <option value="esporadico">Esporádico</option>
                    <option value="mensalista">Mensalista</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Contato</h2>
              </div>

              <div className="form-grid">
                <Field id="client-phone" label="Telefone" error={errors.phone}>
                  <input
                    id="client-phone"
                    value={form.phone}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, phone: event.target.value }))}
                  />
                </Field>

                <Field id="client-email" label="E-mail" error={errors.email}>
                  <input
                    id="client-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, email: event.target.value }))}
                  />
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Observações</h2>
              </div>

              <div className="form-grid">
                <Field id="client-notes" label="Notas" className="span-2" error={errors.notes}>
                  <textarea
                    id="client-notes"
                    rows="5"
                    value={form.notes}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, notes: event.target.value }))}
                  />
                </Field>
              </div>
            </section>

            <div className="form-actions">
              <button className="btn" type="submit">{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to={isEditing ? `/clientes/${client.id}` : '/clientes'}>Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function ClientDetailPage() {
  const params = useParams();
  const { clients, events, processes } = useAppState();
  const client = clients.find((item) => item.id === params.clientId) || null;

  if (!client) {
    return <NotFoundState title="Cliente não encontrado." />;
  }

  const relatedProcesses = processes.filter((process) => process.clientId === client.id);
  const relatedEvents = events.filter((event) => event.clientId === client.id);

  return (
    <>
      <PageChrome label="Cliente" />

      <div className="client-page">
        <section className="surface client-hero">
          <div className="crumbs">
            <Link to="/clientes">Clientes</Link>
          </div>

          <div className="client-hero-grid">
            <div className="client-identity">
              <div className="identity-row">
                <div className="client-mark" aria-hidden="true">{client.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h1 className="client-name">{client.name}</h1>
                  <p className="client-subtitle">Dados centrais do cliente.</p>
                </div>
              </div>

              <div className="identity-meta">
                <span className={`meta-pill client-tier-pill client-tier-${client.clientType}`}>{getClientTypeLabel(client.clientType)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="client-layout">
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
                  <span>Documento</span>
                  <strong>{formatDocument(client.document)}</strong>
                </article>
                <article className="detail-item">
                  <span>Telefone</span>
                  <a href={`tel:${client.phone}`}>{client.phone}</a>
                </article>
                <article className="detail-item">
                  <span>E-mail</span>
                  <a href={`mailto:${client.email}`}>{client.email}</a>
                </article>
                <article className="detail-item">
                  <span>Tipo</span>
                  <strong>{getClientTypeLabel(client.clientType)}</strong>
                </article>
                <article className="detail-item">
                  <span>Observações</span>
                  <strong>{client.notes ? 'Disponíveis' : '-'}</strong>
                </article>
              </div>
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Processos</h2>
                  <p className="section-note">{formatCount(relatedProcesses.length)}</p>
                </div>
              </div>

              <div className="list">
                {relatedProcesses.length ? relatedProcesses.map((process) => (
                  <article key={process.id} className="process-item">
                    <Link className="process-link" to={`/processos/${process.id}`}>
                      <div className="list-top">
                        <div>
                          <h3 className="list-title">{process.number}</h3>
                          <p className="list-subtitle">{process.area}</p>
                        </div>
                        <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
                      </div>

                      <div className="list-meta">
                        <span className="meta-chip">{process.owner}</span>
                        <span className="meta-chip">{process.court}</span>
                      </div>
                    </Link>
                  </article>
                )) : (
                  <EmptyState
                    title="Sem processos."
                    copy="Crie um novo registro para este cliente."
                    actions={<Link className="btn" to={`/processos/novo?cliente=${client.id}`}>Novo processo</Link>}
                  />
                )}
              </div>
            </section>
          </div>

          <div className="stack">
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
                        <p className="list-subtitle">{formatDate(event.start)} às {formatTime(event.start)}</p>
                      </div>
                      <StatusBadge tone={getStatusTone(event.status, event.completed)}>{event.status}</StatusBadge>
                    </div>

                    <div className="list-meta">
                      <span className="meta-chip">{event.type}</span>
                      {event.processId ? <span className="meta-chip">{processes.find((process) => process.id === event.processId)?.number}</span> : null}
                      {event.responsible ? <span className="meta-chip">{event.responsible}</span> : null}
                    </div>
                  </article>
                )) : (
                  <EmptyState
                    title="Sem compromissos."
                    copy="Agende um novo compromisso para este cliente."
                    actions={<Link className="btn" to={`/agenda/novo?cliente=${client.id}`}>Novo compromisso</Link>}
                  />
                )}
              </div>
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Observações</h2>
                  <p className="section-note">Internas</p>
                </div>
              </div>

              {client.notes ? (
                <div className="note-box">{client.notes}</div>
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

export function ClientDeletePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { clients, deleteClient } = useAppState();
  const client = clients.find((item) => item.id === params.clientId) || null;
  const [isDeleting, setIsDeleting] = useState(false);

  if (!client) {
    return <NotFoundState title="Cliente não encontrado." />;
  }

  async function handleDelete(event) {
    event.preventDefault();
    setIsDeleting(true);
    const wasDeleted = await deleteClient(client.id);
    setIsDeleting(false);
    if (!wasDeleted) {
      return;
    }
    navigate('/clientes', { replace: true });
  }

  return (
    <>
      <PageChrome label="Excluir" actions={<Link className="btn btn-secondary" to={`/clientes/${client.id}`}>Voltar</Link>} />

      <div className="confirm-page">
        <section className="surface confirm-intro">
          <div className="section-head">
            <div>
              <h1 className="confirm-title">Excluir cliente</h1>
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
              <strong>{client.name}</strong>
              <p>{formatDocument(client.document)}</p>
            </div>

            <form onSubmit={handleDelete}>
              <div className="confirm-actions">
                <button className="btn btn-danger" type="submit" disabled={isDeleting}>Confirmar exclusão</button>
                <Link className="btn btn-secondary" to={`/clientes/${client.id}`}>Cancelar</Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
