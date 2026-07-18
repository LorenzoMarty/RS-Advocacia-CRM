import { useNavigate } from "react-router-dom";
import { StatusBadge } from "../layout";
import {
  formatDate,
  formatTime,
  getStatusTone,
  isOverdueEvent,
  normalizeText,
} from "../utils";

export function RailList({ events, clients, processes, emptyTitle, emptyCopy, onDelete, onAttendance }) {
  const navigate = useNavigate();

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
    </div>
  );
}
