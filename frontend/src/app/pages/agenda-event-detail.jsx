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
  formatPhone,
  normalizeText,
} from "../utils";
import { Button } from "@/components/ui/button";

import {
  DetailGrid,
  DetailHero,
  DetailItem,
  DetailLayout,
  DetailSection,
  DetailStack,
  NotFoundState,
} from "./common";

export function EventDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { clients, deleteEvent, events, loadEvent, markEventAttendance, processes } = useAppState();
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
    const updated = await markEventAttendance(eventItem.id, attended);
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
      <PageChrome label="Compromisso" />

      <div className="grid gap-4">
        <DetailHero
          breadcrumbLabel="Agenda"
          breadcrumbTo="/agenda"
          mark="EV"
          title={eventItem.title}
          subtitle={`${formatDate(eventItem.start)} • ${formatTime(eventItem.start)} até ${formatTime(eventItem.end)}`}
          actions={
            <>
              {!eventItem.completed && !normalizeText(eventItem.status || '').includes('compareceu') && (
                <>
                  <Button onClick={() => handleMarkAttendance(true)}>Compareceu</Button>
                  <Button variant="outline" onClick={() => handleMarkAttendance(false)}>Não compareceu</Button>
                </>
              )}
              <Button asChild variant="outline">
                <Link to={`/agenda/${eventItem.id}/editar`}>Editar</Link>
              </Button>
              <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={handleDeleteEvent}>
                Excluir
              </Button>
            </>
          }
          summary={[
            {
              label: 'Status',
              value: (
                <StatusBadge tone={getStatusTone(isOverdueEvent(eventItem) ? 'Atrasado' : eventItem.status, eventItem.completed)}>
                  {eventItem.completed ? "Concluído" : isOverdueEvent(eventItem) ? "Atrasado" : eventItem.status}
                </StatusBadge>
              ),
            },
            { label: 'Cliente', value: client?.name || "Não vinculado" },
            { label: 'Processo', value: process?.number || "Não vinculado" },
          ]}
        />

        <DetailLayout>
          <DetailStack>
            <DetailSection title="Informações" note="Essenciais">
              <DetailGrid>
                <DetailItem label="Título" span>{eventItem.title}</DetailItem>
                <DetailItem label="Tipo">{eventItem.type || "-"}</DetailItem>
                <DetailItem label="Responsável">{eventItem.responsibleName || "-"}</DetailItem>
                <DetailItem label="Início">{formatDateTime(eventItem.start)}</DetailItem>
                <DetailItem label="Fim">{formatDateTime(eventItem.end)}</DetailItem>
                <DetailItem label="Status">
                  <StatusBadge
                    tone={getStatusTone(
                      isOverdueEvent(eventItem) ? 'Atrasado' : eventItem.status,
                      eventItem.completed,
                    )}
                  >
                    {isOverdueEvent(eventItem) ? "Atrasado" : eventItem.status}
                  </StatusBadge>
                </DetailItem>
                <DetailItem label="Prioridade">
                  <StatusBadge tone={getStatusTone(eventItem.priority)}>
                    {eventItem.priority || "-"}
                  </StatusBadge>
                </DetailItem>
                <DetailItem label="Local" span>{eventItem.location || "Não informado"}</DetailItem>
              </DetailGrid>
            </DetailSection>

            {eventItem.description || eventItem.notes ? (
              <DetailSection title="Observações" note="Contexto">
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
              </DetailSection>
            ) : null}
          </DetailStack>

          <DetailStack>
            <DetailSection title="Vínculos" note="Relacionados">
              <div className="flex flex-col gap-3">
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
                        <span className="meta-chip">{formatPhone(client.phone)}</span>
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
            </DetailSection>

            <DetailSection title="Resumo rápido" note="Leitura imediata">
              <DetailGrid>
                <DetailItem label="Data">{formatDate(eventItem.start)}</DetailItem>
                <DetailItem label="Horário">
                  {formatTime(eventItem.start)} - {formatTime(eventItem.end)}
                </DetailItem>
                <DetailItem label="Situação">
                  {eventItem.completed ? "Encerrado" : "Em andamento"}
                </DetailItem>
                <DetailItem label="Origem">{eventItem.createdBy || "Interno"}</DetailItem>
              </DetailGrid>
            </DetailSection>
          </DetailStack>
        </DetailLayout>
      </div>
    </>
  );
}
