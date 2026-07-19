import { memo, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, FolderInput, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { AnimatePresence, motion as Motion, staggerContainer, staggerItem } from '../motion';
import { useAppState } from '../store';
import {
  documentLabel,
  formatCount,
  formatDate,
  formatTime,
  formatDocument,
  formatPhone,
  stripPhone,
  getClientTypeLabel,
  getStatusTone,
  stripDocument,
} from '../utils';
import { Select } from '../components/select';
import {
  ComboField,
  DetailGrid,
  DetailHero,
  DetailItem,
  DetailLayout,
  DetailSection,
  DetailStack,
  EmptyState,
  Field,
  NotFoundState,
} from './common';
import { ClientDocuments } from '../components/client-documents';
import { ClientDriveDiscoveryWizard } from '../components/client-drive-discovery-wizard';

const columnHelper = createColumnHelper();

const clientSchema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  document: z.string().min(1, 'Informe o CPF ou CNPJ.').refine(
    (val) => stripDocument(val).length >= 11,
    'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).',
  ),
  clientType: z.enum(['esporadico', 'mensalista']),
  partner: z.string().optional(),
  phone: z.string().min(1, 'Informe o telefone.').refine(
    (val) => stripPhone(val).length >= 10,
    'Informe um telefone com DDD (10 ou 11 dígitos).',
  ),
  email: z.string().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  notes: z.string(),
});

const SORT_ICONS = {
  asc: <ChevronUp className="size-3" strokeWidth={2.2} aria-hidden="true" />,
  desc: <ChevronDown className="size-3" strokeWidth={2.2} aria-hidden="true" />,
};

const CLIENT_TIER_CLASSES = {
  esporadico: 'border-border bg-white/[.03] text-soft',
  mensalista: 'border-primary/20 bg-primary/10 text-primary',
};

