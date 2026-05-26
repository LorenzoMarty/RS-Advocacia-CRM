import { Link } from "react-router-dom";

import { PageChrome, StatusBadge } from "../layout";
import { useAppState } from "../store";
import { formatDate, formatTime, getStatusTone, isSameDay } from "../utils";
import { EmptyState } from "./common";

export function DashboardPage() {
  const { clients, deadlines, events, processes } = useAppState();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const eventsToday = events.filter((event) => isSameDay(event.start, today));
  const deadlinesToday = deadlines.filter((deadline) => (
    deadline.date ? isSameDay(new Date(`${deadline.date}T12:00:00`), today) : false
  ));
  const upcomingDeadlines = [...deadlines]
    .filter((deadline) => {
      const deadlineDate = deadline.date ? new Date(`${deadline.date}T12:00:00`) : null;
      return deadlineDate && deadlineDate >= todayStart && !deadline.completed;
    })
    .sort((left, right) => new Date(`${left.date}T12:00:00`) - new Date(`${right.date}T12:00:00`))
    .slice(0, 5);
  const nextDeadline = upcomingDeadlines[0] || null;

  return (
    <>
      <PageChrome label="Painel" />

      <section className="surface hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">Controle jurídico.</h1>
            <p className="hero-subtitle">
              Gerencie compromissos, prazos e processos com eficiencia.
            </p>

            <div className="hero-actions">
              <Link className="btn" to="/agenda/novo">
                Novo
              </Link>
              <Link className="btn btn-secondary" to="/agenda">
                Agenda
              </Link>
            </div>

            <div className="metric-row">
              <article className="metric">
                <span>Prazos</span>
                <strong>{deadlinesToday.length}</strong>
              </article>
              <article className="metric">
                <span>Compromissos</span>
                <strong>{eventsToday.length}</strong>
              </article>
              <article className="metric">
                <span>Clientes</span>
                <strong>{clients.length}</strong>
              </article>
              <article className="metric">
                <span>Processos</span>
                <strong>{processes.length}</strong>
              </article>
            </div>
          </div>

          <aside className="focus-card">
            <span className="focus-label">Próximo prazo</span>
            {nextDeadline ? (
              <>
                <h2>{nextDeadline.title}</h2>
                <p className="focus-time">
                  {formatDate(new Date(`${nextDeadline.date}T12:00:00`))}
                </p>
                <div className="focus-meta">
                  {nextDeadline.clientId ? (
                    <span>
                      {
                        clients.find(
                          (client) => client.id === nextDeadline.clientId,
                        )?.name
                      }
                    </span>
                  ) : null}
                  {nextDeadline.processId ? (
                    <span>
                      {
                        processes.find(
                          (process) => process.id === nextDeadline.processId,
                        )?.number
                      }
                    </span>
                  ) : null}
                </div>
                <StatusBadge tone={getStatusTone(nextDeadline.status, nextDeadline.completed)}>
                  {nextDeadline.status || "Monitorado"}
                </StatusBadge>
              </>
            ) : (
              <>
                <h2>Sem prazos futuros.</h2>
                <p className="focus-time">
                  O proximo prazo aparece aqui.
                </p>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="stack">
          <article className="surface panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Agenda</h2>
                <p className="section-note">Hoje</p>
              </div>
              <span className="badge gold">{eventsToday.length}</span>
            </div>

            <div className="list">
              {eventsToday.length ? (
                eventsToday.map((event) => (
                  <Link
                    key={event.id}
                    className="item item-link"
                    to={`/agenda/${event.id}`}
                  >
                    <div className="item-time">{formatTime(event.start)}</div>

                    <div>
                      <h3 className="item-title">{event.title}</h3>
                      <div className="item-meta">
                        {event.clientId ? (
                          <span>
                            {
                              clients.find(
                                (client) => client.id === event.clientId,
                              )?.name
                            }
                          </span>
                        ) : null}
                        {event.processId ? (
                          <span>
                            {
                              processes.find(
                                (process) => process.id === event.processId,
                              )?.number
                            }
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="item-side">
                      <StatusBadge
                        tone={getStatusTone(event.status, event.completed)}
                      >
                        {event.completed ? "Concluído" : event.status}
                      </StatusBadge>
                      <span>{event.type || "Compromisso"}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Sem itens hoje."
                  copy="Agenda livre."
                  className="empty-inline"
                />
              )}
            </div>
          </article>

          <article className="surface panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Prazos</h2>
                <p className="section-note">Próximos</p>
              </div>
              <span className="badge warn">{upcomingDeadlines.length}</span>
            </div>

            <div className="list">
              {upcomingDeadlines.length ? (
                upcomingDeadlines.map((deadline) => (
                  <Link
                    key={deadline.id}
                    className="item item-link"
                    to={`/prazos/${deadline.id}`}
                  >
                    <div className="item-time">
                      {formatDate(new Date(`${deadline.date}T12:00:00`)).slice(0, 5)}
                    </div>

                    <div>
                      <h3 className="item-title">{deadline.title}</h3>
                      <div className="item-meta">
                        {deadline.clientId ? (
                          <span>
                            {
                              clients.find(
                                (client) => client.id === deadline.clientId,
                              )?.name
                            }
                          </span>
                        ) : null}
                        {deadline.processId ? (
                          <span>
                            {
                              processes.find(
                                (process) => process.id === deadline.processId,
                              )?.number
                            }
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="item-side">
                      <StatusBadge tone={getStatusTone(deadline.status, deadline.completed)}>
                        {deadline.status || "Monitorado"}
                      </StatusBadge>
                      <span>Prazo</span>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Sem prazos."
                  copy="Sem prazos futuros."
                  className="empty-inline"
                />
              )}
            </div>
          </article>
        </div>

        <aside className="stack">
          <article className="surface rail">
            <div className="section-head">
              <div>
                <h2 className="section-title">Operação</h2>
                <p className="section-note">Atalhos e visão rápida</p>
              </div>
            </div>

            <div className="rail-group">
              <div className="shortcut-grid">
                <Link className="shortcut" to="/agenda/novo">
                  <div className="shortcut-copy">
                    <strong>Compromisso</strong>
                    <span>Novo compromisso</span>
                  </div>
                  <span className="shortcut-icon" aria-hidden="true">
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
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                </Link>

                <Link className="shortcut" to="/clientes/novo">
                  <div className="shortcut-copy">
                    <strong>Cliente</strong>
                    <span>Novo cliente</span>
                  </div>
                  <span className="shortcut-icon" aria-hidden="true">
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
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M19 8h4" />
                      <path d="M21 6v4" />
                    </svg>
                  </span>
                </Link>

                <Link className="shortcut" to="/processos/novo">
                  <div className="shortcut-copy">
                    <strong>Processo</strong>
                    <span>Novo processo</span>
                  </div>
                  <span className="shortcut-icon" aria-hidden="true">
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
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M12 18v-6" />
                      <path d="M9 15h6" />
                    </svg>
                  </span>
                </Link>

                <Link className="shortcut" to="/prazos/novo">
                  <div className="shortcut-copy">
                    <strong>Prazo</strong>
                    <span>Novo prazo</span>
                  </div>
                  <span className="shortcut-icon" aria-hidden="true">
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
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M3 10h18" />
                      <path d="M12 14v4" />
                      <path d="M10 16h4" />
                    </svg>
                  </span>
                </Link>

                <Link className="shortcut" to="/peticoes-contestacoes">
                  <div className="shortcut-copy">
                    <strong>Petições</strong>
                    <span>Peças e contestações</span>
                  </div>
                  <span className="shortcut-icon" aria-hidden="true">
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
                      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                      <path d="M14 2v5h5" />
                      <path d="M9 13h6" />
                      <path d="M9 17h6" />
                      <path d="M9 9h1" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
