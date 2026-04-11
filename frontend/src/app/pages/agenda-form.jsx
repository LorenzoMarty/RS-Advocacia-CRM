import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { PageChrome } from '../layout';
import { EVENT_PRIORITY_OPTIONS, EVENT_STATUS_OPTIONS, EVENT_TYPE_OPTIONS } from '../data';
import { useAppState } from '../store';
import { formatDateTimeInput, parseDateTimeInput } from '../utils';
import { Field, NotFoundState } from './common';

function validateEventForm(form) {
  const nextErrors = {};

  if (!form.title.trim()) nextErrors.title = 'Informe o título.';
  if (!form.type) nextErrors.type = 'Selecione o tipo.';
  if (!form.priority) nextErrors.priority = 'Selecione a prioridade.';
  if (!form.start) nextErrors.start = 'Informe a data de início.';
  if (!form.end) nextErrors.end = 'Informe a data de fim.';
  if (!form.clientId) nextErrors.clientId = 'Selecione um cliente.';
  if (!form.processId) nextErrors.processId = 'Selecione um processo.';
  if (!form.responsible.trim()) nextErrors.responsible = 'Informe o responsável.';
  if (!form.status) nextErrors.status = 'Selecione o status.';
  if (form.start && form.end && new Date(form.end) < new Date(form.start)) {
    nextErrors.end = 'O fim deve ser posterior ao início.';
  }

  return nextErrors;
}

