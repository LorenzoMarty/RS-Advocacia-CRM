import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { formatDate } from '../utils';
import { NotFoundState } from './common';

function startOfDay() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek() {
  const d = startOfDay();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

function progressPercent(value, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function formatHoursCompact(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (!h && !m) return '0h';
  return `${h ? `${h}h` : ''}${h && m ? ' ' : ''}${m ? `${m}m` : ''}`;
}

function groupByKey(items, keyFn) {
  return items.reduce((acc, item) => {
    const k = keyFn(item);
    acc[k] = acc[k] || [];
    acc[k].push(item);
    return acc;
  }, {});
}

export function AuditPage() {
  const { clients, currentRole, deadlines, processes, timeEntries, users } = useAppState();
  const isAdmin = currentRole?.name === 'Administrador';

  const todayStart = useMemo(() => startOfDay(), []);
  const in7Days = useMemo(() => new Date(todayStart.getTime() + 7 * 24 * 3600 * 1000), [todayStart]);
  const weekStart = useMemo(() => startOfWeek(), []);

  const activeProcesses = useMemo(
    () => processes.filter((p) => p.status !== 'Arquivado' && p.status !== 'Concluído'),
    [processes],
  );

  const overdueDeadlines = useMemo(
    () => deadlines.filter((d) => !d.completed && d.date && new Date(`${d.date}T12:00:00`) < todayStart),
    [deadlines, todayStart],
  );

  const soonDeadlines = useMemo(
    () => deadlines.filter((d) => {
      if (d.completed || !d.date) return false;
      const dd = new Date(`${d.date}T12:00:00`);
      return dd >= todayStart && dd <= in7Days;
    }),
    [deadlines, todayStart, in7Days],
  );

  const runningTimers = useMemo(() => timeEntries.filter((e) => e.status === 'running'), [timeEntries]);
  const mensalistaCount = useMemo(() => clients.filter((c) => c.clientType === 'mensalista').length, [clients]);

  const ownerGroups = useMemo(() => {
    const groups = groupByKey(processes, (p) => p.owner || 'Sem responsável');
    return Object.entries(groups)
      .map(([name, items]) => ({ name, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [processes]);
  const maxOwnerCount = ownerGroups[0]?.count || 0;

  const statusGroups = useMemo(() => {
    const groups = groupByKey(processes, (p) => p.status || 'Sem status');
    return Object.entries(groups)
      .map(([status, items]) => ({ status, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [processes]);

  const areaGroups = useMemo(() => {
    const groups = groupByKey(processes, (p) => p.area || 'Sem área');
    return Object.entries(groups)
      .map(([area, items]) => ({ area, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [processes]);

  const criticalDeadlines = useMemo(
    () => [...overdueDeadlines, ...soonDeadlines].sort(
      (a, b) => new Date(`${a.date}T12:00:00`) - new Date(`${b.date}T12:00:00`),
    ),
    [overdueDeadlines, soonDeadlines],
  );

  const responsiblePending = useMemo(() => {
    const pending = deadlines.filter((d) => !d.completed && d.status !== 'protocolado');
    const groups = groupByKey(pending, (d) => d.responsible || 'Sem responsável');
    return Object.entries(groups)
      .map(([name, items]) => ({ name, count: items.length }))
      .sort((a, b) => b.count - a.count);
  }, [deadlines]);
  const maxResponsibleCount = responsiblePending[0]?.count || 0;

  const processClientIds = useMemo(() => new Set(processes.map((p) => p.clientId)), [processes]);
  const orphanClients = useMemo(
    () => clients.filter((c) => !processClientIds.has(c.id)),
    [clients, processClientIds],
  );

  const userWeekSeconds = useMemo(() => {
    const weekEntries = timeEntries.filter((e) => {
      const date = new Date(e.endedAt || e.startedAt);
      return !Number.isNaN(date.getTime()) && date >= weekStart;
    });
    return users
      .map((u) => ({
        user: u,
        seconds: weekEntries
          .filter((e) => e.userId === u.id)
          .reduce((sum, e) => sum + Math.max(0, Math.floor(Number(e.totalSeconds) || 0)), 0),
      }))
      .filter((u) => u.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 7);
  }, [users, timeEntries, weekStart]);
  const maxUserSeconds = userWeekSeconds[0]?.seconds || 0;

  if (!isAdmin) {
    return <NotFoundState title="Auditoria restrita." copy="Apenas administradores acessam a auditoria do escritório." />;
  }

  return (
    <>
      <PageChrome label="Auditoria" />
      <div className="audit-page">

        <section className="surface section-card audit-card">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Auditoria do escritório</h1>
              <p className="section-note">Visão geral operacional</p>
            </div>
          </div>
          <div className="productivity-kpis audit-kpis">
            <div className="productivity-kpi">
              <span>Processos ativos</span>
              <strong>{activeProcesses.length}</strong>
            </div>
            <div className="productivity-kpi">
              <span>Prazos vencidos</span>
              <strong className={overdueDeadlines.length ? 'audit-danger-text' : ''}>{overdueDeadlines.length}</strong>
            </div>
            <div className="productivity-kpi">
              <span>Timers rodando</span>
              <strong>{runningTimers.length}</strong>
            </div>
            <div className="productivity-kpi">
              <span>Mensalistas</span>
              <strong>{mensalistaCount} / {clients.length}</strong>
            </div>
          </div>
        </section>

        <section className="surface section-card audit-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Prazos críticos</h2>
              <p className="section-note">Vencidos e vencendo em 7 dias</p>
            </div>
            <div className="audit-badge-group">
              {overdueDeadlines.length ? <span className="badge danger">{overdueDeadlines.length} vencido{overdueDeadlines.length !== 1 ? 's' : ''}</span> : null}
              {soonDeadlines.length ? <span className="badge warn">{soonDeadlines.length} próximo{soonDeadlines.length !== 1 ? 's' : ''}</span> : null}
            </div>
          </div>
          {criticalDeadlines.length ? (
            <div className="audit-critical-list">
              {criticalDeadlines.map((d) => {
                const dDate = new Date(`${d.date}T12:00:00`);
                const isOverdue = dDate < todayStart;
                return (
                  <Link key={d.id} className={`audit-critical-item${isOverdue ? ' is-overdue' : ' is-soon'}`} to={`/prazos/${d.id}`}>
                    <div>
                      <strong>{d.title}</strong>
                      <span>{d.responsible || 'Sem responsável'}{d.processNumber ? ` • ${d.processNumber}` : ''}</span>
                    </div>
                    <span className="audit-critical-date">{formatDate(dDate)}</span>
                    <StatusBadge tone={isOverdue ? 'danger' : 'warn'}>
                      {isOverdue ? 'Vencido' : 'Em breve'}
                    </StatusBadge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="note-box">Sem prazos críticos.</div>
          )}
        </section>

        <div className="audit-grid-2">
          <section className="surface section-card audit-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Processos por responsável</h2>
                <p className="section-note">Distribuição de carga</p>
              </div>
            </div>
            {ownerGroups.length ? (
              <div className="audit-bar-list">
                {ownerGroups.map((item) => (
                  <div key={item.name} className="audit-bar-row">
                    <strong>{item.name}</strong>
                    <div className="productivity-bar">
                      <span style={{ width: `${progressPercent(item.count, maxOwnerCount)}%` }} />
                    </div>
                    <span>{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="note-box">Sem processos cadastrados.</div>
            )}
          </section>

          <section className="surface section-card audit-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Prazos pendentes por responsável</h2>
                <p className="section-note">Itens em aberto</p>
              </div>
            </div>
            {responsiblePending.length ? (
              <div className="audit-bar-list">
                {responsiblePending.map((item) => (
                  <div key={item.name} className="audit-bar-row">
                    <strong>{item.name}</strong>
                    <div className="productivity-bar">
                      <span style={{ width: `${progressPercent(item.count, maxResponsibleCount)}%` }} />
                    </div>
                    <span>{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="note-box">Sem prazos pendentes.</div>
            )}
          </section>
        </div>

        <div className="audit-grid-2">
          <section className="surface section-card audit-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Processos por status</h2>
                <p className="section-note">Todos os processos</p>
              </div>
            </div>
            <div className="audit-pill-grid">
              {statusGroups.map((item) => (
                <div key={item.status} className="audit-pill">
                  <span>{item.status}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {!statusGroups.length ? <div className="note-box">Sem dados.</div> : null}
            </div>
          </section>

          <section className="surface section-card audit-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Processos por área</h2>
                <p className="section-note">Todos os processos</p>
              </div>
            </div>
            <div className="audit-pill-grid">
              {areaGroups.map((item) => (
                <div key={item.area} className="audit-pill">
                  <span>{item.area}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {!areaGroups.length ? <div className="note-box">Sem dados.</div> : null}
            </div>
          </section>
        </div>

        <div className="audit-grid-2">
          <section className="surface section-card audit-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Clientes sem processo</h2>
                <p className="section-note">{orphanClients.length} de {clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
              </div>
              <Link className="btn btn-secondary" to="/clientes">Ver todos</Link>
            </div>
            {orphanClients.length ? (
              <div className="audit-orphan-list">
                {orphanClients.map((c) => (
                  <Link key={c.id} className="audit-orphan-item" to={`/clientes/${c.id}`}>
                    <span className="audit-avatar">{c.name.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{c.name}</strong>
                      <span>{c.clientType === 'mensalista' ? 'Mensalista' : 'Esporádico'}</span>
                    </div>
                    <span className="audit-orphan-arrow">Ver →</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="note-box">Todos os clientes têm processos vinculados.</div>
            )}
          </section>

          <section className="surface section-card audit-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Horas na semana</h2>
                <p className="section-note">Registradas por usuário</p>
              </div>
              <Link className="btn btn-secondary" to="/produtividade">Ver completo</Link>
            </div>
            {userWeekSeconds.length ? (
              <div className="audit-bar-list">
                {userWeekSeconds.map(({ user, seconds }) => (
                  <div key={user.id} className="audit-bar-row">
                    <strong>{user.name}</strong>
                    <div className="productivity-bar">
                      <span style={{ width: `${progressPercent(seconds, maxUserSeconds)}%` }} />
                    </div>
                    <span>{formatHoursCompact(seconds)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="note-box">Nenhum tempo registrado nesta semana.</div>
            )}
          </section>
        </div>

      </div>
    </>
  );
}
