import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { formatDate, formatDateTime, formatTime, getStatusTone } from '../utils';
import { NotFoundState } from './common';

export function EventDetailPage() {
  const params = useParams();
  const { clients, events, processes } = useAppState();
  const eventItem = events.find((item) => item.id === params.eventId) || null;

  if (!eventItem) {
    return <NotFoundState title="Compromisso não encontrado." />;
  }

  const client = clients.find((item) => item.id === eventItem.clientId) || null;
  const process = processes.find((item) => item.id === eventItem.processId) || null;

  return (
    <>
      <PageChrome
        label="Compromisso"
        actions={(
          <>
            <Link className="btn btn-secondary" to={`/agenda/${eventItem.id}/editar`}>Editar</Link>
            <Link className="btn btn-danger" to={`/agenda/${eventItem.id}/excluir`}>Excluir</Link>
          </>
        )}
      />

      <div className="event-page">
        <section className="surface event-hero">
          <div className="crumbs">
            <Link to="/agenda">Agenda</Link>
          </div>

          <div className="event-hero-grid">
            <div className="event-identity">
              <div className="identity-row">
                <div className="event-mark" aria-hidden="true">EV</div>
                <div>
                  <h1 className="event-title">{eventItem.title}</h1>
                  <p className="event-subtitle">{formatDate(eventItem.start)} • {formatTime(eventItem.start)} até {formatTime(eventItem.end)}</p>
                </div>
              </div>

              <aside className="hero-summary">
                <article className="summary-card summary-card-status">
                  <span>Status</span>
                  <StatusBadge tone={getStatusTone(eventItem.status, eventItem.completed)}>{eventItem.completed ? 'Concluído' : eventItem.status}</StatusBadge>
                </article>

                <article className="summary-card">
                  <span>Cliente</span>
                  <strong>{client?.name || 'Não vinculado'}</strong>
                </article>

                <article className="summary-card">
                  <span>Processo</span>
                  <strong>{process?.number || 'Não vinculado'}</strong>
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
                  <strong>{eventItem.type || '-'}</strong>
                </article>
                <article className="detail-item">
                  <span>Responsável</span>
                  <strong>{eventItem.responsible || '-'}</strong>
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
                    <StatusBadge tone={getStatusTone(eventItem.status, eventItem.completed)}>{eventItem.status}</StatusBadge>
                  </div>
                </article>
                <article className="detail-item">
                  <span>Prioridade</span>
                  <div className="detail-badge-wrap">
                    <StatusBadge tone={getStatusTone(eventItem.priority)} className="priority-badge">{eventItem.priority || '-'}</StatusBadge>
                  </div>
                </article>
                <article className="detail-item span-2">
                  <span>Local</span>
                  <strong>{eventItem.location || 'Não informado'}</strong>
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
                      <div className="link-mark" aria-hidden="true">{client.name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <h3 className="link-title">{client.name}</h3>
                        <p className="link-copy">Cliente vinculado ao compromisso.</p>
                      </div>
                    </div>
                    <div className="link-meta">
                      {client.email ? <span className="meta-chip">{client.email}</span> : null}
                      {client.phone ? <span className="meta-chip">{client.phone}</span> : null}
                    </div>
                  </Link>
                ) : null}

                {process ? (
                  <Link className="link-card" to={`/processos/${process.id}`}>
                    <div className="link-head">
                      <div className="link-mark" aria-hidden="true">PJ</div>
                      <div>
                        <h3 className="link-title">{process.number}</h3>
                        <p className="link-copy">{process.area || 'Processo vinculado'}</p>
                      </div>
                    </div>
                    <div className="link-meta">
                      {process.court ? <span className="meta-chip">{process.court}</span> : null}
                      {process.owner ? <span className="meta-chip">{process.owner}</span> : null}
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
                  <strong>{formatTime(eventItem.start)} - {formatTime(eventItem.end)}</strong>
                </article>
                <article className="detail-item">
                  <span>Situação</span>
                  <strong>{eventItem.completed ? 'Encerrado' : 'Em andamento'}</strong>
                </article>
                <article className="detail-item">
                  <span>Origem</span>
                  <strong>{eventItem.createdBy || 'Interno'}</strong>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export function EventDeletePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { deleteEvent, events } = useAppState();
  const eventItem = events.find((item) => item.id === params.eventId) || null;

  if (!eventItem) {
    return <NotFoundState title="Compromisso não encontrado." />;
  }

  async function handleDelete(event) {
    event.preventDefault();
    const wasDeleted = await deleteEvent(eventItem.id);
    if (!wasDeleted) {
      return;
    }
    navigate('/agenda', { replace: true });
  }

  return (
    <>
      <PageChrome label="Excluir" actions={<Link className="btn btn-secondary" to={`/agenda/${eventItem.id}`}>Voltar</Link>} />

      <div className="confirm-page">
        <section className="surface confirm-intro">
          <div className="section-head">
            <div>
              <h1 className="confirm-title">Excluir compromisso</h1>
              <p className="confirm-copy">Revise o registro antes de confirmar. A exclusão remove este item do fluxo principal.</p>
            </div>
          </div>
        </section>

        <section className="surface confirm-panel">
          <div className="confirm-box">
            <div className="confirm-alert">
              <strong>Ação irreversível.</strong>
              <p>Depois da confirmação, este registro não poderá ser recuperado pela interface.</p>
            </div>

            <div className="confirm-meta">
              <span>Registro selecionado</span>
              <strong>{eventItem.title}</strong>
              <p>{formatDateTime(eventItem.start)}</p>
            </div>

            <form onSubmit={handleDelete}>
              <div className="confirm-actions">
                <button className="btn btn-danger" type="submit">Confirmar exclusão</button>
                <Link className="btn btn-secondary" to={`/agenda/${eventItem.id}`}>Cancelar</Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
