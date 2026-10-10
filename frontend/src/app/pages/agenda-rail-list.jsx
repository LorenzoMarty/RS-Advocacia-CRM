import { useNavigate } from "react-router-dom";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "../layout";
import { ShowMoreButton } from "../components/show-more";
import { useShowMore } from "../hooks/use-show-more";
import {
  formatDate,
  formatTime,
  getEventTypeKey,
  getStatusTone,
  isOverdueEvent,
  normalizeText,
} from "../utils";

const RAIL_PAGE_SIZE = 8;

export function RailList({ events, clients, processes, emptyTitle, emptyCopy, onDelete, onAttendance, variant = "default" }) {
  const navigate = useNavigate();
  // Dias/listas com dezenas de compromissos: renderização progressiva em vez de empilhar tudo.
  const { visible, remaining, showMore } = useShowMore(events, RAIL_PAGE_SIZE, {
    resetKey: `${variant}|${events[0]?.id ?? ""}`,
  });
  const showMoreButton = <ShowMoreButton remaining={remaining} pageSize={RAIL_PAGE_SIZE} onClick={showMore} />;

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

  if (variant === "day") {
    return (
      <div className="side-list">
        {visible.map((event) => {
          const client = clients.find((item) => item.id === event.clientId)?.name;
          const processNumber = processes.find((item) => item.id === event.processId)?.number;
          const overdue = isOverdueEvent(event);
          const canMark = onAttendance && !event.completed && !normalizeText(event.status || "").includes("compareceu");
          return (
            <div
              key={event.id}
              className={`day-event type-${getEventTypeKey(event.type)}${overdue ? " is-overdue" : ""}`}
              role="link"
              tabIndex="0"
              onClick={() => navigate(`/agenda/${event.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter") navigate(`/agenda/${event.id}`); }}
            >
              <span className="day-event-bar" aria-hidden="true" />
              <div className="day-event-body">
                <span className="day-event-top">
                  <span>{formatTime(event.start)}{event.type ? ` · ${event.type}` : ""}</span>
                  <span className={overdue ? "is-overdue" : ""}>{overdue ? "Atrasado" : (event.status || "Ativo")}</span>
                </span>
                <strong className="day-event-title">{event.title}</strong>
                {client ? <span className="day-event-client">{client}</span> : null}
                {processNumber ? <span className="day-event-proc">{processNumber}</span> : null}
              </div>
              {onDelete ? (
                <button
                  className="side-item-delete"
                  type="button"
                  aria-label="Excluir compromisso"
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(event.id, event.title);
                  }}
                >
                  ×
                </button>
              ) : null}
              <div className="day-event-foot">
                <span className="day-event-owner">
                  <Avatar name={event.responsibleName || "?"} size={24} className="rounded-[8px]" />
                  <span className="truncate">{event.responsibleName || "Sem responsável"}</span>
                </span>
                {canMark ? (
                  <span className="side-item-attend">
                    <button
                      type="button"
                      className="side-item-attend-yes"
                      aria-label="Marcar como compareceu"
                      onKeyDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onAttendance(event.id, true); }}
                    >
                      Compareceu
                    </button>
                    <button
                      type="button"
                      className="side-item-attend-no"
                      aria-label="Marcar como não compareceu"
                      onKeyDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); onAttendance(event.id, false); }}
                    >
                      Faltou
                    </button>
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
        {showMoreButton}
      </div>
    );
  }

  return (
    <div className="side-list">
      {visible.map((event) => (
        <div
          key={event.id}
          className="side-item"
          role="link"
          tabIndex="0"
          onClick={() => navigate(`/agenda/${event.id}`)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/agenda/${event.id}`); }}
        >
          <div className="side-top">
            <div>
              <h3 className="side-title">{event.title}</h3>
              <p className="side-time">
                {formatDate(event.start)} • {formatTime(event.start)}
              </p>
            </div>
            <StatusBadge tone={getStatusTone(isOverdueEvent(event) ? 'Atrasado' : event.status, event.completed)}>
              {isOverdueEvent(event) ? "Atrasado" : (event.status || "Ativo")}
            </StatusBadge>
          </div>
          <div className="side-meta">
            {event.type ? (
              <span className="meta-chip">{event.type}</span>
            ) : null}
            {event.responsibleName ? (
              <span className="meta-chip">{event.responsibleName}</span>
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
          {onAttendance && !event.completed && !normalizeText(event.status || '').includes('compareceu') ? (
            <div className="side-item-attend">
              <button
                type="button"
                className="side-item-attend-yes"
                aria-label="Marcar como compareceu"
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onAttendance(event.id, true);
                }}
              >
                Compareceu
              </button>
              <button
                type="button"
                className="side-item-attend-no"
                aria-label="Marcar como não compareceu"
                onKeyDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onAttendance(event.id, false);
                }}
              >
                Não compareceu
              </button>
            </div>
          ) : null}
          {onDelete && (
            <button
              className="side-item-delete"
              type="button"
              aria-label="Excluir compromisso"
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(event.id, event.title);
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {showMoreButton}
    </div>
  );
}
