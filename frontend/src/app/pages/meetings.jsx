import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AudioRecorder } from '../components/audio-recorder';
import { useRecordingPolling } from '../hooks/use-recording-polling';
import { PageChrome, StatusBadge } from '../layout';
import {
  createMeeting,
  getRecording,
  listMeetings,
  uploadRecording,
} from '../services/meetings';
import { useAppState } from '../store';

const EMPTY_FORM = {
  title: '',
  meetingAt: '',
  clientId: '',
  processId: '',
  agenda: '',
};

function statusTone(status) {
  if (status === 'concluida') {
    return 'success';
  }
  if (status === 'falhou') {
    return 'danger';
  }
  return 'gold';
}

function formatDateTime(value) {
  if (!value) {
    return 'Sem data definida';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorText(error) {
  return error instanceof Error ? error.message : 'Falha ao comunicar com a API.';
}

function RecordingResult({ recording }) {
  return (
    <article className="recording-result">
      <div className="recording-result-head">
        <div>
          <strong>{recording.filename}</strong>
          <p>{recording.transcriptionModel || 'Aguardando processamento'}</p>
        </div>
        <StatusBadge tone={statusTone(recording.status)}>
          {recording.statusLabel || recording.status}
        </StatusBadge>
      </div>

      {recording.processingError ? (
        <p className="recording-failure">{recording.processingError}</p>
      ) : null}

      {recording.summary ? (
        <div className="ai-output">
          <h3>Resumo</h3>
          <pre>{recording.summary}</pre>
        </div>
      ) : null}

      {recording.transcript ? (
        <details className="transcript-panel">
          <summary>Ver transcrição</summary>
          <p>{recording.transcript}</p>
        </details>
      ) : null}
    </article>
  );
}

export function MeetingsPage() {
  const { addFlash, clients, processes } = useAppState();
  const addFlashRef = useRef(addFlash);
  const [form, setForm] = useState(EMPTY_FORM);
  const [meetings, setMeetings] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    addFlashRef.current = addFlash;
  }, [addFlash]);

  const refreshMeetings = useCallback(async (showError = false) => {
    try {
      const nextMeetings = await listMeetings();
      setMeetings(nextMeetings);
      setSelectedId((currentId) => currentId || nextMeetings[0]?.id || '');
    } catch (error) {
      if (showError) {
        addFlashRef.current(errorText(error), 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMeetings(true);
  }, [refreshMeetings]);

  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedId) || null;
  const availableProcesses = useMemo(
    () => processes.filter((process) => process.clientId === form.clientId),
    [form.clientId, processes],
  );

  const refreshRecording = useCallback(async (recordingId) => {
    const updatedRecording = await getRecording(recordingId);
    setMeetings((current) => current.map((meeting) => ({
      ...meeting,
      recordings: meeting.recordings.map((recording) => (
        recording.id === updatedRecording.id ? updatedRecording : recording
      )),
    })));
  }, []);

  useRecordingPolling(selectedMeeting?.recordings || [], refreshRecording);

  async function handleCreate(event) {
    event.preventDefault();
    if (!form.title.trim()) {
        addFlashRef.current('Informe o título da reunião.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const meeting = await createMeeting(form);
      setMeetings((current) => [meeting, ...current]);
      setSelectedId(meeting.id);
      setForm(EMPTY_FORM);
      addFlashRef.current('Reunião criada.', 'success');
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload(recording) {
    if (!selectedMeeting) {
      return false;
    }

    try {
      const savedRecording = await uploadRecording(selectedMeeting.id, recording);
      setMeetings((current) => current.map((meeting) => (
        meeting.id === selectedMeeting.id
          ? { ...meeting, recordings: [savedRecording, ...meeting.recordings] }
          : meeting
      )));
      addFlashRef.current('Áudio enviado para transcrição e resumo.', 'success');
      return true;
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
      return false;
    }
  }

  return (
    <>
      <PageChrome label="Reuniões" />
      <div className="meetings-page">
        <section className="surface meetings-intro">
          <div>
            <p className="section-note">Reuniões com IA</p>
            <h1 className="meetings-title">Gravação, transcrição e resumo.</h1>
            <p className="meetings-copy">
              O áudio é processado em segundo plano; a tela atualiza o resultado automaticamente.
            </p>
          </div>
        </section>

        <div className="meetings-layout">
          <section className="surface meetings-form-panel">
            <div className="section-head">
              <div>
                <h2 className="section-title">Nova reunião</h2>
                <p className="section-note">Contexto antes da gravação</p>
              </div>
            </div>

            <form className="meeting-form" onSubmit={handleCreate}>
              <label>
                Título
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>
              <label>
                Data e horário
                <input
                  type="datetime-local"
                  value={form.meetingAt}
                  onChange={(event) => setForm((current) => ({ ...current, meetingAt: event.target.value }))}
                />
              </label>
              <label>
                Cliente
                <select
                  value={form.clientId}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    clientId: event.target.value,
                    processId: '',
                  }))}
                >
                  <option value="">Sem vínculo</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Processo
                <select
                  value={form.processId}
                  onChange={(event) => setForm((current) => ({ ...current, processId: event.target.value }))}
                  disabled={!form.clientId}
                >
                  <option value="">Sem vínculo</option>
                  {availableProcesses.map((process) => (
                    <option key={process.id} value={process.id}>{process.number}</option>
                  ))}
                </select>
              </label>
              <label>
                Pauta
                <textarea
                  rows="4"
                  value={form.agenda}
                  onChange={(event) => setForm((current) => ({ ...current, agenda: event.target.value }))}
                />
              </label>
              <button className="btn" type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Criar reunião'}
              </button>
            </form>
          </section>

          <section className="surface meetings-workspace">
            <div className="meeting-picker">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Gravações</h2>
                  <p className="section-note">Selecione uma reunião</p>
                </div>
              </div>

              {isLoading ? <p className="section-note">Carregando...</p> : null}
              {!isLoading && !meetings.length ? (
                <div className="empty">
                  <strong>Nenhuma reunião cadastrada.</strong>
                  <p>Crie a primeira reunião para habilitar a gravação.</p>
                </div>
              ) : (
                <div className="meeting-options">
                  {meetings.map((meeting) => (
                    <button
                      key={meeting.id}
                      type="button"
                      className={`meeting-option${meeting.id === selectedId ? ' active' : ''}`}
                      onClick={() => setSelectedId(meeting.id)}
                    >
                      <strong>{meeting.title}</strong>
                      <span>{formatDateTime(meeting.meetingAt)}</span>
                      <span>{meeting.clientName || 'Sem cliente vinculado'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedMeeting ? (
              <div className="meeting-detail">
                <div className="meeting-context">
                  <h2>{selectedMeeting.title}</h2>
                  <p>
                    {selectedMeeting.processNumber || 'Sem processo vinculado'} | {formatDateTime(selectedMeeting.meetingAt)}
                  </p>
                </div>
                <AudioRecorder onUpload={handleUpload} />
                <div className="recording-results">
                  {selectedMeeting.recordings.map((recording) => (
                    <RecordingResult key={recording.id} recording={recording} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