export function EventFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.eventId);
  const { clients, events, processes, saveEvent, users } = useAppState();
  const eventItem = events.find((item) => item.id === params.eventId) || null;
  const initialClientId = searchParams.get('cliente') || '';
  const initialProcessId = searchParams.get('processo') || '';
  const [form, setForm] = useState(() => ({
    id: eventItem?.id || '',
    title: eventItem?.title || '',
    type: eventItem?.type || EVENT_TYPE_OPTIONS[0],
    priority: eventItem?.priority || EVENT_PRIORITY_OPTIONS[0],
    start: eventItem ? formatDateTimeInput(eventItem.start) : '',
    end: eventItem ? formatDateTimeInput(eventItem.end) : '',
    reminderAt: eventItem ? formatDateTimeInput(eventItem.reminderAt) : '',
    clientId: eventItem?.clientId || initialClientId,
    processId: eventItem?.processId || initialProcessId,
    responsible: eventItem?.responsible || '',
    status: eventItem?.status || '',
    location: eventItem?.location || '',
    description: eventItem?.description || '',
    notes: eventItem?.notes || '',
    completed: eventItem?.completed || false,
  }));
  const [errors, setErrors] = useState({});

  const availableProcesses = processes.filter((process) => !form.clientId || process.clientId === form.clientId);

  if (isEditing && !eventItem) {
    return <NotFoundState title="Compromisso não encontrado." />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateEventForm({
      ...form,
      start: parseDateTimeInput(form.start),
      end: parseDateTimeInput(form.end),
    });

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedEvent = await saveEvent({
      id: form.id || undefined,
      title: form.title.trim(),
      type: form.type,
      priority: form.priority,
      start: parseDateTimeInput(form.start),
      end: parseDateTimeInput(form.end),
      reminderAt: parseDateTimeInput(form.reminderAt),
      clientId: form.clientId,
      processId: form.processId,
      responsible: form.responsible.trim(),
      status: form.status,
      location: form.location.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      completed: form.completed,
      createdBy: eventItem?.createdBy || form.responsible.trim() || users[0]?.name || 'Interno',
    });

    if (!savedEvent) {
      return;
    }

    navigate(`/agenda/${savedEvent.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar compromisso' : 'Novo compromisso'} />

      <div className="event-create-page">
        <section className="surface event-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={isEditing ? `/agenda/${eventItem.id}` : '/agenda'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {isEditing ? 'Voltar para o compromisso' : 'Voltar para agenda'}
            </Link>

            <div>
              <h1 className="intro-title">{isEditing ? 'Editar compromisso' : 'Novo compromisso'}</h1>
              <p className="intro-note">
                {isEditing ? 'Ajuste o agendamento e mantenha os vínculos essenciais atualizados.' : 'Cadastro direto, com foco em agendamento e vínculos essenciais.'}
              </p>
            </div>
          </div>
        </section>

        <section className="surface event-form-panel">
          <form className="event-form" onSubmit={handleSubmit}>
            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Identificação</h2>
                <p className="section-copy">Defina o compromisso e o enquadramento básico.</p>
              </div>

              <div className="form-grid">
                <Field id="event-title" label="Título" className="span-2" error={errors.title}>
                  <input id="event-title" value={form.title} onChange={(event) => setForm((currentForm) => ({ ...currentForm, title: event.target.value }))} />
                </Field>

                <Field id="event-type" label="Tipo de compromisso" error={errors.type}>
                  <select id="event-type" value={form.type} onChange={(event) => setForm((currentForm) => ({ ...currentForm, type: event.target.value }))}>
                    {EVENT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>

                <Field id="event-priority" label="Prioridade" error={errors.priority}>
                  <select id="event-priority" value={form.priority} onChange={(event) => setForm((currentForm) => ({ ...currentForm, priority: event.target.value }))}>
                    {EVENT_PRIORITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Agendamento</h2>
                <p className="section-copy">Início e encerramento em um fluxo simples e objetivo.</p>
              </div>

              <div className="form-grid">
                <Field id="event-start" label="Início" error={errors.start}>
                  <input id="event-start" type="datetime-local" value={form.start} onChange={(event) => setForm((currentForm) => ({ ...currentForm, start: event.target.value }))} />
                </Field>

                <Field id="event-end" label="Fim" error={errors.end}>
                  <input id="event-end" type="datetime-local" value={form.end} onChange={(event) => setForm((currentForm) => ({ ...currentForm, end: event.target.value }))} />
                </Field>

                <Field id="event-reminder" label="Lembrete" error={errors.reminderAt}>
                  <input id="event-reminder" type="datetime-local" value={form.reminderAt} onChange={(event) => setForm((currentForm) => ({ ...currentForm, reminderAt: event.target.value }))} />
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Vínculos</h2>
                <p className="section-copy">Associe cliente, processo e responsável direto.</p>
              </div>

              <div className="form-grid">
                <Field id="event-client" label="Cliente" error={errors.clientId}>
                  <select
                    id="event-client"
                    value={form.clientId}
                    onChange={(event) => {
                      const nextClientId = event.target.value;
                      setForm((currentForm) => ({
                        ...currentForm,
                        clientId: nextClientId,
                        processId: currentForm.processId && processes.some((process) => process.id === currentForm.processId && process.clientId === nextClientId)
                          ? currentForm.processId
                          : '',
                      }));
                    }}
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </Field>

                <Field id="event-process" label="Processo" error={errors.processId}>
                  <select id="event-process" value={form.processId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, processId: event.target.value }))}>
                    <option value="">{form.clientId && !availableProcesses.length ? 'Nenhum processo deste cliente' : 'Selecione o processo'}</option>
                    {availableProcesses.map((process) => <option key={process.id} value={process.id}>{process.number}</option>)}
                  </select>
                </Field>

                <Field id="event-responsible" label="Responsável" error={errors.responsible}>
                  <select id="event-responsible" value={form.responsible} onChange={(event) => setForm((currentForm) => ({ ...currentForm, responsible: event.target.value }))}>
                    <option value="">Selecione o responsável</option>
                    {users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
                  </select>
                </Field>

                <Field id="event-status" label="Status" error={errors.status}>
                  <select id="event-status" value={form.status} onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value }))}>
                    <option value="">Selecione o status</option>
                    {EVENT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Contexto</h2>
                <p className="section-copy">Informações de apoio para a execução do compromisso.</p>
              </div>

              <div className="form-grid">
                <Field id="event-location" label="Local" className="span-2" error={errors.location}>
                  <input id="event-location" value={form.location} onChange={(event) => setForm((currentForm) => ({ ...currentForm, location: event.target.value }))} />
                </Field>

                <Field id="event-description" label="Descrição" className="span-2" error={errors.description}>
                  <textarea id="event-description" rows="5" value={form.description} onChange={(event) => setForm((currentForm) => ({ ...currentForm, description: event.target.value }))} />
                </Field>

                <Field id="event-notes" label="Observações" className="span-2" error={errors.notes}>
                  <textarea id="event-notes" rows="5" value={form.notes} onChange={(event) => setForm((currentForm) => ({ ...currentForm, notes: event.target.value }))} />
                </Field>
              </div>
            </section>

            <div className="form-actions">
              <button className="btn" type="submit">{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to={isEditing ? `/agenda/${eventItem.id}` : '/agenda'}>Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
