import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { api } from "../api";
import { PageChrome, StatusBadge } from "../layout";
import { useAppState } from "../store";
import {
  buildSearchText,
  formatCount,
  formatDate,
  formatTime,
  getEventTypeKey,
  getStatusTone,
  isOverdueEvent,
  isSameDay,
  normalizeText,
  startOfDay,
  formatDateTimeInput,
  parseDateTimeInput,
  formatDateTime,
} from "../utils";
import {
  EVENT_PRIORITY_OPTIONS,
  EVENT_STATUS_OPTIONS,
  EVENT_TYPE_OPTIONS,
} from "../data";
import { Field, NotFoundState } from "./common";

function monthLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function calendarDays(viewDate, events) {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1 - startOffset,
  );
  const rows = [];

  for (let index = 0; index < 42; index += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    rows.push({
      key: `${cellDate.toISOString()}-${index}`,
      date: cellDate,
      events: events.filter((event) => isSameDay(event.start, cellDate)),
    });
  }

  return rows;
}

function RailList({ events, clients, processes, emptyTitle, emptyCopy }) {
  if (!events.length) {
    return (
      <div className="side-list">
        <div className="empty">
          <strong>{emptyTitle}</strong>
          <p>{emptyCopy}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="side-list">
      {events.map((event) => (
        <Link key={event.id} className="side-item" to={`/agenda/${event.id}`}>
          <div className="side-top">
            <div>
              <h3 className="side-title">{event.title}</h3>
              <p className="side-time">
                {formatDate(event.start)} • {formatTime(event.start)}
              </p>
            </div>
            <StatusBadge tone={getStatusTone(event.status, event.completed)}>
              {event.status || "Ativo"}
            </StatusBadge>
          </div>
          <div className="side-meta">
            {event.type ? (
              <span className="meta-chip">{event.type}</span>
            ) : null}
            {event.responsible ? (
              <span className="meta-chip">{event.responsible}</span>
            ) : null}
            {event.clientId ? (
              <span className="meta-chip">
                {clients.find((client) => client.id === event.clientId)?.name}
              </span>
            ) : null}
            {event.processId ? (
              <span className="meta-chip">
                {
                  processes.find((process) => process.id === event.processId)
                    ?.number
                }
              </span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AgendaListPage() {
  const { addFlash, clients, currentUser, events, processes } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [responsible, setResponsible] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const typeOptions = [
    ...new Set(events.map((event) => event.type).filter(Boolean)),
  ];
  const responsibleOptions = [
    ...new Set(events.map((event) => event.responsible).filter(Boolean)),
  ];
  const statusOptions = [
    ...new Set(events.map((event) => event.status).filter(Boolean)),
  ];
  const today = new Date();
  const todayStart = startOfDay(today);
  const nextWeek = new Date(todayStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const filteredEvents = [...events]
    .filter((event) => {
      const haystack = buildSearchText([
        event.title,
        clients.find((client) => client.id === event.clientId)?.name,
        processes.find((process) => process.id === event.processId)?.number,
        event.type,
        event.status,
        event.responsible,
      ]);

      if (search && !haystack.includes(normalizeText(search))) return false;
      if (eventType && normalizeText(event.type) !== normalizeText(eventType))
        return false;
      if (
        responsible &&
        normalizeText(event.responsible) !== normalizeText(responsible)
      )
        return false;
      if (status && normalizeText(event.status) !== normalizeText(status))
        return false;
      if (period === "today" && !isSameDay(event.start, today)) return false;
      if (
        period === "week" &&
        (new Date(event.start) < todayStart || new Date(event.start) > nextWeek)
      )
        return false;
      if (
        period === "month" &&
        (new Date(event.start).getMonth() !== today.getMonth() ||
          new Date(event.start).getFullYear() !== today.getFullYear())
      )
        return false;
      return true;
    })
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  const todayEvents = filteredEvents.filter((event) =>
    isSameDay(event.start, today),
  );
  const upcomingEvents = filteredEvents
    .filter(
      (event) =>
        new Date(event.start) > new Date(todayStart.getTime() + 86400000),
    )
    .slice(0, 6);
  const overdueEvents = filteredEvents
    .filter((event) => isOverdueEvent(event))
    .slice(0, 6);
  const days = calendarDays(viewDate, filteredEvents);
  const googleCalendarStatus = searchParams.get("google_calendar") || "";
  const googleCalendarError = searchParams.get("google_error") || "";
  const googleCalendarFeedbackKey = googleCalendarStatus
    ? `status:${googleCalendarStatus}`
    : googleCalendarError
      ? `error:${googleCalendarError}`
      : "";
  const googleCalendarDestination =
    currentUser?.googleCalendarDestination || "agenda principal do Google";
  const handledGoogleCalendarFeedbackRef = useRef("");

  useEffect(() => {
    if (!googleCalendarFeedbackKey) {
      handledGoogleCalendarFeedbackRef.current = "";
      return;
    }

    if (
      handledGoogleCalendarFeedbackRef.current === googleCalendarFeedbackKey
    ) {
      return;
    }

    handledGoogleCalendarFeedbackRef.current = googleCalendarFeedbackKey;

    if (googleCalendarStatus === "connected") {
      addFlash("Google Calendar conectado. Novos compromissos podem ser sincronizados.", "success");
    } else if (googleCalendarError) {
      addFlash(googleCalendarError, "error");
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("google_calendar");
    nextSearchParams.delete("google_error");
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    addFlash,
    googleCalendarError,
    googleCalendarFeedbackKey,
    googleCalendarStatus,
    searchParams,
    setSearchParams,
  ]);

  return (
    <>
      <PageChrome label="Agenda" />

      <div className="agenda-page">
        <section className="surface agenda-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Agenda</h1>
              <p className="section-note">Gerencie seus compromissos</p>
            </div>
            <span className="badge gold">
              {formatCount(filteredEvents.length)}
            </span>
          </div>

          <div className="agenda-toolbar">
            <div className="toolbar-main">
              <label
                className="toolbar-search"
                aria-label="Buscar compromissos"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  placeholder="Buscar"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="toolbar-filters">
                <select
                  className="filter-select"
                  aria-label="Filtrar por tipo"
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                >
                  <option value="">Tipo</option>
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  aria-label="Filtrar por responsável"
                  value={responsible}
                  onChange={(event) => setResponsible(event.target.value)}
                >
                  <option value="">Responsável</option>
                  {responsibleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  aria-label="Filtrar por status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">Status</option>
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  className="filter-select"
                  aria-label="Filtrar por período"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                >
                  <option value="">Período</option>
                  <option value="today">Hoje</option>
                  <option value="week">7 dias</option>
                  <option value="month">Mês</option>
                </select>
              </div>
            </div>

            <div className="toolbar-side">
              <div className="toolbar-sync">
                <span
                  className={`status-badge ${currentUser?.googleCalendarConnected ? "success" : "warn"}`}
                >
                  {currentUser?.googleCalendarConnected
                    ? "Google Calendar conectado"
                    : "Google Calendar pendente"}
                </span>
                <p className="toolbar-sync-copy">
                  {currentUser?.googleCalendarConnected
                    ? `Novos compromissos serao enviados para ${googleCalendarDestination}.`
                    : `Conecte o Google Calendar para enviar os compromissos para ${googleCalendarDestination}.`}
                </p>
              </div>

              <div className="toolbar-actions">
                <a className="btn btn-secondary" href={api.urlConectarGoogleCalendar()}>
                  {currentUser?.googleCalendarConnected
                    ? "Reconectar Google Calendar"
                    : "Conectar Google Calendar"}
                </a>
                <Link className="btn" to="/agenda/novo">
                  Novo
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="agenda-layout">
          <section className="surface calendar-panel">
            <div className="calendar-top">
              <div>
                <h2 className="section-title">Calendário</h2>
                <p className="section-note">Visão mensal</p>
              </div>

              <div className="calendar-controls">
                <button
                  className="icon-control"
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() =>
                    setViewDate(
                      (currentDate) =>
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() - 1,
                          1,
                        ),
                    )
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className="calendar-month">{monthLabel(viewDate)}</div>
                <button
                  className="icon-control"
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() =>
                    setViewDate(
                      (currentDate) =>
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() + 1,
                          1,
                        ),
                    )
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="calendar-legend">
              <span className="legend-chip legend-chip-audiencia">
                Audiência
              </span>
              <span className="legend-chip legend-chip-reuniao">Reunião</span>
              <span className="legend-chip legend-chip-prazo">Prazo</span>
              <span className="legend-chip legend-chip-tarefa">Tarefa</span>
            </div>

            <div className="calendar-frame">
              <div className="calendar-weekdays">
                <span>Seg</span>
                <span>Ter</span>
                <span>Qua</span>
                <span>Qui</span>
                <span>Sex</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>

              <div className="calendar-days">
                {days.map((day) => (
                  <article
                    key={day.key}
                    className={`day-card${day.date.getMonth() !== viewDate.getMonth() ? " is-muted" : ""}${isSameDay(day.date, today) ? " is-today" : ""}${day.events.some((event) => isOverdueEvent(event)) ? " is-overdue" : ""}${day.events.length ? " has-events" : ""}`}
                  >
                    <div className="day-head">
                      <span className="day-number">{day.date.getDate()}</span>
                      <span className="day-dot" />
                    </div>

                    <div className="day-events">
                      {day.events.slice(0, 2).map((event) => (
                        <Link
                          key={event.id}
                          className={`calendar-event type-${getEventTypeKey(event.type)}${isOverdueEvent(event) ? " is-overdue" : ""}`}
                          to={`/agenda/${event.id}`}
                        >
                          <span className="calendar-event-time">
                            {formatTime(event.start)}
                          </span>
                          <strong className="calendar-event-title">
                            {event.title}
                          </strong>
                          <span className="calendar-event-context">
                            {clients.find(
                              (client) => client.id === event.clientId,
                            )?.name ||
                              processes.find(
                                (process) => process.id === event.processId,
                              )?.number ||
                              event.type ||
                              "Compromisso"}
                          </span>
                        </Link>
                      ))}
                      {day.events.length > 2 ? (
                        <span className="calendar-more">
                          +{day.events.length - 2} compromissos
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {!filteredEvents.length ? (
              <div className="empty calendar-empty">
                <strong>Sem compromissos.</strong>
                <p>Ajuste os filtros ou crie um novo registro.</p>
              </div>
            ) : null}
          </section>

          <aside className="agenda-rail">
            <section className="surface rail-panel">
              <div className="rail-sections">
                <div className="rail-block">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">Hoje</h2>
                      <p className="section-note">
                        {todayEvents.length
                          ? "Compromissos do dia"
                          : "Sem compromissos hoje"}
                      </p>
                    </div>
                  </div>
                  <RailList
                    events={todayEvents}
                    clients={clients}
                    processes={processes}
                    emptyTitle="Sem compromissos hoje."
                    emptyCopy="A agenda do dia aparece aqui."
                  />
                </div>

                <div className="rail-block">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">Próximos</h2>
                      <p className="section-note">
                        {upcomingEvents.length
                          ? "Em ordem cronológica"
                          : "Sem próximos compromissos"}
                      </p>
                    </div>
                  </div>
                  <RailList
                    events={upcomingEvents}
                    clients={clients}
                    processes={processes}
                    emptyTitle="Sem próximos compromissos."
                    emptyCopy="Os próximos registros aparecem aqui."
                  />
                </div>

                <div className="rail-block">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">Atrasados</h2>
                      <p className="section-note">
                        {overdueEvents.length
                          ? "Pedem atenção"
                          : "Nada em atraso"}
                      </p>
                    </div>
                  </div>
                  <RailList
                    events={overdueEvents}
                    clients={clients}
                    processes={processes}
                    emptyTitle="Sem atrasos."
                    emptyCopy="Nenhum compromisso vencido."
                  />
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function validateEventForm(form) {
  const nextErrors = {};

  if (!form.title.trim()) nextErrors.title = "Informe o título.";
  if (!form.type) nextErrors.type = "Selecione o tipo.";
  if (!form.priority) nextErrors.priority = "Selecione a prioridade.";
  if (!form.start) nextErrors.start = "Informe a data de início.";
  if (!form.end) nextErrors.end = "Informe a data de fim.";
  if (!form.clientId) nextErrors.clientId = "Selecione um cliente.";
  if (!form.processId) nextErrors.processId = "Selecione um processo.";
  if (!form.responsible.trim())
    nextErrors.responsible = "Informe o responsável.";
  if (!form.status) nextErrors.status = "Selecione o status.";
  if (form.start && form.end && new Date(form.end) < new Date(form.start)) {
    nextErrors.end = "O fim deve ser posterior ao início.";
  }

  return nextErrors;
}

export function EventFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.eventId);
  const { clients, events, isEventsLoading, processes, saveEvent, users } = useAppState();
  const eventItem = events.find((item) => item.id === params.eventId) || null;
  const initialClientId = searchParams.get("cliente") || "";
  const initialProcessId = searchParams.get("processo") || "";
  const [form, setForm] = useState(() => ({
    id: eventItem?.id || "",
    title: eventItem?.title || "",
    type: eventItem?.type || EVENT_TYPE_OPTIONS[0],
    priority: eventItem?.priority || EVENT_PRIORITY_OPTIONS[0],
    start: eventItem ? formatDateTimeInput(eventItem.start) : "",
    end: eventItem ? formatDateTimeInput(eventItem.end) : "",
    reminderAt: eventItem ? formatDateTimeInput(eventItem.reminderAt) : "",
    clientId: eventItem?.clientId || initialClientId,
    processId: eventItem?.processId || initialProcessId,
    responsible: eventItem?.responsible || "",
    status: eventItem?.status || "",
    location: eventItem?.location || "",
    description: eventItem?.description || "",
    notes: eventItem?.notes || "",
    completed: eventItem?.completed || false,
  }));
  const [errors, setErrors] = useState({});

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
      status: eventItem.status || "",
      location: eventItem.location || "",
      description: eventItem.description || "",
      notes: eventItem.notes || "",
      completed: eventItem.completed || false,
    });
  }, [eventItem]);

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
      createdBy:
        eventItem?.createdBy ||
        form.responsible.trim() ||
        users[0]?.name ||
        "Interno",
    });

    if (!savedEvent) {
      return;
    }

    navigate(`/agenda/${savedEvent.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome
        label={isEditing ? "Editar compromisso" : "Novo compromisso"}
      />

      <div className="event-create-page">
        <section className="surface event-intro">
          <div className="intro-grid">
            <Link
              className="intro-link"
              to={isEditing ? `/agenda/${eventItem.id}` : "/agenda"}
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
              {isEditing ? "Voltar para o compromisso" : "Voltar para agenda"}
            </Link>

            <div>
              <h1 className="intro-title">
                {isEditing ? "Editar compromisso" : "Novo compromisso"}
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
                  <select
                    id="event-type"
                    value={form.type}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        type: event.target.value,
                      }))
                    }
                  >
                    {EVENT_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id="event-priority"
                  label="Prioridade"
                  error={errors.priority}
                >
                  <select
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
                  </select>
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
                  <select
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
                  </select>
                </Field>

                <Field
                  id="event-process"
                  label="Processo"
                  error={errors.processId}
                >
                  <select
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
                  </select>
                </Field>

                <Field
                  id="event-responsible"
                  label="Responsável"
                  error={errors.responsible}
                >
                  <select
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
                      <option key={user.id} value={user.name}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="event-status" label="Status" error={errors.status}>
                  <select
                    id="event-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="">Selecione o status</option>
                    {EVENT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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

                <Field
                  id="event-notes"
                  label="Observações"
                  className="span-2"
                  error={errors.notes}
                >
                  <textarea
                    id="event-notes"
                    rows="5"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        notes: event.target.value,
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

export function EventDetailPage() {
  const params = useParams();
  const { clients, events, loadEvent, processes } = useAppState();
  const [remoteEvent, setRemoteEvent] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(true);
  const eventItem =
    remoteEvent ||
    events.find((item) => item.id === params.eventId) ||
    null;

  useEffect(() => {
    let isMounted = true;

    async function fetchEvent() {
      setIsDetailLoading(true);
      const eventData = await loadEvent(params.eventId);

      if (isMounted) {
        setRemoteEvent(eventData);
        setIsDetailLoading(false);
      }
    }

    fetchEvent();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.eventId]);

  if (!eventItem) {
    if (isDetailLoading) {
      return null;
    }

    return <NotFoundState title="Compromisso não encontrado." />;
  }

  const client = clients.find((item) => item.id === eventItem.clientId) || null;
  const process =
    processes.find((item) => item.id === eventItem.processId) || null;

  return (
    <>
      <PageChrome
        label="Compromisso"
        actions={
          <>
            <Link
              className="btn btn-secondary"
              to={`/agenda/${eventItem.id}/editar`}
            >
              Editar
            </Link>
            <Link
              className="btn btn-danger"
              to={`/agenda/${eventItem.id}/excluir`}
            >
              Excluir
            </Link>
          </>
        }
      />

      <div className="event-page">
        <section className="surface event-hero">
          <div className="crumbs">
            <Link to="/agenda">Agenda</Link>
          </div>

          <div className="event-hero-grid">
            <div className="event-identity">
              <div className="identity-row">
                <div className="event-mark" aria-hidden="true">
                  EV
                </div>
                <div>
                  <h1 className="event-title">{eventItem.title}</h1>
                  <p className="event-subtitle">
                    {formatDate(eventItem.start)} •{" "}
                    {formatTime(eventItem.start)} até{" "}
                    {formatTime(eventItem.end)}
                  </p>
                </div>
              </div>

              <aside className="hero-summary">
                <article className="summary-card summary-card-status">
                  <span>Status</span>
                  <StatusBadge
                    tone={getStatusTone(eventItem.status, eventItem.completed)}
                  >
                    {eventItem.completed ? "Concluído" : eventItem.status}
                  </StatusBadge>
                </article>

                <article className="summary-card">
                  <span>Cliente</span>
                  <strong>{client?.name || "Não vinculado"}</strong>
                </article>

                <article className="summary-card">
                  <span>Processo</span>
                  <strong>{process?.number || "Não vinculado"}</strong>
                </article>
              </aside>
            </div>
          </div>
        </section>

        <div className="event-layout">
          <div className="stack">
            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Informações</h2>
                  <p className="section-note">Essenciais</p>
                </div>
              </div>

              <div className="detail-grid">
                <article className="detail-item span-2">
                  <span>Título</span>
                  <strong>{eventItem.title}</strong>
                </article>
                <article className="detail-item">
                  <span>Tipo</span>
                  <strong>{eventItem.type || "-"}</strong>
                </article>
                <article className="detail-item">
                  <span>Responsável</span>
                  <strong>{eventItem.responsible || "-"}</strong>
                </article>
                <article className="detail-item">
                  <span>Início</span>
                  <strong>{formatDateTime(eventItem.start)}</strong>
                </article>
                <article className="detail-item">
                  <span>Fim</span>
                  <strong>{formatDateTime(eventItem.end)}</strong>
                </article>
                <article className="detail-item">
                  <span>Status</span>
                  <div className="detail-badge-wrap">
                    <StatusBadge
                      tone={getStatusTone(
                        eventItem.status,
                        eventItem.completed,
                      )}
                    >
                      {eventItem.status}
                    </StatusBadge>
                  </div>
                </article>
                <article className="detail-item">
                  <span>Prioridade</span>
                  <div className="detail-badge-wrap">
                    <StatusBadge
                      tone={getStatusTone(eventItem.priority)}
                      className="priority-badge"
                    >
                      {eventItem.priority || "-"}
                    </StatusBadge>
                  </div>
                </article>
                <article className="detail-item span-2">
                  <span>Local</span>
                  <strong>{eventItem.location || "Não informado"}</strong>
                </article>
              </div>
            </section>

            {eventItem.description || eventItem.notes ? (
              <section className="surface section-card">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Observações</h2>
                    <p className="section-note">Contexto</p>
                  </div>
                </div>

                <div className="note-box">
                  <div className="note-stack">
                    {eventItem.description ? (
                      <div className="note-block">
                        <strong>Descrição</strong>
                        <div>{eventItem.description}</div>
                      </div>
                    ) : null}
                    {eventItem.notes ? (
                      <div className="note-block">
                        <strong>Notas internas</strong>
                        <div>{eventItem.notes}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="stack">
            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Vínculos</h2>
                  <p className="section-note">Relacionados</p>
                </div>
              </div>

              <div className="stack">
                {client ? (
                  <Link className="link-card" to={`/clientes/${client.id}`}>
                    <div className="link-head">
                      <div className="link-mark" aria-hidden="true">
                        {client.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="link-title">{client.name}</h3>
                        <p className="link-copy">
                          Cliente vinculado ao compromisso.
                        </p>
                      </div>
                    </div>
                    <div className="link-meta">
                      {client.email ? (
                        <span className="meta-chip">{client.email}</span>
                      ) : null}
                      {client.phone ? (
                        <span className="meta-chip">{client.phone}</span>
                      ) : null}
                    </div>
                  </Link>
                ) : null}

                {process ? (
                  <Link className="link-card" to={`/processos/${process.id}`}>
                    <div className="link-head">
                      <div className="link-mark" aria-hidden="true">
                        PJ
                      </div>
                      <div>
                        <h3 className="link-title">{process.number}</h3>
                        <p className="link-copy">
                          {process.area || "Processo vinculado"}
                        </p>
                      </div>
                    </div>
                    <div className="link-meta">
                      {process.court ? (
                        <span className="meta-chip">{process.court}</span>
                      ) : null}
                      {process.owner ? (
                        <span className="meta-chip">{process.owner}</span>
                      ) : null}
                    </div>
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Resumo rápido</h2>
                  <p className="section-note">Leitura imediata</p>
                </div>
              </div>

              <div className="detail-grid">
                <article className="detail-item">
                  <span>Data</span>
                  <strong>{formatDate(eventItem.start)}</strong>
                </article>
                <article className="detail-item">
                  <span>Horário</span>
                  <strong>
                    {formatTime(eventItem.start)} - {formatTime(eventItem.end)}
                  </strong>
                </article>
                <article className="detail-item">
                  <span>Situação</span>
                  <strong>
                    {eventItem.completed ? "Encerrado" : "Em andamento"}
                  </strong>
                </article>
                <article className="detail-item">
                  <span>Origem</span>
                  <strong>{eventItem.createdBy || "Interno"}</strong>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export function EventDeletePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { deleteEvent, events, isEventsLoading } = useAppState();
  const eventItem = events.find((item) => item.id === params.eventId) || null;

  if (!eventItem) {
    if (isEventsLoading) {
      return null;
    }

    return <NotFoundState title="Compromisso não encontrado." />;
  }

  async function handleDelete(event) {
    event.preventDefault();
    const wasDeleted = await deleteEvent(eventItem.id);
    if (!wasDeleted) {
      return;
    }
    navigate("/agenda", { replace: true });
  }

  return (
    <>
      <PageChrome
        label="Excluir"
        actions={
          <Link className="btn btn-secondary" to={`/agenda/${eventItem.id}`}>
            Voltar
          </Link>
        }
      />

      <div className="confirm-page">
        <section className="surface confirm-intro">
          <div className="section-head">
            <div>
              <h1 className="confirm-title">Excluir compromisso</h1>
              <p className="confirm-copy">
                Revise o registro antes de confirmar. A exclusão remove este
                item do fluxo principal.
              </p>
            </div>
          </div>
        </section>

        <section className="surface confirm-panel">
          <div className="confirm-box">
            <div className="confirm-alert">
              <strong>Ação irreversível.</strong>
              <p>
                Depois da confirmação, este registro não poderá ser recuperado
                pela interface.
              </p>
            </div>

            <div className="confirm-meta">
              <span>Registro selecionado</span>
              <strong>{eventItem.title}</strong>
              <p>{formatDateTime(eventItem.start)}</p>
            </div>

            <form onSubmit={handleDelete}>
              <div className="confirm-actions">
                <button className="btn btn-danger" type="submit">
                  Confirmar exclusão
                </button>
                <Link
                  className="btn btn-secondary"
                  to={`/agenda/${eventItem.id}`}
                >
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
