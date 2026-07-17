import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { Select } from '../components/select';
import { EmptyState, Field, NotFoundState } from './common';
import {
  DEADLINE_DEFAULT_STATUS,
  buildDeadlineTitle,
  dateInputValue,
  deadlineMoment,
} from './deadlines-utils';

const deadlineSchema = z.object({
  processId: z.string().min(1, 'Selecione o processo.'),
  responsible: z.string().min(1, 'Informe o responsável.'),
  description: z.string(),
});

export function DeadlineFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const isEditing = Boolean(params.deadlineId);
  const {
    deleteDeadline,
    deadlines,
    isDeadlinesLoading,
    processes,
    saveDeadline,
    users,
  } = useAppState();
  const deadline = deadlines.find((item) => item.id === params.deadlineId) || null;
  const initialDate = dateInputValue(searchParams.get('data') || new Date());
  const [date] = useState(() => (deadline ? dateInputValue(deadlineMoment(deadline)) : initialDate));

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(deadlineSchema),
    defaultValues: {
      processId: deadline?.processId || '',
      responsible: deadline?.responsible || '',
      description: deadline?.description || '',
    },
  });

  // defaultValues só é lido no primeiro render do useForm — quando o prazo
  // chega depois (fetch assíncrono), precisa de reset() explícito.
  useEffect(() => {
    if (!deadline) return;
    reset({
      processId: deadline.processId || '',
      responsible: deadline.responsible || '',
      description: deadline.description || '',
    });
  }, [deadline, reset]);

  if (isEditing && !deadline) {
    if (isDeadlinesLoading) {
      return null;
    }

    return <NotFoundState title="Prazo não encontrado." />;
  }

  const watchedProcessId = watch('processId');
  const watchedResponsible = watch('responsible');
  const selectedProcess = processes.find((process) => process.id === watchedProcessId) || null;
  const selectedResponsible = users.find((user) => user.id === watchedResponsible) || null;
  const generatedTitle = buildDeadlineTitle(selectedProcess, selectedResponsible?.name || '');

  async function onSubmit(data) {
    const process = processes.find((item) => item.id === data.processId) || null;
    const responsibleUser = users.find((user) => user.id === data.responsible) || null;
    const responsibleName = responsibleUser?.name || '';
    const savedDeadline = await saveDeadline({
      id: deadline?.id,
      title: buildDeadlineTitle(process, responsibleName),
      priority: deadline?.priority || 'Alta',
      date,
      clientId: process?.clientId || '',
      processId: data.processId,
      responsible: data.responsible,
      responsibleName,
      status: deadline?.status || DEADLINE_DEFAULT_STATUS,
      description: data.description.trim(),
      notes: deadline?.notes || '',
      completed: deadline?.completed || false,
      elapsedSeconds: deadline?.elapsedSeconds || 0,
      timerStartedAt: deadline?.timerStartedAt || '',
      createdBy: deadline?.createdBy || responsibleName || 'Interno',
    });

    if (!savedDeadline) {
      return;
    }

    navigate(`/prazos?data=${encodeURIComponent(date)}`, { replace: true });
  }

  async function handleDelete() {
    if (!deadline) {
      return;
    }

    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O prazo "${generatedTitle || deadline.title}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deleteDeadline(deadline.id);
    if (wasDeleted) {
      navigate(`/prazos?data=${encodeURIComponent(date)}`, { replace: true });
    }
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar prazo' : 'Novo prazo'} />
      {confirmPopup}

      <div className="grid gap-4">
        <section className="mb-2">
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to={`/prazos?data=${encodeURIComponent(date)}`}
          >
            <ArrowLeft className="size-3.5" />
            Voltar para prazos
          </Link>

          <p className="mt-3 font-serif text-3xl text-foreground">
            {isEditing ? 'Editar prazo' : 'Novo prazo'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Preencha os campos do prazo.</p>
        </section>

        {processes.length ? (
          <Card>
            <CardContent className="py-5">
            <form className="deadline-task-form" onSubmit={handleSubmit(onSubmit)}>
              <div className="deadline-generated-name">
                <span>Nome do prazo</span>
                <strong>{generatedTitle || 'Selecione processo e responsável'}</strong>
              </div>

              <div className="form-grid">
                <Field id="deadline-process" label="Processo" className="span-2" error={errors.processId?.message} required>
                  <Select id="deadline-process" {...register('processId')}>
                    <option value="">Selecione o processo</option>
                    {processes.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.number}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field id="deadline-responsible" label="Responsável" className="span-2" error={errors.responsible?.message} required>
                  <Select id="deadline-responsible" {...register('responsible')}>
                    <option value="">Selecione o responsável</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field id="deadline-description" label="Descrição opcional" className="span-2" error={errors.description?.message}>
                  <textarea id="deadline-description" rows="6" {...register('description')} />
                </Field>
              </div>

              <div className="form-actions">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando…' : isEditing ? 'Atualizar prazo' : 'Salvar prazo'}
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
                  <Link to={`/prazos?data=${encodeURIComponent(date)}`}>Cancelar</Link>
                </Button>
              </div>
            </form>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="Nenhum processo cadastrado."
            copy="Cadastre um processo antes de criar uma tarefa de prazo."
            actions={<Link className="btn" to="/processos/novo">Novo processo</Link>}
          />
        )}
      </div>
    </>
  );
}
