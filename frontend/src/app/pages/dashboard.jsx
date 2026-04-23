import { Link } from "react-router-dom";

import { PageChrome, StatusBadge } from "../layout";
import { useAppState } from "../store";
import { formatDate, formatTime, getStatusTone, isSameDay } from "../utils";
import { EmptyState } from "./common";

export function DashboardPage() {
  const { clients, events, processes, users } = useAppState();
  const today = new Date();
  const eventsToday = events.filter((event) => isSameDay(event.start, today));
  const upcomingEvents = [...events]
    .filter(
      (event) =>
        new Date(event.start) >=
        new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    )
    .sort((left, right) => new Date(left.start) - new Date(right.start))
    .slice(0, 5);
  const nextEvent = upcomingEvents[0] || null;

  return (
    <>
      <PageChrome label="Painel" />

      <section className="surface hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">Controle jurídico.</h1>
            <p className="hero-subtitle">
              Gerencie seus compromissos e processos com eficiência.
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
                <span>Hoje</span>
                <strong>{eventsToday.length}</strong>
              </article>
              <article className="metric">
                <span>Compromissos</span>
                <strong>{upcomingEvents.length}</strong>
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
            {nextEvent ? (
              <>
                <h2>{nextEvent.title}</h2>
                <p className="focus-time">
                  {formatDate(nextEvent.start)} às {formatTime(nextEvent.start)}
                </p>
                <div className="focus-meta">
                  {nextEvent.clientId ? (
                    <span>
                      {
                        clients.find(
                          (client) => client.id === nextEvent.clientId,
                        )?.name
                      }
                    </span>
                  ) : null}
                  {nextEvent.processId ? (
                    <span>
                      {
                        processes.find(
                          (process) => process.id === nextEvent.processId,
                        )?.number
                      }
                    </span>
                  ) : null}
                  {nextEvent.location ? (
                    <span>{nextEvent.location}</span>
                  ) : null}
                </div>
                <StatusBadge tone={getStatusTone(nextEvent.priority)}>
                  {nextEvent.priority || "Monitorado"}
                </StatusBadge>
              </>
            ) : (
              <>
                <h2>Sem compromissos no momento.</h2>
                <p className="focus-time">
                  O próximo compromisso aparece aqui.
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
                <h2 className="section-title">Compromissos</h2>
                <p className="section-note">Próximos</p>
              </div>
              <span className="badge warn">{upcomingEvents.length}</span>
            </div>

            <div className="list">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    className="item item-link"
                    to={`/agenda/${event.id}`}
                  >
                    <div className="item-time">
                      {formatDate(event.start).slice(0, 5)}
                    </div>

                    <div>
                      <h3 className="item-title">{event.title}</h3>
                      <div className="item-meta">
                        <span>{formatTime(event.start)}</span>
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
                      <StatusBadge tone={getStatusTone(event.priority)}>
                        {event.priority || "Monitorado"}
                      </StatusBadge>
                      <span>{event.type || "Prazo"}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="Sem compromissos."
                  copy="Sem pendências futuras."
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
                    <strong>Novo</strong>
                    <span>Compromisso</span>
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
                    <span>Novo cadastro</span>
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
                    <span>Novo registro</span>
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

                <Link className="shortcut" to="/usuarios">
                  <div className="shortcut-copy">
                    <strong>Usuários</strong>
                    <span>Equipe</span>
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
                      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="10" cy="7" r="4" />
                      <path d="M20 8v6" />
                      <path d="M17 11h6" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>

            <div className="rail-group">
              <div className="rail-stats">
                <article className="rail-stat">
                  <div className="rail-copy">
                    <strong>Hoje</strong>
                    <span>Compromissos</span>
                  </div>
                  <div className="rail-number">{eventsToday.length}</div>
                </article>

                <article className="rail-stat">
                  <div className="rail-copy">
                    <strong>Carteira</strong>
                    <span>Processos</span>
                  </div>
                  <div className="rail-number">{processes.length}</div>
                </article>

                <article className="rail-stat">
                  <div className="rail-copy">
                    <strong>Equipe</strong>
                    <span>Usuários</span>
                  </div>
                  <div className="rail-number">{users.length}</div>
                </article>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
