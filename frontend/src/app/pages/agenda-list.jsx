import { PageHeader } from '@/components/ui/page-header';
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { useConfirmPopup } from "../hooks/use-confirm-popup";
import { PageChrome } from "../layout";
import { Select } from "../components/select";
import { useAppState } from "../store";
import {
  buildSearchText,
  formatTime,
  getEventTypeKey,
  isOverdueEvent,
  isSameDay,
  normalizeText,
  startOfDay,
} from "../utils";
import {
  monthLabel,
  calendarDays,
  formatDayParam,
} from "./agenda-utils";
import { RailList } from "./agenda-rail-list";

// Cores dos tipos (mesmas da legenda antiga).
const TYPE_DOT = { audiencia: "var(--cat-civel-dot)", reuniao: "var(--cat-empresarial-dot)", tarefa: "var(--cat-trabalhista-dot)" };
const TYPE_ORDER = ["audiencia", "reuniao", "tarefa"];

export function AgendaListPage() {
  const navigate = useNavigate();
  const {
    addFlash,
    clients,
    currentUser,
    deleteEvent,
    events,
    markEventAttendance,
    moveEvent,
    processes,
    syncGoogleCalendarEvents,
  } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [draggingEventId, setDraggingEventId] = useState("");
  const [dragOverDayKey, setDragOverDayKey] = useState("");

  const typeOptions = [
    ...new Set(events.map((event) => event.type).filter(Boolean)),
  ].sort((left, right) => {
    const rank = (value) => {
      const index = TYPE_ORDER.indexOf(normalizeText(value));
      return index === -1 ? TYPE_ORDER.length : index;
    };
    return rank(left) - rank(right);
  });
  const responsibleOptions = [
    ...new Set(events.map((event) => event.responsibleName).filter(Boolean)),
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
        event.responsibleName,
      ]);

      if (search && !haystack.includes(normalizeText(search))) return false;
      if (eventType && normalizeText(event.type) !== normalizeText(eventType))
        return false;
      if (
        responsible &&
        normalizeText(event.responsibleName) !== normalizeText(responsible)
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

  const selectedDayEvents = filteredEvents.filter((event) =>
    isSameDay(event.start, selectedDate),
  );
  const isSelectedToday = isSameDay(selectedDate, today);
  const monthCount = filteredEvents.filter((event) => {
    const start = new Date(event.start);
    return start.getMonth() === viewDate.getMonth() && start.getFullYear() === viewDate.getFullYear();
  }).length;
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(viewDate);
  const monthSubtitle = `${monthCount} ${monthCount === 1 ? "compromisso" : "compromissos"} em ${monthName}`;
  const activeFilters = [search, responsible, status, period].filter(Boolean).length;
  const upcomingEvents = filteredEvents
    .filter(
      (event) =>
        new Date(event.start) > new Date(todayStart.getTime() + 86400000),
    )
    .slice(0, 5);
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

    if (googleCalendarError) {
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

  useEffect(() => {
    if (!currentUser?.googleCalendarConnected) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        syncGoogleCalendarEvents({ silent: true });
      }
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [currentUser?.googleCalendarConnected, syncGoogleCalendarEvents]);

  // Navegar de mês leva a seleção junto (dia 1 do mês, ou hoje se for o mês atual),
  // para o painel do dia não ficar apontando para um dia que não está na grade.
  function goToMonth(offset) {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(next);
    setSelectedDate(
      next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
        ? new Date()
        : next,
    );
  }

  function toLocalIso(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  function handleEventDragStart(dragEvent, eventId) {
    setDraggingEventId(eventId);
    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("text/plain", eventId);
  }

  function handleEventDragEnd() {
    setDraggingEventId("");
    setDragOverDayKey("");
  }

  function handleDayDragOver(dragEvent, key) {
    if (!draggingEventId) return;
    dragEvent.preventDefault();
    dragEvent.dataTransfer.dropEffect = "move";
    if (dragOverDayKey !== key) setDragOverDayKey(key);
  }

  async function handleDayDrop(dragEvent, day) {
    dragEvent.preventDefault();
    const eventId = dragEvent.dataTransfer.getData("text/plain") || draggingEventId;
    setDraggingEventId("");
    setDragOverDayKey("");

    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const start = new Date(event.start);
    if (Number.isNaN(start.getTime()) || isSameDay(start, day.date)) return;

    const newStart = new Date(day.date);
    newStart.setHours(
      start.getHours(),
      start.getMinutes(),
      start.getSeconds(),
      0,
    );

    let newEnd = event.end;
    if (event.end) {
      const end = new Date(event.end);
      if (!Number.isNaN(end.getTime())) {
        newEnd = toLocalIso(new Date(newStart.getTime() + (end - start)));
      }
    }

    await moveEvent(eventId, { start: toLocalIso(newStart), end: newEnd });
  }

  async function handleQuickDelete(eventId, eventTitle) {
    const canDelete = await confirm({
      title: "Tem certeza?",
      message: `O compromisso "${eventTitle}" será deletado.`,
      confirmLabel: "Deletar",
      tone: "danger",
    });
    if (canDelete) {
      await deleteEvent(eventId);
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Agenda" primaryAction={{ label: 'Novo compromisso', to: '/agenda/novo', tour: 'page-primary-action' }} />

      <div className="agenda-page">
        <PageHeader className="mb-4" title="Agenda" subtitle={monthSubtitle}>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((current) => !current)}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Filtros{activeFilters ? ` (${activeFilters})` : ""}
          </Button>
          <Segmented
            tone="bg"
            label="Filtrar por tipo"
            value={eventType}
            onChange={setEventType}
            options={[
              { value: "", label: "Todos" },
              ...typeOptions.map((option) => ({ value: option, label: option, dot: TYPE_DOT[normalizeText(option)] })),
            ]}
          />
        </PageHeader>

        {showFilters ? (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3 py-[calc(var(--pad-card)*.75)]">
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Select
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
              </Select>
              <Select
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
              </Select>
              <Select
                aria-label="Filtrar por período"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="">Período</option>
                <option value="today">Hoje</option>
                <option value="week">7 dias</option>
                <option value="month">Mês</option>
              </Select>
            </div>
          </CardContent>
        </Card>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-[var(--gap-grid)] min-[1201px]:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <h2 className="text-card-title first-letter:uppercase">{monthLabel(viewDate)}</h2>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    setSelectedDate(new Date());
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Mês anterior"
                  onClick={() => goToMonth(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Próximo mês"
                  onClick={() => goToMonth(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
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
                    className={`day-card${day.date.getMonth() !== viewDate.getMonth() ? " is-muted" : ""}${isSameDay(day.date, today) ? " is-today" : ""}${isSameDay(day.date, selectedDate) ? " is-selected" : ""}${day.events.some((event) => isOverdueEvent(event)) ? " is-overdue" : ""}${day.events.length ? " has-events" : ""}${dragOverDayKey === day.key && draggingEventId ? " is-drop-target" : ""}`}
                    onDragOver={(dragEvent) => handleDayDragOver(dragEvent, day.key)}
                    onDragEnter={(dragEvent) => handleDayDragOver(dragEvent, day.key)}
                    onDrop={(dragEvent) => handleDayDrop(dragEvent, day)}
                  >
                    <div className="day-head">
                      <button
                        type="button"
                        className="day-number day-number-link"
                        aria-label={`Selecionar dia ${day.date.getDate()}`}
                        aria-pressed={isSameDay(day.date, selectedDate)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(day.date);
                        }}
                      >
                        {day.date.getDate()}
                      </button>
                      <span className="day-dot" />
                    </div>

                    <div className="day-events">
                      {day.events.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`calendar-event type-${getEventTypeKey(event.type)}${isOverdueEvent(event) ? " is-overdue" : ""}${draggingEventId === event.id ? " is-dragging" : ""}`}
                          role="link"
                          tabIndex="0"
                          draggable
                          onDragStart={(dragEvent) => handleEventDragStart(dragEvent, event.id)}
                          onDragEnd={handleEventDragEnd}
                          onClick={() => navigate(`/agenda/${event.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/agenda/${event.id}`); }}
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
                          <button
                            className="calendar-event-delete"
                            type="button"
                            aria-label="Excluir compromisso"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickDelete(event.id, event.title);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {day.events.length > 2 ? (
                        <HoverCard openDelay={150}>
                          <HoverCardTrigger asChild>
                            <span className="calendar-more" role="button" tabIndex={0}>
                              +{day.events.length - 2} compromissos
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent align="start" className="p-2">
                            <div className="flex flex-col gap-1">
                              {day.events.slice(2).map((event) => (
                                <button
                                  key={event.id}
                                  type="button"
                                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                                  onClick={() => navigate(`/agenda/${event.id}`)}
                                >
                                  <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
                                    {formatTime(event.start)}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                    {event.title}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
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
            </CardContent>
          </Card>

          <div className="grid gap-[var(--gap-grid)] min-[1201px]:sticky min-[1201px]:top-[var(--sticky-top)]">
            <Card>
              <CardContent className="grid gap-3.5 py-[var(--pad-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-[.08em] text-subtle">
                      {isSelectedToday ? "Hoje" : "Dia selecionado"}
                    </span>
                    <h2 className="m-0 text-card-title-sm text-ink first-letter:uppercase">
                      {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate)}
                    </h2>
                  </div>
                  <span className="text-[.93rem] font-semibold text-muted-foreground">
                    {selectedDayEvents.length} {selectedDayEvents.length === 1 ? "compromisso" : "compromissos"}
                  </span>
                </div>
                <RailList
                  variant="day"
                  events={selectedDayEvents}
                  clients={clients}
                  processes={processes}
                  emptyTitle="Nenhum compromisso neste dia."
                  emptyCopy="Selecione outro dia no calendário."
                  onDelete={handleQuickDelete}
                  onAttendance={markEventAttendance}
                />
                <Link
                  className="text-[.93rem] font-bold text-ink-2 no-underline hover:text-ink"
                  to={`/agenda/dia/${formatDayParam(selectedDate)}`}
                >
                  Ver agenda do dia →
                </Link>
              </CardContent>
            </Card>

            {overdueEvents.length ? (
              <Card>
                <CardContent className="grid gap-3 py-[var(--pad-card)]">
                  <h3 className="m-0 text-card-title-sm text-ink">Atrasados</h3>
                  <RailList
                    events={overdueEvents}
                    clients={clients}
                    processes={processes}
                    emptyTitle="Sem atrasos."
                    emptyCopy="Nenhum compromisso vencido."
                    onDelete={handleQuickDelete}
                    onAttendance={markEventAttendance}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="grid gap-2 py-[var(--pad-card)]">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="m-0 text-card-title-sm text-ink">Próximos</h3>
                  {overdueEvents.length ? (
                    <span className="flex items-center gap-1.5 text-[.86rem] font-semibold text-[var(--danger-ink)]">
                      <span className="size-[7px] rounded-full bg-[var(--danger)]" aria-hidden="true" />
                      {overdueEvents.length} {overdueEvents.length === 1 ? "atrasado" : "atrasados"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[.86rem] font-semibold text-[var(--success-ink)]">
                      <span className="size-[7px] rounded-full bg-[var(--success)]" aria-hidden="true" />
                      Sem atrasos
                    </span>
                  )}
                </div>
                {upcomingEvents.length ? (
                  upcomingEvents.map((event) => {
                    const start = new Date(event.start);
                    const typeKey = getEventTypeKey(event.type);
                    const clientName = clients.find((client) => client.id === event.clientId)?.name;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        aria-label={`${event.title}, ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(start)}, ${formatTime(event.start)}`}
                        className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-sm border-0 bg-transparent p-2 text-left transition-colors hover:bg-surface-2"
                        onClick={() => {
                          setSelectedDate(start);
                          setViewDate(new Date(start.getFullYear(), start.getMonth(), 1));
                        }}
                      >
                        <span className={`upcoming-tile type-${typeKey}`}>
                          <span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(start).replace(".", "")}</span>
                          <strong>{start.getDate()}</strong>
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <strong className="truncate text-[1rem] font-bold text-ink">{event.title}</strong>
                          <span className="truncate text-[.86rem] font-medium text-muted-foreground">
                            {formatTime(event.start)}{clientName ? ` · ${clientName}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="m-0 py-3 text-center text-[.93rem] font-semibold text-muted-foreground">Sem próximos compromissos.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