const ClientRow = memo(function ClientRow({ client, processCount, onDelete }) {
  return (
    <Motion.article
      className="grid grid-cols-1 items-start gap-3 rounded-2xl border border-border bg-accent/5 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(260px,.95fr)_120px_272px]"
      variants={staggerItem}
    >
      <div
        className="hidden size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary sm:grid"
        aria-hidden="true"
      >
        {client.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0">
        <h2 className="line-clamp-2 break-words font-serif text-2xl leading-[.95] text-foreground sm:text-3xl">
          {client.name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn('uppercase tracking-wide', CLIENT_TIER_CLASSES[client.clientType])}>
            {getClientTypeLabel(client.clientType)}
          </Badge>
          {client.ativo === false ? (
            <Badge variant="destructive" className="uppercase tracking-wide">Inativo (Drive)</Badge>
          ) : null}
        </div>
        <span className="mt-1.5 block text-sm text-muted-foreground">
          {documentLabel(client.document)} {formatDocument(client.document)}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-2 sm:grid">
          {client.email ? (
            <a
              className="inline-flex h-8 max-w-full items-center truncate rounded-full border border-border bg-accent/10 px-2.5 text-sm text-soft"
              href={`mailto:${client.email}`}
            >
              {client.email}
            </a>
          ) : (
            <span className="inline-flex h-8 items-center px-2.5 text-sm text-muted-foreground">-</span>
          )}
          {client.phone ? (
            <a
              className="inline-flex h-8 max-w-full items-center truncate rounded-full border border-border bg-accent/10 px-2.5 text-sm text-soft"
              href={`tel:${client.phone}`}
            >
              {formatPhone(client.phone)}
            </a>
          ) : (
            <span className="inline-flex h-8 items-center px-2.5 text-sm text-muted-foreground">-</span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <strong className="block text-xl font-bold leading-none text-foreground">{processCount}</strong>
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          processo{processCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 lg:justify-center">
        <Button asChild variant="outline" size="sm">
          <Link to={`/clientes/${client.id}`}>Ver</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/clientes/${client.id}/editar`}>Editar</Link>
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(client)}>
          Excluir
        </Button>
      </div>
    </Motion.article>
  );
});

export function ClientsListPage() {
  const { clients, clientsPagination, deleteClient, loadClients, loadMoreClients, processes } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');
  const [clientType, setClientType] = useState('todos');
  const [sorting, setSorting] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Busca/filtro por tipo agora são server-side (clientes/views.py já suporta
  // ?q=&tipo=); debounce evita uma request por tecla. Sort continua client-side
  // — atua só sobre a página já carregada, não sobre a coleção inteira.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients({ q: search, tipo: clientType });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, clientType]);

  const columns = useMemo(() => [
    columnHelper.accessor('name', { header: 'Cliente' }),
    columnHelper.accessor('email', { header: 'Contato', enableSorting: false }),
    columnHelper.accessor(
      (row) => processes.filter((p) => p.clientId === row.id).length,
      { id: 'processCount', header: 'Processos' },
    ),
  ], [processes]);

  const table = useReactTable({
    data: clients,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadMoreClients({ q: search, tipo: clientType });
    } finally {
      setLoadingMore(false);
    }
  }

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

      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Clientes</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatCount(clientsPagination.total)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setDiscovering(true)}>
                <FolderInput className="size-4" />
                Importar do Drive
              </Button>
              <Button asChild>
                <Link to="/clientes/novo" data-tour="page-primary-action">
                  <Plus className="size-4" />
                  Novo
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-[180px] flex-1">
              <PageSearch
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                label="Buscar clientes"
              />
            </div>

            <div className="w-full sm:w-[220px]">
              <label className="sr-only" htmlFor="clients-type-filter">Tipo do cliente</label>
              <Select
                id="clients-type-filter"
                value={clientType}
                onChange={(event) => setClientType(event.target.value)}
                aria-label="Filtrar por tipo do cliente"
              >
                <option value="todos">Todos os tipos</option>
                <option value="esporadico">Esporádicos</option>
                <option value="mensalista">Mensalistas</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {discovering ? (
          <ClientDriveDiscoveryWizard onClose={() => setDiscovering(false)} />
        ) : null}

        <Card>
          <CardContent className="py-5">
          {rows.length ? (
            <>
              <div
                className="mb-3 hidden grid-cols-[minmax(0,1.3fr)_minmax(260px,.95fr)_120px_272px] gap-3.5 px-3.5 pl-[86px] text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid"
                aria-hidden="true"
              >
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const sortState = header.column.getIsSorted();
                  return (
                    <span
                      key={header.id}
                      className={cn(
                        'inline-flex items-center gap-1.5',
                        header.column.getCanSort() && 'cursor-pointer select-none hover:text-primary',
                        sortState && 'text-primary',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <AnimatePresence mode="wait" initial={false}>
                        {sortState ? (
                          <Motion.span
                            key={sortState}
                            className="inline-flex items-center"
                            initial={{ opacity: 0, y: sortState === 'asc' ? 3 : -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: sortState === 'asc' ? -3 : 3 }}
                            transition={{ duration: 0.14 }}
                          >
                            {SORT_ICONS[sortState]}
                          </Motion.span>
                        ) : null}
                      </AnimatePresence>
                    </span>
                  );
                })}
                <span className="text-center">Ações</span>
              </div>

              <Motion.div
                className="grid gap-2.5"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {rows.map((row) => {
                  const client = row.original;
                  const processCount = processes.filter((process) => process.clientId === client.id).length;
                  return (
                    <ClientRow key={client.id} client={client} processCount={processCount} onDelete={handleDeleteClient} />
                  );
                })}
              </Motion.div>

              {clientsPagination.temMais ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Carregando…' : 'Carregar mais'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Nenhum cliente encontrado."
              copy="Ajuste a busca ou troque o tipo selecionado."
              actions={<Button asChild><Link to="/clientes/novo">Novo</Link></Button>}
            />
          )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function ClientFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.clientId);
  const { clients, loadClient, saveClient } = useAppState();
  const client = clients.find((item) => item.id === params.clientId) || null;
  const [isLoadingClient, setIsLoadingClient] = useState(isEditing);

  // `clients` no store pode conter só a página carregada pela listagem — busca
  // o registro direto por id caso a edição seja aberta fora dessa página
  // (link externo, busca ativa que excluiu o cliente, etc).
  useEffect(() => {
    if (!isEditing) {
      setIsLoadingClient(false);
      return undefined;
    }
    let isMounted = true;
    setIsLoadingClient(true);
    loadClient(params.clientId).finally(() => {
      if (isMounted) setIsLoadingClient(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.clientId, isEditing]);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? '',
      document: client ? formatDocument(client.document) : '',
      clientType: client?.clientType ?? 'esporadico',
      partner: client?.partner ?? '',
      phone: client ? formatPhone(client.phone) : '',
      email: client?.email ?? '',
      notes: client?.notes ?? '',
    },
  });

  // defaultValues só é lido no primeiro render do useForm — quando o cliente
  // chega depois (fetch assíncrono), precisa de reset() explícito.
  useEffect(() => {
    if (!client) return;
    reset({
      name: client.name ?? '',
      document: formatDocument(client.document),
      clientType: client.clientType ?? 'esporadico',
      partner: client.partner ?? '',
      phone: formatPhone(client.phone),
      email: client.email ?? '',
      notes: client.notes ?? '',
    });
  }, [client, reset]);

  const partnerOptions = useMemo(
    () => [...new Set(clients.map((item) => item.partner).filter(Boolean))],
    [clients],
  );

  if (isEditing && !client) {
    if (isLoadingClient) {
      return null;
    }
    return <NotFoundState title="Cliente não encontrado." />;
  }

  async function onSubmit(data) {
    const savedClient = await saveClient({
      id: client?.id || undefined,
      name: data.name.trim(),
      document: stripDocument(data.document),
      clientType: data.clientType,
      partner: (data.partner || '').trim(),
      phone: stripPhone(data.phone),
      email: data.email.trim(),
      notes: data.notes.trim(),
    });

    if (!savedClient) return;
    navigate(`/clientes/${savedClient.id || client?.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar cliente' : 'Novo cliente'} />

      <div className="grid gap-4">
        <section className="mb-2">
          <p className="font-serif text-3xl text-foreground">
            {isEditing ? 'Editar cliente' : 'Novo cliente'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEditing ? 'Atualize os dados do cadastro com o mesmo fluxo da criação.' : 'Cadastro direto e objetivo.'}
          </p>

          <Link
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to={isEditing ? `/clientes/${client.id}` : '/clientes'}
          >
            <ArrowLeft className="size-3.5" />
            {isEditing ? 'Voltar para o cliente' : 'Voltar para clientes'}
          </Link>
        </section>

        <Card>
          <CardContent className="py-5">
          <form className="client-form" onSubmit={handleSubmit(onSubmit)}>
            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Identificação</h2>
              </div>

              <div className="form-grid">
                <Field id="client-name" label="Nome" error={errors.name?.message} required>
                  <input id="client-name" {...register('name')} />
                </Field>

                <Field id="client-document" label="CPF / CNPJ" error={errors.document?.message} required>
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
                  <Select id="client-type" {...register('clientType')}>
                    <option value="esporadico">Esporádico</option>
                    <option value="mensalista">Mensalista</option>
                  </Select>
                </Field>

                <Field id="client-partner" label="Parceria" error={errors.partner?.message} note="Origem do cliente, se veio de um parceiro.">
                  <Controller
                    name="partner"
                    control={control}
                    render={({ field }) => (
                      <ComboField
                        id="client-partner"
                        campo="cliente_parceiro"
                        value={field.value || ''}
                        options={partnerOptions}
                        selectPlaceholder="Sem parceria"
                        customLabel="+ Digitar novo parceiro…"
                        customPlaceholder="Nome do parceiro"
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Contato</h2>
              </div>

              <div className="form-grid">
                <Field id="client-phone" label="Telefone" error={errors.phone?.message} required>
                  <Controller
                    name="phone"
                    control={control}
                    render={({ field }) => (
                      <input
                        id="client-phone"
                        type="tel"
                        autoComplete="tel"
                        {...field}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      />
                    )}
                  />
                </Field>

                <Field id="client-email" label="E-mail" error={errors.email?.message} required>
                  <input id="client-email" type="email" autoComplete="email" {...register('email')} />
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
              <Button type="submit" disabled={isSubmitting}>
                {isEditing ? 'Atualizar' : 'Salvar'}
              </Button>
              <Button asChild variant="outline">
                <Link to={isEditing ? `/clientes/${client.id}` : '/clientes'}>Cancelar</Link>
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const PAST_EVENTS_PAGE_SIZE = 5;

export function ClientDetailPage() {
  const params = useParams();
  const { clients, events, loadClient, processes } = useAppState();
  const client = clients.find((item) => item.id === params.clientId) || null;
  const [showAllPastEvents, setShowAllPastEvents] = useState(false);
  const [now] = useState(() => Date.now());
  const [isLoadingClient, setIsLoadingClient] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingClient(true);
    loadClient(params.clientId).finally(() => {
      if (isMounted) setIsLoadingClient(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.clientId]);

  if (!client) {
    if (isLoadingClient) {
      return null;
    }
    return <NotFoundState title="Cliente não encontrado." />;
  }

  const relatedProcesses = processes.filter((process) => process.clientId === client.id);
  const clientEvents = events.filter((event) => event.clientId === client.id);
  const upcomingEvents = clientEvents
    .filter((event) => event.start && new Date(event.start).getTime() >= now)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const pastEvents = clientEvents
    .filter((event) => !event.start || new Date(event.start).getTime() < now)
    .sort((a, b) => new Date(b.start) - new Date(a.start));
  const visiblePastEvents = showAllPastEvents ? pastEvents : pastEvents.slice(0, PAST_EVENTS_PAGE_SIZE);
  const relatedEvents = [...upcomingEvents, ...visiblePastEvents];
  const hiddenPastEventsCount = pastEvents.length - visiblePastEvents.length;

  return (
    <>
      <PageChrome label="Cliente" />

      <div className="grid gap-4">
        <DetailHero
          breadcrumbLabel="Clientes"
          breadcrumbTo="/clientes"
          mark={client.name.slice(0, 1).toUpperCase()}
          title={client.name}
          subtitle="Dados centrais do cliente."
          meta={
            <Badge
              variant="outline"
              className={cn('uppercase tracking-wide', CLIENT_TIER_CLASSES[client.clientType])}
            >
              {getClientTypeLabel(client.clientType)}
            </Badge>
          }
        />

        <DetailLayout>
          <DetailStack>
            <DetailSection title="Dados" note="Essenciais">
              <DetailGrid>
                <DetailItem label="Documento">{formatDocument(client.document)}</DetailItem>
                <DetailItem label="Telefone">
                  <a className="hover:text-primary" href={`tel:${client.phone}`}>{formatPhone(client.phone)}</a>
                </DetailItem>
                <DetailItem label="E-mail">
                  <a className="hover:text-primary" href={`mailto:${client.email}`}>{client.email}</a>
                </DetailItem>
                <DetailItem label="Tipo">{getClientTypeLabel(client.clientType)}</DetailItem>
                <DetailItem label="Parceria">{client.partner || '-'}</DetailItem>
                <DetailItem label="Observações">{client.notes ? 'Disponíveis' : '-'}</DetailItem>
              </DetailGrid>
            </DetailSection>

            <DetailSection title="Processos" note={formatCount(relatedProcesses.length)}>
              <div className={cn('list', relatedProcesses.length > 4 && 'max-h-[480px] overflow-y-auto pr-1')}>
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
            </DetailSection>
          </DetailStack>

          <DetailStack>
            <DetailSection
              title="Compromissos"
              note={`${formatCount(upcomingEvents.length)} próximo${upcomingEvents.length === 1 ? '' : 's'}${pastEvents.length ? ` · ${formatCount(pastEvents.length)} anterior${pastEvents.length === 1 ? '' : 'es'}` : ''}`}
            >
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
                      {event.responsibleName ? <span className="meta-chip">{event.responsibleName}</span> : null}
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
              {hiddenPastEventsCount > 0 && (
                <Button variant="outline" onClick={() => setShowAllPastEvents(true)}>
                  Ver mais {formatCount(hiddenPastEventsCount)} anterior{hiddenPastEventsCount === 1 ? '' : 'es'}
                </Button>
              )}
            </DetailSection>

            <DetailSection title="Observações" note="Internas">
              {client.notes ? (
                <div className="note-box">{client.notes}</div>
              ) : (
                <div className="empty">
                  <strong>Sem observações.</strong>
                  <p>Nenhuma nota registrada.</p>
                </div>
              )}
            </DetailSection>
          </DetailStack>
        </DetailLayout>

        <ClientDocuments client={client} />
      </div>
    </>
  );
}
