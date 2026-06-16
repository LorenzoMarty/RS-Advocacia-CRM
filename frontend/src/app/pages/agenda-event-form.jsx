import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { PageChrome } from "../layout";
import { Select } from "../components/select";
import { useAppState } from "../store";
import {
  formatDateTimeInput,
  parseDateTimeInput,
} from "../utils";
import {
  EVENT_PRIORITY_OPTIONS,
  EVENT_STATUS_OPTIONS,
  EVENT_TYPE_OPTIONS,
} from "../data";
import {
  Field,
  NotFoundState,
} from "./common";
import {
  validateEventForm,
  dateQueryToDateTimeInput,
  safeReturnPath,
} from "./agenda-utils";

export function EventFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.eventId);
  const { clients, events, isEventsLoading, processes, saveEvent, users } = useAppState();
  const eventItem = events.find((item) => item.id === params.eventId) || null;
  const initialClientId = searchParams.get("cliente") || "";
  const initialProcessId = searchParams.get("processo") || "";
  const requestedType = searchParams.get("tipo") || "";
  const requestedStatus = searchParams.get("status") || "";
  const allEventTypes = [...new Set([...EVENT_TYPE_OPTIONS, ...events.map((e) => e.type).filter(Boolean)])];
  const initialType = requestedType || "";
  const initialStatus = EVENT_STATUS_OPTIONS.includes(requestedStatus) ? requestedStatus : "";
  const initialDate = searchParams.get("data") || "";
  const returnTo = safeReturnPath(searchParams.get("voltar") || "");
  const [form, setForm] = useState(() => ({
    id: eventItem?.id || "",
    title: eventItem?.title || "",
    type: eventItem?.type || initialType || EVENT_TYPE_OPTIONS[0],
    priority: eventItem?.priority || EVENT_PRIORITY_OPTIONS[0],
    start: eventItem ? formatDateTimeInput(eventItem.start) : dateQueryToDateTimeInput(initialDate),
    end: eventItem ? formatDateTimeInput(eventItem.end) : dateQueryToDateTimeInput(initialDate),
    reminderAt: eventItem ? formatDateTimeInput(eventItem.reminderAt) : "",
    clientId: eventItem?.clientId || initialClientId,
    processId: eventItem?.processId || initialProcessId,
    responsible: eventItem?.responsible || "",
    status: eventItem?.status || initialStatus || EVENT_STATUS_OPTIONS[0],
    location: eventItem?.location || "",
    description: eventItem?.description || "",
    notes: eventItem?.notes || "",
    completed: eventItem?.completed || false,
  }));
  const [errors, setErrors] = useState({});
  const [typeMode, setTypeMode] = useState(() =>
    allEventTypes.includes(eventItem?.type || initialType || EVENT_TYPE_OPTIONS[0]) ? 'select' : 'custom',
  );

  useEffect(() => {
    if (!eventItem) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      id: eventItem.id || "",
      title: eventItem.title || "",
      type: eventItem.type || EVENT_TYPE_OPTIONS[0],
      priority: eventItem.priority || EVENT_PRIORITY_OPTIONS[0],
      start: formatDateTimeInput(eventItem.start),
      end: formatDateTimeInput(eventItem.end),
      reminderAt: formatDateTimeInput(eventItem.reminderAt),
      clientId: eventItem.clientId || "",
      processId: eventItem.processId || "",
      responsible: eventItem.responsible || "",
      status: eventItem.status || EVENT_STATUS_OPTIONS[0],
      location: eventItem.location || "",
      description: eventItem.description || "",
      notes: eventItem.notes || "",
      completed: eventItem.completed || false,
    });
    setTypeMode(allEventTypes.includes(eventItem.type || '') ? 'select' : 'custom');
  }, [eventItem]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableProcesses = processes.filter(
    (process) => !form.clientId || process.clientId === form.clientId,
  );

  if (isEditing && !eventItem) {
    if (isEventsLoading) {
      return null;
    }

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

    const responsibleUser = users.find((user) => user.id === form.responsible);
    const responsibleName = responsibleUser?.name || "";

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
      responsible: form.responsible,
      responsibleName,
      status: form.status,
      location: form.location.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      completed: form.completed,
      createdBy:
        eventItem?.createdBy ||
        responsibleName ||
        users[0]?.name ||
        "Interno",
    });

    if (!savedEvent) {
      return;
    }

    navigate(returnTo || `/agenda/${savedEvent.id || form.id}`, { replace: true });
  }

  const formTitle = isEditing ? "Editar compromisso" : "Novo compromisso";
  const backTarget = isEditing ? `/agenda/${eventItem.id}` : returnTo || "/agenda";
  const backLabel = isEditing
    ? "Voltar para o compromisso"
    : "Voltar para agenda";

  return (
    <>
      <PageChrome label={formTitle} />

      <div className="event-create-page">
        <section className="surface event-intro">
          <div className="intro-grid">
            <Link
              className="intro-link"
              to={backTarget}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              {backLabel}
            </Link>

            <div>
              <h1 className="intro-title">
                {formTitle}
              </h1>
              <p className="intro-note">
                {isEditing
                  ? "Ajuste o agendamento e mantenha os vínculos essenciais atualizados."
                  : "Cadastro direto, com foco em agendamento e vínculos essenciais."}
              </p>
            </div>
          </div>
        </section>

        <section className="surface event-form-panel">
          <form className="event-form" onSubmit={handleSubmit}>
            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Identificação</h2>
                <p className="section-copy">
                  Defina o compromisso e o enquadramento básico.
                </p>
              </div>

              <div className="form-grid">
                <Field
                  id="event-title"
                  label="Título"
                  className="span-2"
                  error={errors.title}
                >
                  <input
                    id="event-title"
                    value={form.title}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        title: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id="event-type"
                  label="Tipo de compromisso"
                  error={errors.type}
                >
                  {typeMode === 'custom' ? (
                    <div className="type-combo">
                      <input
                        id="event-type"
                        value={form.type}
                        placeholder="Ex: Perícia, Diligência..."
                        autoFocus
                        onChange={(e) =>
                          setForm((f) => ({ ...f, type: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="type-combo-back"
                        onClick={() => {
                          setTypeMode('select');
                          setForm((f) => ({ ...f, type: allEventTypes[0] || EVENT_TYPE_OPTIONS[0] }));
                        }}
                      >
                        ← Selecionar
                      </button>
                    </div>
                  ) : (
                    <Select
                      id="event-type"
                      value={form.type}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setTypeMode('custom');
                          setForm((f) => ({ ...f, type: '' }));
                        } else {
                          setForm((f) => ({ ...f, type: e.target.value }));
                        }
                      }}
                    >
                      <option value="">Selecione o tipo</option>
                      {allEventTypes.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                      <option value="__custom__">+ Digitar novo tipo...</option>
                    </Select>
                  )}
                </Field>

                <Field
                  id="event-priority"
                  label="Prioridade"
                  error={errors.priority}
                >
                  <Select
                    id="event-priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        priority: event.target.value,
                      }))
                    }
                  >
                    {EVENT_PRIORITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Agendamento</h2>
                <p className="section-copy">
                  Início e encerramento em um fluxo simples e objetivo.
                </p>
              </div>

              <div className="form-grid">
                <Field id="event-start" label="Início" error={errors.start}>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={form.start}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        start: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field id="event-end" label="Fim" error={errors.end}>
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={form.end}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        end: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id="event-reminder"
                  label="Lembrete"
                  error={errors.reminderAt}
                >
                  <input
                    id="event-reminder"
                    type="datetime-local"
                    value={form.reminderAt}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        reminderAt: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Vínculos</h2>
                <p className="section-copy">
                  Associe cliente, processo e responsável direto.
                </p>
              </div>

              <div className="form-grid">
                <Field
                  id="event-client"
                  label="Cliente"
                  error={errors.clientId}
                >
                  <Select
                    id="event-client"
                    value={form.clientId}
                    onChange={(event) => {
                      const nextClientId = event.target.value;
                      setForm((currentForm) => ({
                        ...currentForm,
                        clientId: nextClientId,
                        processId:
                          currentForm.processId &&
                          processes.some(
                            (process) =>
                              process.id === currentForm.processId &&
                              process.clientId === nextClientId,
                          )
                            ? currentForm.processId
                            : "",
                      }));
                    }}
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  id="event-process"
                  label="Processo"
                  error={errors.processId}
                >
                  <Select
                    id="event-process"
                    value={form.processId}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        processId: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {form.clientId && !availableProcesses.length
                        ? "Nenhum processo deste cliente"
                        : "Selecione o processo"}
                    </option>
                    {availableProcesses.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.number}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  id="event-responsible"
                  label="Responsável"
                  error={errors.responsible}
                >
                  <Select
                    id="event-responsible"
                    value={form.responsible}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        responsible: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione o responsável</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-headline">
                <h2 className="section-kicker">Contexto</h2>
                <p className="section-copy">
                  Informações de apoio para a execução do compromisso.
                </p>
              </div>

              <div className="form-grid">
                <Field
                  id="event-location"
                  label="Local"
                  className="span-2"
                  error={errors.location}
                >
                  <input
                    id="event-location"
                    value={form.location}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        location: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field
                  id="event-description"
                  label="Descrição"
                  className="span-2"
                  error={errors.description}
                >
                  <textarea
                    id="event-description"
                    rows="5"
                    value={form.description}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        description: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            </section>

            <div className="form-actions">
              <button className="btn" type="submit">
                {isEditing ? "Atualizar" : "Salvar"}
              </button>
              <Link
                className="btn btn-secondary"
                to={isEditing ? `/agenda/${eventItem.id}` : "/agenda"}
              >
                Cancelar
              </Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
