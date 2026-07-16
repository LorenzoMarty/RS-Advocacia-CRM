import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

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

      <div className="deadline-form-page">
        <section className="surface deadline-form-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={`/prazos?data=${encodeURIComponent(date)}`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para prazos
            </Link>

            <div>
              <h1 className="intro-title">{isEditing ? 'Editar prazo' : 'Novo prazo'}</h1>
              <p className="intro-note">Preencha os campos do prazo.</p>
            </div>
          </div>
        </section>

        {processes.length ? (
          <section className="surface deadline-form-panel">
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
                <button className="btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar prazo' : 'Salvar prazo'}
                </button>
                {isEditing ? (
                  <button className="btn btn-danger" type="button" onClick={handleDelete}>
                    Excluir
                  </button>
                ) : null}
                <Link className="btn btn-secondary" to={`/prazos?data=${encodeURIComponent(date)}`}>
                  Cancelar
                </Link>
              </div>
            </form>
          </section>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum processo cadastrado."
              copy="Cadastre um processo antes de criar uma tarefa de prazo."
              actions={<Link className="btn" to="/processos/novo">Novo processo</Link>}
            />
          </section>
        )}
      </div>
    </>
  );
}
