import {
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useConfirmPopup } from "../hooks/use-confirm-popup";
import {
  PageChrome,
  StatusBadge,
} from "../layout";
import { useAppState } from "../store";
import {
  formatDate,
  formatTime,
  getStatusTone,
  isOverdueEvent,
  formatDateTime,
  normalizeText,
} from "../utils";
import { NotFoundState } from "./common";

export function EventDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { clients, deleteEvent, events, loadEvent, processes, saveEvent } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
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

  async function handleMarkAttendance(attended) {
    const status = attended ? 'Compareceu' : 'Não compareceu';
    const updated = await saveEvent({ ...eventItem, status, completed: true });
    if (updated) {
      setRemoteEvent(updated);
    }
  }

  async function handleDeleteEvent() {
    const canDelete = await confirm({
      title: "Tem certeza?",
      message: `O compromisso "${eventItem.title}" será deletado.`,
      confirmLabel: "Deletar",
      tone: "danger",
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deleteEvent(eventItem.id);
    if (wasDeleted) {
      navigate("/agenda", { replace: true });
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome
        label="Compromisso"
        actions={
          <>
            {!eventItem.completed && !normalizeText(eventItem.status).includes('compareceu') && (
              <>
                <button
                  className="btn"
                  type="button"
                  onClick={() => handleMarkAttendance(true)}
                >
                  Compareceu
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => handleMarkAttendance(false)}
                >
                  Não compareceu
                </button>
              </>
            )}
            <Link
              className="btn btn-secondary"
              to={`/agenda/${eventItem.id}/editar`}
            >
              Editar
            </Link>
            <button
              className="btn btn-danger"
              type="button"
              onClick={handleDeleteEvent}
            >
              Excluir
            </button>
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
                    tone={getStatusTone(isOverdueEvent(eventItem) ? 'Atrasado' : eventItem.status, eventItem.completed)}
                  >
                    {eventItem.completed ? "Concluído" : isOverdueEvent(eventItem) ? "Atrasado" : eventItem.status}
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
                  <strong>{eventItem.responsibleName || "-"}</strong>
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
                        isOverdueEvent(eventItem) ? 'Atrasado' : eventItem.status,
                        eventItem.completed,
                      )}
                    >
                      {isOverdueEvent(eventItem) ? "Atrasado" : eventItem.status}
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
