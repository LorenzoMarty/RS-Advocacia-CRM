import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
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
} from '../utils';

function monthLabel(value) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(value);
}

function calendarDays(viewDate, events) {
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1 - startOffset);
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
              <p className="side-time">{formatDate(event.start)} • {formatTime(event.start)}</p>
            </div>
            <StatusBadge tone={getStatusTone(event.status, event.completed)}>{event.status || 'Ativo'}</StatusBadge>
          </div>
          <div className="side-meta">
            {event.type ? <span className="meta-chip">{event.type}</span> : null}
            {event.responsible ? <span className="meta-chip">{event.responsible}</span> : null}
            {event.clientId ? <span className="meta-chip">{clients.find((client) => client.id === event.clientId)?.name}</span> : null}
            {event.processId ? <span className="meta-chip">{processes.find((process) => process.id === event.processId)?.number}</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function AgendaListPage() {
  const { clients, events, processes } = useAppState();
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [responsible, setResponsible] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [viewDate, setViewDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const typeOptions = [...new Set(events.map((event) => event.type).filter(Boolean))];
  const responsibleOptions = [...new Set(events.map((event) => event.responsible).filter(Boolean))];
  const statusOptions = [...new Set(events.map((event) => event.status).filter(Boolean))];
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
      if (eventType && normalizeText(event.type) !== normalizeText(eventType)) return false;
      if (responsible && normalizeText(event.responsible) !== normalizeText(responsible)) return false;
      if (status && normalizeText(event.status) !== normalizeText(status)) return false;
      if (period === 'today' && !isSameDay(event.start, today)) return false;
      if (period === 'week' && (new Date(event.start) < todayStart || new Date(event.start) > nextWeek)) return false;
      if (period === 'month' && (new Date(event.start).getMonth() !== today.getMonth() || new Date(event.start).getFullYear() !== today.getFullYear())) return false;
      return true;
    })
    .sort((left, right) => new Date(left.start) - new Date(right.start));

  const todayEvents = filteredEvents.filter((event) => isSameDay(event.start, today));
  const upcomingEvents = filteredEvents.filter((event) => new Date(event.start) > new Date(todayStart.getTime() + 86400000)).slice(0, 6);
  const overdueEvents = filteredEvents.filter((event) => isOverdueEvent(event)).slice(0, 6);
  const days = calendarDays(viewDate, filteredEvents);

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
            <span className="badge gold">{formatCount(filteredEvents.length)}</span>
          </div>

          <div className="agenda-toolbar">
            <div className="toolbar-main">
              <label className="toolbar-search" aria-label="Buscar compromissos">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input type="search" placeholder="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>

              <div className="toolbar-filters">
                <select className="filter-select" aria-label="Filtrar por tipo" value={eventType} onChange={(event) => setEventType(event.target.value)}>
                  <option value="">Tipo</option>
                  {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select className="filter-select" aria-label="Filtrar por responsável" value={responsible} onChange={(event) => setResponsible(event.target.value)}>
                  <option value="">Responsável</option>
                  {responsibleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select className="filter-select" aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Status</option>
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select className="filter-select" aria-label="Filtrar por período" value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="">Período</option>
                  <option value="today">Hoje</option>
                  <option value="week">7 dias</option>
                  <option value="month">Mês</option>
                </select>
              </div>
            </div>

            <Link className="btn" to="/agenda/novo">Novo</Link>
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
                <button className="icon-control" type="button" aria-label="Mês anterior" onClick={() => setViewDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <div className="calendar-month">{monthLabel(viewDate)}</div>
                <button className="icon-control" type="button" aria-label="Próximo mês" onClick={() => setViewDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="calendar-legend">
              <span className="legend-chip legend-chip-audiencia">Audiência</span>
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
                    className={`day-card${day.date.getMonth() !== viewDate.getMonth() ? ' is-muted' : ''}${isSameDay(day.date, today) ? ' is-today' : ''}${day.events.some((event) => isOverdueEvent(event)) ? ' is-overdue' : ''}${day.events.length ? ' has-events' : ''}`}
                  >
                    <div className="day-head">
                      <span className="day-number">{day.date.getDate()}</span>
                      <span className="day-dot" />
                    </div>

                    <div className="day-events">
                      {day.events.slice(0, 2).map((event) => (
                        <Link key={event.id} className={`calendar-event type-${getEventTypeKey(event.type)}${isOverdueEvent(event) ? ' is-overdue' : ''}`} to={`/agenda/${event.id}`}>
                          <span className="calendar-event-time">{formatTime(event.start)}</span>
                          <strong className="calendar-event-title">{event.title}</strong>
                          <span className="calendar-event-context">
                            {clients.find((client) => client.id === event.clientId)?.name || processes.find((process) => process.id === event.processId)?.number || event.type || 'Compromisso'}
                          </span>
                        </Link>
                      ))}
                      {day.events.length > 2 ? <span className="calendar-more">+{day.events.length - 2} compromissos</span> : null}
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
                      <p className="section-note">{todayEvents.length ? 'Compromissos do dia' : 'Sem compromissos hoje'}</p>
                    </div>
                  </div>
                  <RailList events={todayEvents} clients={clients} processes={processes} emptyTitle="Sem compromissos hoje." emptyCopy="A agenda do dia aparece aqui." />
                </div>

                <div className="rail-block">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">Próximos</h2>
                      <p className="section-note">{upcomingEvents.length ? 'Em ordem cronológica' : 'Sem próximos compromissos'}</p>
                    </div>
                  </div>
                  <RailList events={upcomingEvents} clients={clients} processes={processes} emptyTitle="Sem próximos compromissos." emptyCopy="Os próximos registros aparecem aqui." />
                </div>

                <div className="rail-block">
                  <div className="section-head">
                    <div>
                      <h2 className="section-title">Atrasados</h2>
                      <p className="section-note">{overdueEvents.length ? 'Pedem atenção' : 'Nada em atraso'}</p>
                    </div>
                  </div>
                  <RailList events={overdueEvents} clients={clients} processes={processes} emptyTitle="Sem atrasos." emptyCopy="Nenhum compromisso vencido." />
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
