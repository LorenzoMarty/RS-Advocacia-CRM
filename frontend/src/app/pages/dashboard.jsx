import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { PageChrome, StatusBadge } from "../layout";
import {
  motion,
  staggerContainer,
  staggerItem,
  pop,
  cardHover,
  prefersReducedMotion,
} from "../motion";
import { useAppState } from "../store";
import { formatDate, formatTime, getStatusTone, isSameDay } from "../utils";
import { EmptyState } from "./common";

const MotionLink = motion(Link);

/**
 * Contador animado para os KPIs do painel. Anima de 0 ao valor final com
 * easing; sob prefers-reduced-motion mostra o valor final instantaneamente.
 */
function CountUp({ value, duration = 0.9 }) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? target : 0,
  );
  const frameRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(target);
      return undefined;
    }

    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const totalMs = Math.max(1, duration * 1000);
    let start = null;

    function step(timestamp) {
      if (start === null) {
        start = timestamp;
      }
      const progress = Math.min(1, (timestamp - start) / totalMs);
      setDisplay(Math.round(ease(progress) * target));
      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(step);
      }
    }

    frameRef.current = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return <>{display}</>;
}

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

            <motion.div
              className="metric-row"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.article className="metric" variants={staggerItem}>
                <span>Prazos</span>
                <strong><CountUp value={deadlinesToday.length} /></strong>
              </motion.article>
              <motion.article className="metric" variants={staggerItem}>
                <span>Compromissos</span>
                <strong><CountUp value={eventsToday.length} /></strong>
              </motion.article>
              <motion.article className="metric" variants={staggerItem}>
                <span>Clientes</span>
                <strong><CountUp value={clients.length} /></strong>
              </motion.article>
              <motion.article className="metric" variants={staggerItem}>
                <span>Processos</span>
                <strong><CountUp value={processes.length} /></strong>
              </motion.article>
            </motion.div>
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

      <motion.section
        className="dashboard-grid"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <div className="stack">
          <motion.article className="surface panel" variants={staggerItem}>
            <div className="section-head">
              <div>
                <h2 className="section-title">Agenda</h2>
                <p className="section-note">Hoje</p>
              </div>
              <motion.span
                className="badge gold"
                variants={pop}
                initial="hidden"
                animate="visible"
              >
                {eventsToday.length}
              </motion.span>
            </div>

            <div className="list">
              {eventsToday.length ? (
                eventsToday.map((event) => (
                  <MotionLink
                    key={event.id}
                    className="item item-link is-clickable"
                    to={`/agenda/${event.id}`}
                    {...cardHover}
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
                  </MotionLink>
                ))
              ) : (
                <EmptyState
                  title="Sem itens hoje."
                  copy="Agenda livre."
                  className="empty-inline"
                />
              )}
            </div>
          </motion.article>

          <motion.article className="surface panel" variants={staggerItem}>
            <div className="section-head">
              <div>
                <h2 className="section-title">Prazos</h2>
                <p className="section-note">Próximos</p>
              </div>
              <motion.span
                className="badge warn"
                variants={pop}
                initial="hidden"
                animate="visible"
              >
                {upcomingDeadlines.length}
              </motion.span>
            </div>

            <div className="list">
              {upcomingDeadlines.length ? (
                upcomingDeadlines.map((deadline) => (
                  <MotionLink
                    key={deadline.id}
                    className="item item-link is-clickable"
                    to={`/prazos/${deadline.id}`}
                    {...cardHover}
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
                  </MotionLink>
                ))
              ) : (
                <EmptyState
                  title="Sem prazos."
                  copy="Sem prazos futuros."
                  className="empty-inline"
                />
              )}
            </div>
          </motion.article>
        </div>

        <aside className="stack">
          <motion.article className="surface rail" variants={staggerItem}>
            <div className="section-head">
              <div>
                <h2 className="section-title">Operação</h2>
                <p className="section-note">Atalhos e visão rápida</p>
              </div>
            </div>

            <div className="rail-group">
              <motion.div
                className="shortcut-grid"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                <MotionLink className="shortcut is-clickable" to="/agenda/novo" variants={staggerItem} {...cardHover}>
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
                </MotionLink>

                <MotionLink className="shortcut is-clickable" to="/clientes/novo" variants={staggerItem} {...cardHover}>
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
                </MotionLink>

                <MotionLink className="shortcut is-clickable" to="/processos/novo" variants={staggerItem} {...cardHover}>
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
                </MotionLink>

                <MotionLink className="shortcut is-clickable" to="/prazos/novo" variants={staggerItem} {...cardHover}>
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
                </MotionLink>

                <MotionLink className="shortcut is-clickable" to="/peticoes-contestacoes" variants={staggerItem} {...cardHover}>
                  <div className="shortcut-copy">
                    <strong>Petições</strong>
                    <span>Petições ou contestações</span>
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
                </MotionLink>
              </motion.div>
            </div>
          </motion.article>
        </aside>
      </motion.section>
    </>
  );
}
