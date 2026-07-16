import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, StatusBadge } from '../layout';
import { useAppState } from '../store';
import { getStatusTone } from '../utils';
import { NotFoundState } from './common';
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
      <PageChrome
        label="Prazo"
        actions={
          <>
            <Link className="btn btn-secondary" to={`/prazos/${deadline.id}/editar`}>
              Editar
            </Link>
            <button className="btn btn-danger" type="button" onClick={handleDelete}>
              Excluir
            </button>
          </>
        }
      />

      <div className="deadline-detail-page">
        <section className="surface deadline-detail-hero">
          <div className="crumbs">
            <Link to={`/prazos?data=${encodeURIComponent(dateInputValue(deadlineMoment(deadline)))}`}>
              Prazos
            </Link>
          </div>

          <div className="deadline-detail-head">
            <div>
              <h1 className="intro-title">{deadlineTitle}</h1>
              <p className="section-note">Prazo fatal do processo</p>
            </div>
            <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
              {statusLabel}
            </StatusBadge>
          </div>
        </section>

        <div className="deadline-detail-layout">
          <section className="surface deadline-timer-panel">
            <div className="deadline-timer-copy">
              <span>Tempo gasto</span>
              <strong>{formatDuration(elapsedSeconds)}</strong>
              <p>{isTimerRunning ? 'Timer em andamento.' : 'Timer pausado.'}</p>
            </div>

            <div className="deadline-timer-actions">
              <button
                className="btn"
                type="button"
                onClick={handleTimerStart}
                disabled={isTimerRunning || isTimerSaving}
              >
                Iniciar
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={handleTimerPause}
                disabled={!isTimerRunning || isTimerSaving}
              >
                Pausar
              </button>
            </div>
          </section>

          <section className="surface deadline-detail-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Documento no Drive</h2>
                <p className="section-note">Arquivo da pasta do processo</p>
              </div>
              {deadline.driveFileId ? (
                <StatusBadge tone="success">Documento criado</StatusBadge>
              ) : null}
            </div>

            <input
              ref={docInputRef}
              type="file"
              hidden
              onChange={handleUploadDoc}
            />

            {deadline.driveFileId || deadline.driveLink ? (
              <div className="deadline-doc-actions">
                {deadline.driveLink ? (
                  <a className="btn" href={deadline.driveLink} target="_blank" rel="noreferrer">
                    Abrir no Drive
                  </a>
                ) : null}
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={handleRemoveDoc}
                  disabled={isDocBusy}
                >
                  Remover
                </button>
              </div>
            ) : (
              <div className="deadline-doc-actions">
                <button
                  className="btn"
                  type="button"
                  onClick={handleCreateDoc}
                  disabled={isDocBusy}
                >
                  {isDocBusy ? 'Criando…' : 'Criar documento'}
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={isDocBusy}
                >
                  Enviar arquivo
                </button>
              </div>
            )}
          </section>

          <section className="surface deadline-detail-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Descrição</h2>
                <p className="section-note">Tarefa vinculada ao prazo</p>
              </div>
            </div>

            <div className="deadline-description-box">
              {deadline.description || 'Sem descrição cadastrada.'}
            </div>
          </section>

          <section className="surface deadline-detail-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Dados</h2>
                <p className="section-note">Vinculos do prazo</p>
              </div>
            </div>

            <div className="detail-grid">
              <article className="detail-item">
                <span>Processo</span>
                {process ? <Link to={`/processos/${process.id}`}>{process.number}</Link> : <strong>-</strong>}
              </article>
              <article className="detail-item">
                <span>Responsável</span>
                <strong>{deadline.responsibleName || '-'}</strong>
              </article>
              <article className="detail-item">
                <span>Cliente</span>
                {client ? <Link to={`/clientes/${client.id}`}>{client.name}</Link> : <strong>-</strong>}
              </article>
              <article className="detail-item">
                <span>Status</span>
                <div className="detail-badge-wrap">
                  <StatusBadge tone={getStatusTone(statusLabel, deadline.completed)}>
                    {statusLabel}
                  </StatusBadge>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
