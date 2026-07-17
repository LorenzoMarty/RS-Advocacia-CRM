import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { motion as Motion, staggerContainer, staggerItem } from '../motion';
import { PROCESS_AREA_OPTIONS, PROCESS_STATUS_OPTIONS } from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { formatCount, formatPhone, getStatusTone } from '../utils';
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

function validateProcessForm(form) {
  const nextErrors = {};

  if (!form.number.trim()) nextErrors.number = 'Informe o número do processo.';
  if (!form.clientId) nextErrors.clientId = 'Selecione um cliente.';
  if (!form.owner.trim()) nextErrors.owner = 'Informe o responsável.';
  if (!form.status.trim()) nextErrors.status = 'Informe o status.';
  if (!form.area.trim()) nextErrors.area = 'Informe a área jurídica.';
  if (!form.court.trim()) nextErrors.court = 'Informe a vara.';

  return nextErrors;
}

const ProcessRow = memo(function ProcessRow({ process, clientName, onDelete }) {
  return (
    <Motion.article
      className="grid grid-cols-1 items-start gap-3 rounded-2xl border border-border bg-accent/5 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,.9fr)_160px_minmax(0,160px)_252px]"
      variants={staggerItem}
    >
      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-snug text-foreground">{process.number}</h2>
        <span className="mt-1.5 block text-sm text-muted-foreground">{clientName}</span>
      </div>

      <div className="min-w-0">
        <div className="grid gap-2">
          {process.area ? (
            <span className="inline-flex h-8 w-fit max-w-full items-center truncate rounded-full border border-border bg-accent/10 px-2.5 text-sm text-soft">
              {process.area}
            </span>
          ) : null}
          {process.court ? (
            <span className="inline-flex h-8 w-fit max-w-full items-center truncate rounded-full border border-border bg-accent/10 px-2.5 text-sm text-soft">
              {process.court}
            </span>
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <span className="inline-flex h-8 w-fit max-w-full items-center truncate rounded-full border border-border bg-accent/10 px-2.5 text-sm text-soft">
          {process.ownerName}
        </span>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
        {!process.lawyerEnabled && (
          <StatusBadge tone="warn">Advogado não habilitado</StatusBadge>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 lg:justify-center">
        <Button asChild variant="outline" size="sm">
          <Link to={`/processos/${process.id}`}>Ver</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/processos/${process.id}/editar`}>Editar</Link>
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(process)}>
          Excluir
        </Button>
      </div>
    </Motion.article>
  );
});

export function ProcessesListPage() {
  const { clients, deleteProcess, loadMoreProcesses, loadProcesses, processes, processesPagination } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Busca server-side (processos/views.py já suporta ?q=); debounce evita
  // uma request por tecla. Filtra os mesmos campos que o backend cobre
  // (número, cliente, área, vara, responsável, status).
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProcesses({ q: search });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadMoreProcesses({ q: search });
    } finally {
      setLoadingMore(false);
    }
  }

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

      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Processos</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatCount(processesPagination.total)}</p>
            </div>
            <Button asChild>
              <Link to="/processos/novo" data-tour="page-primary-action">
                <Plus className="size-4" />
                Novo
              </Link>
            </Button>
          </div>
        </section>

        <Card>
          <CardContent className="py-4">
            <PageSearch
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              label="Buscar processos"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
          {processes.length ? (
            <>
              <div
                className="mb-3 hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,.9fr)_160px_minmax(0,160px)_252px] gap-3.5 px-3.5 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid"
                aria-hidden="true"
              >
                <span>Processo</span>
                <span>Área</span>
                <span>Responsável</span>
                <span>Status</span>
                <span className="text-center">Ações</span>
              </div>

              <Motion.div
                className="grid gap-2.5"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {processes.map((process) => (
                  <ProcessRow
                    key={process.id}
                    process={process}
                    clientName={clients.find((client) => client.id === process.clientId)?.name}
                    onDelete={handleDeleteProcess}
                  />
                ))}
              </Motion.div>

              {processesPagination.temMais ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Nenhum processo encontrado."
              copy="Ajuste a busca para localizar o registro desejado."
              actions={<Link className="btn" to="/processos/novo">Novo</Link>}
            />
          )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function ProcessFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.processId);
  const { clients, loadProcess, processes, saveProcess, users } = useAppState();
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
    lawyerEnabled: process?.lawyerEnabled ?? true,
  }));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProcess, setIsLoadingProcess] = useState(isEditing);

  // `processes` no store pode conter só a página carregada pela listagem —
  // busca o registro direto por id caso a edição seja aberta fora dessa
  // página (link externo, busca ativa que excluiu o processo, etc).
  useEffect(() => {
    if (!isEditing) {
      setIsLoadingProcess(false);
      return undefined;
    }
    let isMounted = true;
    setIsLoadingProcess(true);
    loadProcess(params.processId).finally(() => {
      if (isMounted) setIsLoadingProcess(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.processId, isEditing]);

  useEffect(() => {
    if (!process) return;
    setForm({
      id: process.id || '',
      number: process.number || '',
      clientId: process.clientId || initialClientId,
      owner: process.owner || '',
      status: process.status || 'Ativo',
      area: process.area || '',
      court: process.court || '',
      description: process.description || '',
      lawyerEnabled: process.lawyerEnabled ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process]);

  function updateField(field, value) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
    setErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const next = { ...currentErrors };
      delete next[field];
      return next;
    });
  }

  const statusOptions = useMemo(
    () => [...new Set([...PROCESS_STATUS_OPTIONS, ...processes.map((item) => item.status).filter(Boolean)])],
    [processes],
  );
  const areaOptions = useMemo(
    () => [...new Set([...PROCESS_AREA_OPTIONS, ...processes.map((item) => item.area).filter(Boolean)])],
    [processes],
  );
  const courtOptions = useMemo(
    () => [...new Set(processes.map((item) => item.court).filter(Boolean))],
    [processes],
  );

  if (isEditing && !process) {
    if (isLoadingProcess) {
      return null;
    }
    return <NotFoundState title="Processo não encontrado." />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateProcessForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    const savedProcess = await saveProcess({
      id: form.id || undefined,
      number: form.number.trim(),
      clientId: form.clientId,
      owner: form.owner.trim(),
      status: form.status.trim(),
      area: form.area.trim(),
      court: form.court.trim(),
      description: form.description.trim(),
      lawyerEnabled: form.lawyerEnabled,
    });
    setIsSubmitting(false);

    if (!savedProcess) {
      return;
    }

    navigate(`/processos/${savedProcess.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar processo' : 'Novo processo'} />

      <div className="grid gap-4">
        <section className="mb-2">
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to={isEditing ? `/processos/${process.id}` : '/processos'}
          >
            <ArrowLeft className="size-3.5" />
            {isEditing ? 'Voltar para o processo' : 'Voltar para processos'}
          </Link>

          <p className="mt-3 font-serif text-3xl text-foreground">
            {isEditing ? 'Editar processo' : 'Novo processo'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEditing ? 'Ajuste os dados principais do processo sem trocar de fluxo.' : 'Registro claro e direto.'}
          </p>
        </section>

        <Card>
          <CardContent className="py-5">
          <form className="process-form" onSubmit={handleSubmit}>
            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Dados principais</h2>
              </div>

              <div className="form-grid">
                <Field id="process-number" label="Número" error={errors.number} required>
                  <input
                    id="process-number"
                    value={form.number}
                    onChange={(event) => updateField('number', event.target.value)}
                  />
                </Field>

                <Field id="process-client" label="Cliente" error={errors.clientId} required>
                  <Select
                    id="process-client"
                    value={form.clientId}
                    onChange={(event) => updateField('clientId', event.target.value)}
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field id="process-owner" label="Responsável" error={errors.owner} required>
                  <Select
                    id="process-owner"
                    value={form.owner}
                    onChange={(event) => updateField('owner', event.target.value)}
                  >
                    <option value="">Selecione o responsável</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field id="process-status" label="Status" error={errors.status} required>
                  <ComboField
                    id="process-status"
                    value={form.status}
                    options={statusOptions}
                    selectPlaceholder="Selecione o status"
                    customLabel="+ Digitar novo status..."
                    customPlaceholder="Ex: Suspenso..."
                    onChange={(value) => updateField('status', value)}
                  />
                </Field>
              </div>
            </section>

            <section className="form-group">
              <div className="group-head">
                <h2 className="group-title">Classificação</h2>
              </div>

              <div className="form-grid">
                <Field id="process-area" label="Área jurídica" error={errors.area} required>
                  <ComboField
                    id="process-area"
                    value={form.area}
                    options={areaOptions}
                    selectPlaceholder="Selecione a área jurídica"
                    customLabel="+ Digitar nova área..."
                    customPlaceholder="Ex: Penal, Previdenciário..."
                    onChange={(value) => updateField('area', value)}
                  />
                </Field>

                <Field id="process-court" label="Vara" error={errors.court} required>
                  <ComboField
                    id="process-court"
                    value={form.court}
                    options={courtOptions}
                    selectPlaceholder="Selecione a vara"
                    customLabel="+ Digitar nova vara..."
                    customPlaceholder="Ex: 2ª Vara Criminal..."
                    onChange={(value) => updateField('court', value)}
                  />
                </Field>
                <Field id="process-lawyer-enabled" label="Situação do advogado">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="process-lawyer-enabled"
                      type="checkbox"
                      checked={form.lawyerEnabled}
                      onChange={(event) => updateField('lawyerEnabled', event.target.checked)}
                    />
                    <span>Advogado habilitado nos autos</span>
                  </label>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar'}
              </Button>
              <Button asChild variant="outline">
                <Link to={isEditing ? `/processos/${process.id}` : '/processos'}>Cancelar</Link>
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function ProcessDetailPage() {
  const params = useParams();
  const { clients, deadlines, events, loadProcess, petitions, processes } = useAppState();
  const process = processes.find((item) => item.id === params.processId) || null;
  const [isLoadingProcess, setIsLoadingProcess] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingProcess(true);
    loadProcess(params.processId).finally(() => {
      if (isMounted) setIsLoadingProcess(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.processId]);

  if (!process) {
    if (isLoadingProcess) {
      return null;
    }
    return <NotFoundState title="Processo não encontrado." />;
  }

  const client = clients.find((item) => item.id === process.clientId) || null;
  const relatedEvents = events.filter((event) => event.processId === process.id);
  const relatedDeadlines = deadlines.filter((deadline) => deadline.processId === process.id);
  const relatedPetitions = petitions.filter((petition) => petition.processId === process.id);

  return (
    <>
      <PageChrome label="Processo" />

      <div className="grid gap-4">
        <DetailHero
          breadcrumbLabel="Processos"
          breadcrumbTo="/processos"
          mark="PJ"
          title={process.number}
          subtitle={client?.name}
          summary={[
            { label: 'Status', value: <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge> },
            ...(!process.lawyerEnabled
              ? [{ label: 'Advogado', value: <StatusBadge tone="warn">Não habilitado</StatusBadge> }]
              : []),
            { label: 'Compromissos', value: relatedEvents.length },
            { label: 'Prazos', value: relatedDeadlines.length },
            { label: 'Peças', value: relatedPetitions.length },
            { label: 'Responsável', value: process.ownerName || '-' },
          ]}
        />

        <DetailLayout>
          <DetailStack>
            <DetailSection title="Dados" note="Essenciais">
              <DetailGrid>
                <DetailItem label="Número">{process.number}</DetailItem>
                <DetailItem label="Cliente">
                  {client ? <Link className="hover:text-primary" to={`/clientes/${client.id}`}>{client.name}</Link> : '-'}
                </DetailItem>
                <DetailItem label="Área">{process.area || '-'}</DetailItem>
                <DetailItem label="Vara">{process.court || '-'}</DetailItem>
                <DetailItem label="Responsável">{process.ownerName || '-'}</DetailItem>
                <DetailItem label="Status">
                  <StatusBadge tone={getStatusTone(process.status)}>{process.status}</StatusBadge>
                </DetailItem>
              </DetailGrid>
            </DetailSection>

            <DetailSection title="Compromissos" note={formatCount(relatedEvents.length)}>
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
            </DetailSection>

            <DetailSection title="Prazos" note={formatCount(relatedDeadlines.length, 'prazo', 'prazos')}><div className="list">
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
            </DetailSection>

            <DetailSection title="Petições ou contestações" note={formatCount(relatedPetitions.length, 'peça', 'peças')}><div className="list">
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
            </DetailSection>
          </DetailStack>

          <DetailStack>
            <DetailSection title="Cliente" note="Vinculado">{client ? (
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
                    <a className="meta-chip" href={`tel:${client.phone}`}>{formatPhone(client.phone)}</a>
                  </div>

                  <div className="empty-actions">
                    <Link className="btn btn-secondary" to={`/clientes/${client.id}`}>Ver cliente</Link>
                  </div>
                </article>
              ) : (
                <div className="note-box">Nenhum cliente vinculado.</div>
              )}
            </DetailSection>

            <DetailSection title="Observações" note="Internas">{process.description ? (
                <div className="note-box">{process.description}</div>
              ) : (
                <div className="empty">
                  <strong>Sem observações.</strong>
                  <p>Nenhuma nota registrada.</p>
                </div>
              )}
            </DetailSection>
          </DetailStack>
        </DetailLayout>
      </div>
    </>
  );
}
