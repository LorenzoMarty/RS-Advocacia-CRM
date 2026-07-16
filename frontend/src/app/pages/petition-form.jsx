import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { PETITION_STATUS_COLUMNS } from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { listClientDrive } from '../services/documentos';
import { normalizeText } from '../utils';
import { Select } from '../components/select';
import { EmptyState, Field } from './common';
import {
  PETITION_DEFAULT_STATUS,
  PETITION_DEFAULT_TYPE,
  PETITION_TYPE_OPTIONS,
  petitionColumnKey,
  sortedUnique,
} from './petitions-utils';

const petitionSchema = z.object({
  clientId: z.string().min(1, 'Selecione o cliente.'),
  processId: z.string().min(1, 'Selecione o processo vinculado.'),
  type: z.string().refine((value) => PETITION_TYPE_OPTIONS.includes(value), 'Selecione o tipo da peça.'),
  adversary: z.string().min(1, 'Informe o adverso.'),
  responsible: z.string().min(1, 'Informe o responsável pela ação.'),
  status: z.string(),
  pendingReason: z.string(),
  area: z.string(),
});

// Nome da pasta do processo no Drive — espelha `_nome_pasta_processo` no backend.
function processFolderName(process) {
  return [process?.area, process?.number].map((part) => (part || '').trim()).filter(Boolean).join(' - ');
}

function findFolderByName(folders, name) {
  const wanted = normalizeText(name);
  return folders.find((folder) => normalizeText(folder.name) === wanted) || null;
}

