import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
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

const columnHelper = createColumnHelper();

const clientSchema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  document: z.string().min(1, 'Informe o CPF ou CNPJ.').refine(
    (val) => stripDocument(val).length >= 11,
    'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
  ),
  clientType: z.enum(['esporadico', 'mensalista']),
  phone: z.string().min(1, 'Informe o telefone.'),
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  notes: z.string(),
});

const SORT_ICONS = {
  asc: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  ),
  desc: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
};

export function ClientsListPage() {
  const { clients, deleteClient, processes } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');
  const [clientType, setClientType] = useState('todos');
  const [sorting, setSorting] = useState([]);

  const typeFilteredClients = useMemo(
    () => (clientType === 'todos' ? clients : clients.filter((c) => c.clientType === clientType)),
    [clients, clientType],
  );

  const columns = useMemo(() => [
    columnHelper.accessor('name', { header: 'Cliente' }),
    columnHelper.accessor('email', { header: 'Contato', enableSorting: false }),
    columnHelper.accessor(
      (row) => processes.filter((p) => p.clientId === row.id).length,
      { id: 'processCount', header: 'Processos' },
    ),
  ], [processes]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table exposes non-memoizable APIs by design.
  const table = useReactTable({
    data: typeFilteredClients,
    columns,
    state: { globalFilter: search, sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _, value) => {
      const client = row.original;
      return buildSearchText([
        client.name, client.email, client.phone, client.document,
        getClientTypeLabel(client.clientType),
      ]).includes(normalizeText(value));
    },
  });

  const rows = table.getRowModel().rows;

  async function handleDeleteClient(client) {
    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O cliente "${client.name}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) return;
    await deleteClient(client.id);
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Clientes" />

      <div className="clients-page">
        <section className="surface clients-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Clientes</h1>
              <p className="section-note">Gerencie seus clientes</p>
            </div>
            <span className="badge gold" data-list-count>{formatCount(rows.length)}</span>
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
          {rows.length ? (
            <>
              <div className="list-head" aria-hidden="true">
                {table.getHeaderGroups()[0].headers.map((header) => (
                  <span
                    key={header.id}
                    style={header.column.getCanSort() ? { cursor: 'pointer', userSelect: 'none' } : {}}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {' '}
                    {SORT_ICONS[header.column.getIsSorted()] ?? null}
                  </span>
                ))}
                <span>Ações</span>
              </div>

              <div className="clients-list">
                {rows.map((row) => {
                  const client = row.original;
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
                        <button className="action-link action-link-danger" type="button" onClick={() => handleDeleteClient(client)}>Excluir</button>
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

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? '',
      document: client ? formatDocument(client.document) : '',
      clientType: client?.clientType ?? 'esporadico',
      phone: client?.phone ?? '',
      email: client?.email ?? '',
      notes: client?.notes ?? '',
    },
  });

  if (isEditing && !client) {
    return <NotFoundState title="Cliente não encontrado." />;
  }

  async function onSubmit(data) {
    const savedClient = await saveClient({
      id: client?.id || undefined,
      name: data.name.trim(),
      document: stripDocument(data.document),
      clientType: data.clientType,
      phone: data.phone.trim(),
      email: data.email.trim(),
      notes: data.notes.trim(),
    });

    if (!savedClient) return;
    navigate(`/clientes/${savedClient.id || client?.id}`, { replace: true });
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
          <form className="client-form" onSubmit={handleSubmit(onSubmit)}>
            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Identificação</h2>
              </div>

              <div className="form-grid">
                <Field id="client-name" label="Nome" error={errors.name?.message}>
                  <input id="client-name" {...register('name')} />
                </Field>

                <Field id="client-document" label="CPF / CNPJ" error={errors.document?.message}>
                  <Controller
                    name="document"
                    control={control}
                    render={({ field }) => (
                      <input
                        id="client-document"
                        {...field}
                        onChange={(e) => field.onChange(formatDocument(e.target.value))}
                      />
                    )}
                  />
                </Field>

                <Field id="client-type" label="Tipo de cliente" error={errors.clientType?.message}>
                  <select id="client-type" {...register('clientType')}>
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
                <Field id="client-phone" label="Telefone" error={errors.phone?.message}>
                  <input id="client-phone" {...register('phone')} />
                </Field>

                <Field id="client-email" label="E-mail" error={errors.email?.message}>
                  <input id="client-email" type="email" {...register('email')} />
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Observações</h2>
              </div>

              <div className="form-grid">
                <Field id="client-notes" label="Notas" className="span-2" error={errors.notes?.message}>
                  <textarea id="client-notes" rows="5" {...register('notes')} />
                </Field>
              </div>
            </section>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isEditing ? 'Atualizar' : 'Salvar'}
              </button>
              <Link className="btn btn-secondary" to={isEditing ? `/clientes/${client.id}` : '/clientes'}>
                Cancelar
              </Link>
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
