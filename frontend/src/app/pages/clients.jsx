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

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Segmented } from '@/components/ui/segmented';
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
  getAreaKey,
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
  esporadico: 'border border-line-strong bg-transparent text-ink-2',
  mensalista: 'border border-transparent bg-accent-soft-2 text-[var(--accent-hover)]',
};

const LIST_GRID = 'grid-cols-[minmax(170px,2fr)_96px_minmax(120px,1.5fr)_72px]';
const CLIENT_TYPE_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'mensalista', label: 'Mensalistas' },
  { value: 'esporadico', label: 'Esporádicos' },
];

function ClientTierChip({ type, className }) {
  return (
    <Badge variant="outline" className={cn('px-2.5 py-1 text-[.86rem]', CLIENT_TIER_CLASSES[type], className)}>
      {getClientTypeLabel(type)}
    </Badge>
  );
}

const ClientRow = memo(function ClientRow({ client, processCount, selected, onSelect }) {
  return (
    <Motion.button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(client)}
      className={cn(
        'grid w-full items-center gap-3 rounded-md px-3.5 py-3 text-left transition-colors hover:bg-surface-2',
        LIST_GRID,
        selected && 'bg-surface-2 shadow-[inset_0_0_0_1.5px_var(--accent-soft-2)]',
      )}
      variants={staggerItem}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={client.name} seed={client.id} size={40} />
        <div className="min-w-0">
          <strong className="block truncate text-[1rem] font-bold text-ink">{client.name}</strong>
          <span className="block truncate text-meta-sm text-subtle tabular-nums">
            {documentLabel(client.document)} {formatDocument(client.document)}
            {client.ativo === false ? ' · Inativo (Drive)' : ''}
          </span>
        </div>
      </div>

      <ClientTierChip type={client.clientType} className="justify-self-start" />

      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-meta font-semibold text-ink-2">{client.email || '—'}</span>
        <span className="truncate text-meta-sm text-subtle tabular-nums">{client.phone ? formatPhone(client.phone) : '—'}</span>
      </div>

      <span className="text-[1.07rem] font-extrabold tabular-nums text-ink">{processCount}</span>
    </Motion.button>
  );
});