function PetitionFolderFiles({ clientId, process }) {
  const [state, setState] = useState({ status: 'loading', files: [] });

  useEffect(() => {
    let isMounted = true;

    if (!clientId || !process?.id) {
      setState({ status: 'no-process', files: [] });
      return undefined;
    }

    async function loadFiles() {
      try {
        // Navega: raiz do cliente → pasta do processo (<área> - <número>) → PETIÇÕES.
        const root = await listClientDrive(clientId);
        const processFolder = findFolderByName(root.folders, processFolderName(process));
        if (!processFolder) {
          if (isMounted) setState({ status: 'empty', files: [] });
          return;
        }
        const processContent = await listClientDrive(clientId, processFolder.id);
        const peticoesFolder = findFolderByName(processContent.folders, 'Petições');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, process?.id, process?.area, process?.number]);

  return (
    <section className="surface petition-form-panel">
      <div className="section-head">
        <div>
          <h2 className="section-title">Arquivos na pasta Petições</h2>
          <p className="section-note">Documentos da pasta do processo no Google Drive</p>
        </div>
      </div>

      {state.status === 'no-process' ? <p className="section-note">Vincule um processo para ver os arquivos.</p> : null}
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

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(petitionSchema),
    defaultValues: {
      clientId: petition?.clientId || (isEditing ? '' : initialClientId),
      processId: petition?.processId || (isEditing ? '' : initialProcessId),
      type: petition?.type || PETITION_DEFAULT_TYPE,
      adversary: petition?.adversary || '',
      responsible: petition?.responsible || '',
      status: petition?.status || PETITION_DEFAULT_STATUS,
      pendingReason: petition?.pendingReason || '',
      area: petition?.area || '',
    },
  });

  // defaultValues só é lido no primeiro render do useForm — quando a peça
  // chega depois (fetch assíncrono), precisa de reset() explícito.
  useEffect(() => {
    if (!petition) return;
    reset({
      clientId: petition.clientId || '',
      processId: petition.processId || '',
      type: petition.type || PETITION_DEFAULT_TYPE,
      adversary: petition.adversary || '',
      responsible: petition.responsible || '',
      status: petition.status || PETITION_DEFAULT_STATUS,
      pendingReason: petition.pendingReason || '',
      area: petition.area || '',
    });
  }, [petition, reset]);

  // Cliente/processo vindos da query string (link "Nova petição" a partir de
  // um processo) preenchem o form assim que os processos carregarem.
  useEffect(() => {
    if (isEditing || !initialProcessId) {
      return;
    }

    const selectedProcess = processes.find((process) => process.id === initialProcessId);
    if (!selectedProcess) {
      return;
    }

    setValue('clientId', selectedProcess.clientId);
    setValue('processId', selectedProcess.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProcessId, isEditing, processes]);

  const watchedClientId = watch('clientId');
  const watchedProcessId = watch('processId');
  const watchedStatus = watch('status');

  const clientOptions = [...clients].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  const processOptions = [...processes]
    .filter((process) => !watchedClientId || process.clientId === watchedClientId)
    .sort((left, right) => left.number.localeCompare(right.number, 'pt-BR'));
  const responsibleOptions = sortedUnique([
    ...users.map((user) => user.name),
    ...petitions.map((item) => item.responsible),
  ]);

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

  async function onSubmit(data) {
    const selectedProcess = processes.find((process) => process.id === data.processId) || null;
    const savedPetition = await savePetition({
      id: petition?.id,
      clientId: data.clientId,
      processId: data.processId,
      processNumber: selectedProcess?.number || petition?.processNumber || '',
      type: data.type,
      adversary: data.adversary.trim(),
      responsible: data.responsible.trim(),
      driveLink: petition?.driveLink || '',
      pendingReason: data.pendingReason.trim(),
      area: selectedProcess?.area || data.area || '',
      status: data.status,
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

      <div className="grid gap-4">
        <section className="mb-2">
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to="/peticoes-contestacoes"
          >
            <ArrowLeft className="size-3.5" />
            Voltar para petições
          </Link>

          <p className="mt-3 font-serif text-3xl text-foreground">
            {isEditing ? 'Editar peça' : 'Nova peça'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Cadastro de petição ou contestação.</p>
        </section>

        {clientOptions.length ? (
          <Card>
            <CardContent className="py-5">
            <form className="petition-form" onSubmit={handleSubmit(onSubmit)}>
              <div className="form-grid">
                <Field id="petition-client" label="Cliente" className="span-2" error={errors.clientId?.message} required>
                  <Controller
                    name="clientId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        id="petition-client"
                        value={field.value}
                        onChange={(event) => {
                          const clientId = event.target.value;
                          const currentProcess = processes.find((process) => process.id === watchedProcessId);
                          field.onChange(clientId);
                          if (currentProcess?.clientId !== clientId) {
                            setValue('processId', '');
                          }
                        }}
                      >
                        <option value="">Selecione o cliente</option>
                        {clientOptions.map((client) => (
                          <option key={client.id} value={client.id}>{client.name}</option>
                        ))}
                      </Select>
                    )}
                  />
                </Field>

                <Field id="petition-process" label="Processo vinculado" className="span-2" error={errors.processId?.message} required>
                  <Controller
                    name="processId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        id="petition-process"
                        value={field.value}
                        onChange={(event) => {
                          const processId = event.target.value;
                          const selectedProcess = processes.find((process) => process.id === processId) || null;
                          field.onChange(processId);
                          if (selectedProcess?.clientId) {
                            setValue('clientId', selectedProcess.clientId);
                          }
                          setValue('area', selectedProcess?.area || '');
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
                      </Select>
                    )}
                  />
                </Field>

                <Field id="petition-type" label="Tipo de peça" error={errors.type?.message} required>
                  <Select id="petition-type" {...register('type')}>
                    {PETITION_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </Field>

                <Field id="petition-adversary" label="Adverso" error={errors.adversary?.message} required>
                  <input id="petition-adversary" {...register('adversary')} />
                </Field>

                <Field id="petition-responsible" label="Responsável pela ação" error={errors.responsible?.message} required>
                  <Select id="petition-responsible" {...register('responsible')}>
                    <option value="">Selecione o responsável</option>
                    {responsibleOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </Field>

                <Field id="petition-status" label="Status" error={errors.status?.message}>
                  <Select id="petition-status" {...register('status')}>
                    {PETITION_STATUS_COLUMNS.map((column) => (
                      <option key={column.key} value={column.label}>{column.label}</option>
                    ))}
                  </Select>
                </Field>

                {/* Motivo da pendência só faz sentido até o protocolo; some a partir daí. */}
                {!['protocolar', 'protocolado'].includes(petitionColumnKey({ status: watchedStatus })) ? (
                  <Field id="petition-pending-reason" label="Pendente: qual motivo?" className="span-2" error={errors.pendingReason?.message}>
                    <textarea id="petition-pending-reason" rows="6" {...register('pendingReason')} />
                  </Field>
                ) : null}
              </div>

              <div className="form-actions">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar peça' : 'Salvar peça'}
                </Button>
                {isEditing ? (
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    type="button"
                    onClick={handleDelete}
                  >
                    Excluir
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link to="/peticoes-contestacoes">Cancelar</Link>
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum cliente cadastrado."
              copy="Cadastre um cliente antes de criar uma petição ou contestação."
              actions={<Link className="btn" to="/clientes/novo">Novo cliente</Link>}
            />
          </section>
        )}

        {isEditing && watchedClientId ? (
          <PetitionFolderFiles
            key={`${watchedClientId}:${watchedProcessId}`}
            clientId={watchedClientId}
            process={processes.find((process) => process.id === watchedProcessId) || null}
          />
        ) : null}
      </div>
    </>
  );
}
