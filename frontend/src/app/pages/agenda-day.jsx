import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useConfirmPopup } from "../hooks/use-confirm-popup";
import { PageChrome } from "../layout";
import { useAppState } from "../store";
import {
  formatCount,
  formatDate,
  formatTime,
  getEventTypeKey,
  isOverdueEvent,
  isSameDay,
  normalizeText,
} from "../utils";
import { NotFoundState } from "./common";
import {
  dayLabel,
  formatDayParam,
  parseDayParam,
} from "./agenda-utils";

const DAY_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07–22

export function AgendaDayPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { clients, deleteEvent, events, markEventAttendance, moveEvent, processes } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [draggingEventId, setDraggingEventId] = useState("");
  const [dragOverHour, setDragOverHour] = useState(null);

  const date = parseDayParam(params.date);

  if (!date) {
    return <NotFoundState title="Data inválida." />;
  }

  const dayEvents = events
    .filter((e) => isSameDay(e.start, date))
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const today = new Date();
  const isToday = isSameDay(date, today);
  const currentHour = today.getHours();

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

  function toLocalIso(value) {
    const pad = (part) => String(part).padStart(2, "0");
    return (
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
      `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    );
  }

  function handleEventDragStart(dragEvent, eventId) {
    setDraggingEventId(eventId);
    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("text/plain", eventId);
  }

  function handleEventDragEnd() {
    setDraggingEventId("");
    setDragOverHour(null);
  }

  function handleSlotDragOver(dragEvent, hour) {
    if (!draggingEventId) return;
    dragEvent.preventDefault();
    dragEvent.dataTransfer.dropEffect = "move";
    if (dragOverHour !== hour) setDragOverHour(hour);
  }

  async function handleSlotDrop(dragEvent, hour) {
    dragEvent.preventDefault();
    const eventId = dragEvent.dataTransfer.getData("text/plain") || draggingEventId;
    setDraggingEventId("");
    setDragOverHour(null);

    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const start = new Date(event.start);
    if (Number.isNaN(start.getTime()) || start.getHours() === hour) return;

    const newStart = new Date(start);
    newStart.setHours(hour, start.getMinutes(), start.getSeconds(), 0);

    let newEnd = event.end;
    if (event.end) {
      const end = new Date(event.end);
      if (!Number.isNaN(end.getTime())) {
        newEnd = toLocalIso(new Date(newStart.getTime() + (end - start)));
      }
    }

    await moveEvent(eventId, { start: toLocalIso(newStart), end: newEnd });
  }

  async function handleQuickAttendance(e, event, attended) {
    e.preventDefault();
    e.stopPropagation();
    await markEventAttendance(event.id, attended);
  }

  function goDay(offset) {
    const next = new Date(date);
    next.setDate(next.getDate() + offset);
    navigate(`/agenda/dia/${formatDayParam(next)}`);
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label={dayLabel(date)} />

      <div className="grid gap-4">
        <section className="mb-2">
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to="/agenda"
          >
            Agenda
          </Link>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Dia anterior" onClick={() => goDay(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <p className="min-w-[16ch] text-center font-serif text-2xl text-foreground">
                {dayLabel(date)}
              </p>
              <Button variant="ghost" size="icon" aria-label="Próximo dia" onClick={() => goDay(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <Button asChild>
              <Link to={`/agenda/novo?data=${params.date}`}>
                <Plus className="size-4" />
                Novo
              </Link>
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Badge>{formatCount(dayEvents.length, "compromisso", "compromissos")}</Badge>
            {isToday && <Badge variant="outline">Hoje</Badge>}
          </div>
        </section>

        <Card>
          <CardContent className="py-5">
          {!dayEvents.length && (
            <div className="timeline-day-empty">
              <strong>Nenhum compromisso neste dia.</strong>
              <p>
                <Link to={`/agenda/novo?data=${params.date}`}>
                  Criar compromisso
                </Link>{" "}
                para {formatDate(date)}.
              </p>
            </div>
          )}

          <div className="timeline-grid">
            {DAY_HOURS.map((hour) => {
              const slotEvents = dayEvents.filter(
                (e) => new Date(e.start).getHours() === hour,
              );
              const isNow = isToday && currentHour === hour;

              return (
                <div
                  key={hour}
                  className={`timeline-row${slotEvents.length ? " has-events" : ""}${isNow ? " is-now" : ""}${dragOverHour === hour && draggingEventId ? " is-drop-target" : ""}`}
                  onDragOver={(dragEvent) => handleSlotDragOver(dragEvent, hour)}
                  onDragEnter={(dragEvent) => handleSlotDragOver(dragEvent, hour)}
                  onDrop={(dragEvent) => handleSlotDrop(dragEvent, hour)}
                >
                  <div className="timeline-hour">
                    <span>{String(hour).padStart(2, "0")}:00</span>
                  </div>

                  <div className="timeline-slot">
                    {slotEvents.map((event) => {
                      const client = clients.find((c) => c.id === event.clientId);
                      const process = processes.find((p) => p.id === event.processId);

                      return (
                        <div
                          key={event.id}
                          className={`timeline-event type-${getEventTypeKey(event.type)}${isOverdueEvent(event) ? " is-overdue" : ""}${draggingEventId === event.id ? " is-dragging" : ""}`}
                          role="link"
                          tabIndex="0"
                          draggable
                          onDragStart={(dragEvent) => handleEventDragStart(dragEvent, event.id)}
                          onDragEnd={handleEventDragEnd}
                          onClick={() => navigate(`/agenda/${event.id}`)}
                          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/agenda/${event.id}`); }}
                        >
                          <span className="timeline-event-time">
                            {formatTime(event.start)}
                            {event.end ? ` — ${formatTime(event.end)}` : ""}
                          </span>
                          <strong className="timeline-event-title">
                            {event.title}
                          </strong>
                          <div className="timeline-event-meta">
                            {event.type ? (
                              <span className="meta-chip">{event.type}</span>
                            ) : null}
                            {client ? (
                              <span className="meta-chip">{client.name}</span>
                            ) : null}
                            {process ? (
                              <span className="meta-chip">{process.number}</span>
                            ) : null}
                            {event.responsibleName && !client ? (
                              <span className="meta-chip">{event.responsibleName}</span>
                            ) : null}
                          </div>
                          {!event.completed && !normalizeText(event.status || '').includes('compareceu') && (
                            <div className="timeline-event-attend">
                              <button
                                type="button"
                                className="timeline-event-attend-yes"
                                aria-label="Marcar como compareceu"
                                onClick={(e) => handleQuickAttendance(e, event, true)}
                              >
                                Compareceu
                              </button>
                              <button
                                type="button"
                                className="timeline-event-attend-no"
                                aria-label="Marcar como não compareceu"
                                onClick={(e) => handleQuickAttendance(e, event, false)}
                              >
                                Não compareceu
                              </button>
                            </div>
                          )}
                          <button
                            className="timeline-event-delete"
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
                      );
                    })}

                    {!slotEvents.length && (
                      <Link
                        className="timeline-slot-add"
                        to={`/agenda/novo?data=${params.date}`}
                        aria-label={`Adicionar compromisso às ${String(hour).padStart(2, "0")}:00`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Adicionar compromisso
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