function ClientDetailPanel({ client, clientProcesses, onDelete }) {
  return (
    <aside className="sticky top-[88px] hidden flex-col gap-[18px] rounded-lg bg-card p-[22px] xl:flex" aria-label="Detalhes do cliente">
      <div className="flex items-center gap-3.5">
        <Avatar name={client.name} seed={client.id} size={60} className="rounded-[20px]" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <strong className="break-words text-card-title text-ink">{client.name}</strong>
          <ClientTierChip type={client.clientType} className="self-start" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-md bg-surface-2 px-3.5 py-3">
          <span className="block text-meta-sm font-semibold text-muted-foreground">E-mail</span>
          <strong className="block truncate text-meta font-bold text-ink">{client.email || '—'}</strong>
        </div>
        <div className="min-w-0 rounded-md bg-surface-2 px-3.5 py-3">
          <span className="block text-meta-sm font-semibold text-muted-foreground">Telefone</span>
          <strong className="block truncate text-meta font-bold tabular-nums text-ink">{client.phone ? formatPhone(client.phone) : '—'}</strong>
        </div>
        <div className="col-span-2 min-w-0 rounded-md bg-surface-2 px-3.5 py-3">
          <span className="block text-meta-sm font-semibold text-muted-foreground">Parceiro</span>
          <strong className="block truncate text-meta font-bold text-ink">{client.partner || '—'}</strong>
        </div>
      </div>

      {client.notes ? <p className="m-0 text-[1rem] font-medium leading-normal text-ink-2">{client.notes}</p> : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-[1.07rem] font-bold text-ink">Processos</h3>
          <span className="text-meta font-bold text-muted-foreground tabular-nums">{clientProcesses.length}</span>
        </div>
        {clientProcesses.length ? (
          clientProcesses.slice(0, 4).map((process) => {
            const areaKey = getAreaKey(process.area);
            return (
              <Link
                key={process.id}
                to={`/processos/${process.id}`}
                className="flex flex-col gap-1.5 rounded-md border border-line px-3.5 py-3 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="min-w-0 truncate text-[1rem] font-bold text-ink">{process.description || process.number}</strong>
                  {areaKey ? (
                    <span
                      className="shrink-0 rounded-pill px-2.5 py-1 text-[.79rem] font-bold"
                      style={{ background: `var(--cat-${areaKey})`, color: `var(--cat-${areaKey}-ink)` }}
                    >
                      {process.area}
                    </span>
                  ) : null}
                </div>
                {process.court ? <span className="truncate text-meta-sm text-muted-foreground">{process.court}</span> : null}
                <span className="flex items-center gap-2 text-meta-sm font-semibold tabular-nums text-ink-2">
                  <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
                  <span className="truncate">· {process.number}</span>
                </span>
              </Link>
            );
          })
        ) : (
          <p className="m-0 text-meta text-muted-foreground">Nenhum processo vinculado.</p>
        )}
        {clientProcesses.length > 4 ? (
          <Link to={`/clientes/${client.id}`} className="text-meta font-bold text-ink-2 hover:text-ink">
            Ver todos os {clientProcesses.length} processos
          </Link>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link to={`/processos/novo?cliente=${client.id}`}>Novo processo</Link>
        </Button>
        <Button asChild variant="secondary" className="flex-1">
          <Link to={`/clientes/${client.id}`}>Abrir cliente</Link>
        </Button>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/clientes/${client.id}/editar`}>Editar</Link>
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" onClick={() => onDelete(client)}>
          Excluir
        </Button>
      </div>
    </aside>
  );
}

export function ClientsListPage() {
  const { clients, clientsPagination, deleteClient, loadClients, loadMoreClients, processes } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [clientType, setClientType] = useState('todos');
  const [sorting, setSorting] = useState([]);
  const [discovering, setDiscovering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

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
    columnHelper.accessor('clientType', { header: 'Contrato', enableSorting: false }),
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
  // Painel lateral só existe em telas largas (xl); abaixo disso a linha abre a página do cliente.
  const selectedClient = rows.find((row) => row.original.id === selectedId)?.original || rows[0]?.original || null;

  function handleSelect(client) {
    if (window.matchMedia('(min-width: 1280px)').matches) {
      setSelectedId(client.id);
    } else {
      navigate(`/clientes/${client.id}`);
    }
  }

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
      <PageChrome label="Clientes" primaryAction={{ label: 'Novo cliente', to: '/clientes/novo', tour: 'page-primary-action' }} />

      <div className="flex flex-col gap-4">
        <PageHeader title="Clientes" subtitle={formatCount(clientsPagination.total)}>
          <PageSearch
            className="on-bg w-60"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome"
            label="Buscar clientes"
          />
          <Segmented tone="bg" label="Tipo do cliente" options={CLIENT_TYPE_TABS} value={clientType} onChange={setClientType} />
          <Button variant="secondary" onClick={() => setDiscovering(true)}>
            <FolderInput className="size-4" />
            Importar do Drive
          </Button>
        </PageHeader>

        {discovering ? (
          <ClientDriveDiscoveryWizard onClose={() => setDiscovering(false)} />
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-lg bg-card px-3 pb-2 pt-3" aria-label="Lista de clientes">
            {rows.length ? (
              <div className="overflow-x-auto">
                <div className="min-w-[620px]">
                  <div className={cn('grid gap-3 px-3.5 py-3 text-label uppercase text-subtle', LIST_GRID)}>
                    {table.getHeaderGroups()[0].headers.map((header) => {
                      const sortState = header.column.getIsSorted();
                      const canSort = header.column.getCanSort();
                      return (
                        <button
                          key={header.id}
                          type="button"
                          disabled={!canSort}
                          aria-label={canSort ? `Ordenar por ${header.column.columnDef.header}` : undefined}
                          className={cn(
                            'inline-flex items-center gap-1.5 text-left uppercase',
                            canSort ? 'cursor-pointer select-none hover:text-ink' : 'cursor-default',
                            sortState && 'text-ink',
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
                        </button>
                      );
                    })}
                  </div>

                  <Motion.div
                    className="grid gap-0.5"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {rows.map((row) => {
                      const client = row.original;
                      const processCount = processes.filter((process) => process.clientId === client.id).length;
                      return (
                        <ClientRow
                          key={client.id}
                          client={client}
                          processCount={processCount}
                          selected={selectedClient?.id === client.id}
                          onSelect={handleSelect}
                        />
                      );
                    })}
                  </Motion.div>
                </div>

                {clientsPagination.temMais ? (
                  <div className="flex justify-center p-3">
                    <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? 'Carregando…' : 'Carregar mais'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="Nenhum cliente encontrado."
                copy="Ajuste a busca ou troque o tipo selecionado."
                actions={<Button asChild><Link to="/clientes/novo">Novo</Link></Button>}
              />
            )}
          </section>

          {selectedClient ? (
            <ClientDetailPanel
              client={selectedClient}
              clientProcesses={processes.filter((process) => process.clientId === selectedClient.id)}
              onDelete={handleDeleteClient}
            />
          ) : null}
        </div>
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
          <p className="text-page-title text-ink">
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
