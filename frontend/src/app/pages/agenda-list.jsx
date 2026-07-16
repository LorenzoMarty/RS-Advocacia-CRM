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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { useConfirmPopup } from "../hooks/use-confirm-popup";
import { PageChrome } from "../layout";
import { Select } from "../components/select";
import { useAppState } from "../store";
import {
  buildSearchText,
  formatCount,
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

export function AgendaListPage() {
  const navigate = useNavigate();
  const {
    addFlash,
    clients,
    currentUser,
    deleteEvent,
    events,
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
  const [draggingEventId, setDraggingEventId] = useState("");
  const [dragOverDayKey, setDragOverDayKey] = useState("");

  const typeOptions = [
    ...new Set(events.map((event) => event.type).filter(Boolean)),
  ];
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
      <PageChrome label="Agenda" />

      <div className="agenda-page">
        <section className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Agenda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCount(filteredEvents.length)}
              </p>
            </div>
            <Button asChild>
              <Link to="/agenda/novo" data-tour="page-primary-action">
                <Plus className="size-4" />
                Novo compromisso
              </Link>
            </Button>
          </div>
        </section>

        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select
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
              </Select>
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <h2 className="font-serif text-lg text-foreground">Calendário</h2>
                <p className="text-xs text-muted-foreground">Visão mensal</p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
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
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-[8ch] text-center text-sm font-medium text-foreground">
                  {monthLabel(viewDate)}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
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
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
            <div className="calendar-legend">
              <span className="legend-chip legend-chip-audiencia">
                Audiência
              </span>
              <span className="legend-chip legend-chip-reuniao">Reunião</span>
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
                    className={`day-card${day.date.getMonth() !== viewDate.getMonth() ? " is-muted" : ""}${isSameDay(day.date, today) ? " is-today" : ""}${day.events.some((event) => isOverdueEvent(event)) ? " is-overdue" : ""}${day.events.length ? " has-events" : ""}${dragOverDayKey === day.key && draggingEventId ? " is-drop-target" : ""}`}
                    onDragOver={(dragEvent) => handleDayDragOver(dragEvent, day.key)}
                    onDragEnter={(dragEvent) => handleDayDragOver(dragEvent, day.key)}
                    onDrop={(dragEvent) => handleDayDrop(dragEvent, day)}
                  >
                    <div className="day-head">
                      <Link
                        className="day-number day-number-link"
                        to={`/agenda/dia/${formatDayParam(day.date)}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {day.date.getDate()}
                      </Link>
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 py-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-serif text-base text-foreground">Hoje</h2>
                  {todayEvents.length ? (
                    <Badge variant="default">{todayEvents.length}</Badge>
                  ) : null}
                </div>
                <RailList
                  events={todayEvents}
                  clients={clients}
                  processes={processes}
                  emptyTitle="Sem compromissos hoje."
                  emptyCopy="A agenda do dia aparece aqui."
                  onDelete={handleQuickDelete}
                />
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-serif text-base text-foreground">Próximos</h2>
                  {upcomingEvents.length ? (
                    <Badge variant="outline">{upcomingEvents.length}</Badge>
                  ) : null}
                </div>
                <RailList
                  events={upcomingEvents}
                  clients={clients}
                  processes={processes}
                  emptyTitle="Sem próximos compromissos."
                  emptyCopy="Os próximos registros aparecem aqui."
                  onDelete={handleQuickDelete}
                />
              </div>

              <Separator />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-serif text-base text-foreground">Atrasados</h2>
                  {overdueEvents.length ? (
                    <Badge variant="destructive">{overdueEvents.length}</Badge>
                  ) : null}
                </div>
                <RailList
                  events={overdueEvents}
                  clients={clients}
                  processes={processes}
                  emptyTitle="Sem atrasos."
                  emptyCopy="Nenhum compromisso vencido."
                  onDelete={handleQuickDelete}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
