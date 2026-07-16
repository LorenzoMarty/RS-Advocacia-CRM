import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { getStatusTone } from '../utils';
import {
  DetailGrid,
  DetailItem,
  DetailHero,
  DetailSection,
  NotFoundState,
} from './common';
import {
  buildDeadlineTitle,
  dateInputValue,
  deadlineMoment,
  deadlineStatusLabel,
  elapsedSecondsForDeadline,
  formatDuration,
} from './deadlines-utils';

export function DeadlineDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { confirm, confirmPopup } = useConfirmPopup();
  const {
    clients,
    createDeadlineDocument,
    deleteDeadline,
    deadlines,
    isDeadlinesLoading,
    loadDeadline,
    processes,
    removeDeadlineDocument,
    saveDeadlineTimer,
    uploadDeadlineDocument,
  } = useAppState();
  const [remoteDeadline, setRemoteDeadline] = useState(null);
  const deadline = remoteDeadline || deadlines.find((item) => item.id === params.deadlineId) || null;
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isTimerSaving, setIsTimerSaving] = useState(false);
  const [isDocBusy, setIsDocBusy] = useState(false);
  const docInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchDeadline() {
      const deadlineData = await loadDeadline(params.deadlineId);

      if (isMounted) {
        setRemoteDeadline(deadlineData);
      }
    }

    fetchDeadline();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.deadlineId]);

  useEffect(() => {
    if (!deadline?.timerStartedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [deadline?.timerStartedAt]);

  if (!deadline) {
    if (isDeadlinesLoading) {
      return null;
    }

    return <NotFoundState title="Prazo não encontrado." />;
  }

  const process = processes.find((item) => item.id === deadline.processId) || null;
  const client = clients.find((item) => item.id === deadline.clientId) || null;
  const deadlineTitle = buildDeadlineTitle(process, deadline.responsibleName) || deadline.title;
  const statusLabel = deadlineStatusLabel(deadline);
  const isTimerRunning = Boolean(deadline.timerStartedAt);
  const elapsedSeconds = elapsedSecondsForDeadline(deadline, currentTime);

  async function handleTimerStart() {
    if (isTimerRunning || isTimerSaving) {
      return;
    }

    setIsTimerSaving(true);
    try {
      const savedDeadline = await saveDeadlineTimer(deadline.id, {
        elapsedSeconds,
        timerStartedAt: new Date().toISOString(),
      });
      if (savedDeadline) {
        setRemoteDeadline(savedDeadline);
      }
      setCurrentTime(Date.now());
    } finally {
      setIsTimerSaving(false);
    }
  }

  async function handleTimerPause() {
    if (!isTimerRunning || isTimerSaving) {
      return;
    }

    setIsTimerSaving(true);
    try {
      const savedDeadline = await saveDeadlineTimer(deadline.id, {
        elapsedSeconds,
        timerStartedAt: '',
      });
      if (savedDeadline) {
        setRemoteDeadline(savedDeadline);
      }
      setCurrentTime(Date.now());
    } finally {
      setIsTimerSaving(false);
    }
  }

  async function handleCreateDoc() {
    if (isDocBusy) return;
    setIsDocBusy(true);
    try {
      const saved = await createDeadlineDocument(deadline.id);
      if (saved) {
        setRemoteDeadline(saved);
        if (saved.driveLink) {
          window.open(saved.driveLink, '_blank', 'noopener');
        }
      }
    } finally {
      setIsDocBusy(false);
    }
  }

  async function handleUploadDoc(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isDocBusy) return;
    setIsDocBusy(true);
    try {
      const saved = await uploadDeadlineDocument(deadline.id, file);
      if (saved) {
        setRemoteDeadline(saved);
      }
    } finally {
      setIsDocBusy(false);
    }
  }

  async function handleRemoveDoc() {
    if (isDocBusy) return;
    const apagar = await confirm({
      title: 'Remover o documento deste prazo?',
      message: 'Apagar o arquivo também remove o arquivo do Drive (era temporário). Manter só desvincula o documento do prazo, sem apagá-lo.',
      confirmLabel: 'Apagar arquivo',
      cancelLabel: 'Manter arquivo',
      tone: 'danger',
    });
    setIsDocBusy(true);
    try {
      const saved = await removeDeadlineDocument(deadline.id, { deleteFile: apagar });
      if (saved) {
        setRemoteDeadline(saved);
      }
    } finally {
      setIsDocBusy(false);
    }
  }

  async function handleDelete() {
    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O prazo "${deadlineTitle}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    const wasDeleted = await deleteDeadline(deadline.id);
    if (wasDeleted) {
      navigate(`/prazos?data=${encodeURIComponent(dateInputValue(deadlineMoment(deadline)))}`, { replace: true });
    }
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Prazo" />

      <div className="grid gap-4">
        <DetailHero
          breadcrumbLabel="Prazos"
          breadcrumbTo={`/prazos?data=${encodeURIComponent(dateInputValue(deadlineMoment(deadline)))}`}
          mark="PZ"
          title={deadlineTitle}
          subtitle="Prazo fatal do processo"
          meta={
            <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
              {statusLabel}
            </StatusBadge>
          }
          actions={
            <>
              <Button asChild variant="outline">
                <Link to={`/prazos/${deadline.id}/editar`}>Editar</Link>
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
              >
                Excluir
              </Button>
            </>
          }
        />

        <DetailSection title="Tempo gasto" note={isTimerRunning ? 'Timer em andamento.' : 'Timer pausado.'}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <strong className="font-serif text-3xl text-foreground">{formatDuration(elapsedSeconds)}</strong>
            <div className="flex gap-2">
              <Button onClick={handleTimerStart} disabled={isTimerRunning || isTimerSaving}>
                Iniciar
              </Button>
              <Button variant="outline" onClick={handleTimerPause} disabled={!isTimerRunning || isTimerSaving}>
                Pausar
              </Button>
            </div>
          </div>
        </DetailSection>

        <DetailSection
          title="Documento no Drive"
          note="Arquivo da pasta do processo"
          badge={deadline.driveFileId ? <Badge>Documento criado</Badge> : null}
        >
          <input
            ref={docInputRef}
            type="file"
            hidden
            onChange={handleUploadDoc}
          />

          {deadline.driveFileId || deadline.driveLink ? (
            <div className="flex flex-wrap gap-2">
              {deadline.driveLink ? (
                <Button asChild>
                  <a href={deadline.driveLink} target="_blank" rel="noreferrer">Abrir no Drive</a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleRemoveDoc}
                disabled={isDocBusy}
              >
                Remover
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCreateDoc} disabled={isDocBusy}>
                {isDocBusy ? 'Criando…' : 'Criar documento'}
              </Button>
              <Button variant="outline" onClick={() => docInputRef.current?.click()} disabled={isDocBusy}>
                Enviar arquivo
              </Button>
            </div>
          )}
        </DetailSection>

        <DetailSection title="Descrição" note="Tarefa vinculada ao prazo">
          <div className="deadline-description-box">
            {deadline.description || 'Sem descrição cadastrada.'}
          </div>
        </DetailSection>

        <DetailSection title="Dados" note="Vinculos do prazo">
          <DetailGrid>
            <DetailItem label="Processo">
              {process ? <Link className="hover:text-primary" to={`/processos/${process.id}`}>{process.number}</Link> : '-'}
            </DetailItem>
            <DetailItem label="Responsável">{deadline.responsibleName || '-'}</DetailItem>
            <DetailItem label="Cliente">
              {client ? <Link className="hover:text-primary" to={`/clientes/${client.id}`}>{client.name}</Link> : '-'}
            </DetailItem>
            <DetailItem label="Status">
              <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
                {statusLabel}
              </StatusBadge>
            </DetailItem>
          </DetailGrid>
        </DetailSection>
      </div>
    </>
  );
}
