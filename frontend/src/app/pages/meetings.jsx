import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { AudioRecorder } from '../components/audio-recorder';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { useRecordingPolling } from '../hooks/use-recording-polling';
import { PageChrome, StatusBadge } from '../layout';
import {
  createMeeting,
  deleteMeeting,
  deleteRecording,
  finalizeMeeting,
  getMeeting,
  listMeetings,
  updateMeeting,
  updateRecording,
  uploadRecording,
} from '../services/meetings';
import { Select } from '../components/select';
import { useAppState } from '../store';
import { EmptyState } from './common';
import { MeetingSummary, RecordingPipeline } from './meeting-summary';
import { RecordingResult } from './recording-result';
import {
  EMPTY_FORM,
  errorText,
  formatDateTime,
  meetingToForm,
} from './meetings-utils';

export function MeetingsPage() {
  const { addFlash, clients } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const addFlashRef = useRef(addFlash);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMode, setFormMode] = useState('idle');
  const [editingMeetingId, setEditingMeetingId] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  useEffect(() => {
    addFlashRef.current = addFlash;
  }, [addFlash]);

  const refreshMeetings = useCallback(async (showError = false) => {
    try {
      const nextMeetings = await listMeetings();
      setMeetings(nextMeetings);
      setSelectedId((currentId) => (
        nextMeetings.some((meeting) => meeting.id === currentId)
          ? currentId
          : nextMeetings[0]?.id || ''
      ));
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
  const isMeetingFormOpen = formMode !== 'idle';
  const isEditingMeeting = formMode === 'edit';
  const meetingRefreshRef = useRef(false);
  // Segments refine a single meeting-level summary, so polling refreshes the
  // whole meeting (summary + transcript + segment statuses), not one recording.
  const refreshMeetingById = useCallback(async (meetingId) => {
    if (!meetingId || meetingRefreshRef.current) {
      return;
    }
    meetingRefreshRef.current = true;
    try {
      const updated = await getMeeting(meetingId);
      if (updated) {
        setMeetings((current) => current.map((meeting) => (
          meeting.id === updated.id ? updated : meeting
        )));
      }
    } finally {
      meetingRefreshRef.current = false;
    }
  }, []);

  useRecordingPolling(
    selectedMeeting?.recordings || [],
    () => refreshMeetingById(selectedMeeting?.id),
  );

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setEditingMeetingId('');
    setFormMode('create');
  }

  function openEditForm(meeting) {
    setForm(meetingToForm(meeting));
    setEditingMeetingId(meeting.id);
    setSelectedId(meeting.id);
    setFormMode('edit');
  }

  function closeMeetingForm() {
    setForm(EMPTY_FORM);
    setEditingMeetingId('');
    setFormMode('idle');
  }

  async function handleMeetingSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      addFlashRef.current('Informe o título da reunião.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const meeting = isEditingMeeting
        ? await updateMeeting(editingMeetingId, form)
        : await createMeeting(form);

      setMeetings((current) => (
        isEditingMeeting
          ? current.map((item) => (item.id === meeting.id ? meeting : item))
          : [meeting, ...current]
      ));
      setSelectedId(meeting.id);
      closeMeetingForm();
      addFlashRef.current(isEditingMeeting ? 'Reunião atualizada.' : 'Reunião criada.', 'success');
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMeeting(meeting) {
    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `A reunião "${meeting.title}" e suas gravações serão deletadas.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    try {
      await deleteMeeting(meeting.id);
      setMeetings((current) => {
        const nextMeetings = current.filter((item) => item.id !== meeting.id);
        setSelectedId((currentId) => (
          currentId === meeting.id ? nextMeetings[0]?.id || '' : currentId
        ));
        return nextMeetings;
      });
      if (editingMeetingId === meeting.id) {
        closeMeetingForm();
      }
      addFlashRef.current('Reunião deletada.', 'success');
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
    }
  }

  async function handleFinalizeMeeting() {
    if (!selectedMeeting) {
      return;
    }
    setIsFinalizing(true);
    try {
      const updated = await finalizeMeeting(selectedMeeting.id);
      setMeetings((current) => current.map((meeting) => (
        meeting.id === updated.id ? updated : meeting
      )));
      addFlashRef.current('Documento da reunião salvo no Drive.', 'success');
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
    } finally {
      setIsFinalizing(false);
    }
  }

  async function handleUpload(recording, { onProgress } = {}) {
    if (!selectedMeeting) {
      return false;
    }

    try {
      await uploadRecording(selectedMeeting.id, recording, { onProgress });
      // Repull the meeting so the running summary, transcript and segment
      // statuses reflect this upload (in inline mode they are ready at once).
      await refreshMeetingById(selectedMeeting.id);
      return true;
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
      return false;
    }
  }

  async function handleSaveTranscript(recordingId, transcript) {
    try {
      const updatedRecording = await updateRecording(recordingId, { transcript });
      setMeetings((current) => current.map((meeting) => ({
        ...meeting,
        recordings: meeting.recordings.map((recording) => (
          recording.id === updatedRecording.id ? updatedRecording : recording
        )),
      })));
      addFlashRef.current('Transcrição atualizada.', 'success');
      return updatedRecording;
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
      throw error;
    }
  }

  async function handleDeleteRecording(recording) {
    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `A gravação "${recording.filename}" será deletada.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    try {
      await deleteRecording(recording.id);
      setMeetings((current) => current.map((meeting) => ({
        ...meeting,
        recordings: meeting.recordings.filter((item) => item.id !== recording.id),
      })));
      addFlashRef.current('Gravação deletada.', 'success');
    } catch (error) {
      addFlashRef.current(errorText(error), 'error');
    }
  }

  const recordings = selectedMeeting?.recordings || [];
  // Uma gravação ainda em processamento (não concluída nem falha) dirige o
  // banner de status no topo do documento — "o que está sendo feito".
  const activeRecording = recordings.find(
    (recording) => recording.status !== 'concluida' && recording.status !== 'falhou',
  );

  return (
    <>
      <PageChrome label="Reuniões" />
      {confirmPopup}
      <div className="meetings-page">
        <div className="meetings-layout">
          <aside className="surface section-card meetings-sidebar">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-xl text-foreground">Reuniões</p>
                <p className="mt-1 text-sm text-muted-foreground">Gravação, transcrição e resumo por IA</p>
              </div>
              <Button size="sm" onClick={openCreateForm}>
                <Plus className="size-4" />
                Nova
              </Button>
            </div>

            {isLoading ? <p className="section-note">Carregando...</p> : null}
            {!isLoading && !meetings.length ? (
              <EmptyState
                title="Nenhuma reunião."
                copy="Crie a primeira para habilitar a gravação."
              />
            ) : (
              <div className="meeting-options">
                {meetings.map((meeting) => {
                  const done = meeting.recordings?.some((rec) => rec.status === 'concluida');
                  const processing = meeting.recordings?.some(
                    (rec) => rec.status !== 'concluida' && rec.status !== 'falhou',
                  );
                  return (
                    <button
                      className={`meeting-option-main meeting-option${meeting.id === selectedId ? ' active' : ''}`}
                      type="button"
                      key={meeting.id}
                      onClick={() => setSelectedId(meeting.id)}
                    >
                      <span className="meeting-option-title">
                        <strong>{meeting.title}</strong>
                        {processing ? (
                          <StatusBadge tone="gold">Processando</StatusBadge>
                        ) : done ? (
                          <StatusBadge tone="success">Pronta</StatusBadge>
                        ) : null}
                      </span>
                      <span>{formatDateTime(meeting.meetingAt)}</span>
                      <span>{meeting.clientName || 'Sem cliente vinculado'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="meetings-workspace">
            {isMeetingFormOpen ? (
              <Card>
                <CardContent className="py-5">
                <div className="mb-4">
                  <p className="font-serif text-xl text-foreground">
                    {isEditingMeeting ? 'Editar reunião' : 'Nova reunião'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Contexto antes da gravação</p>
                </div>

                <form className="meeting-form" onSubmit={handleMeetingSubmit}>
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
                    <Select
                      value={form.clientId}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        clientId: event.target.value,
                      }))}
                    >
                      <option value="">Sem vínculo</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </Select>
                  </label>
                  <div className="meeting-form-actions">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Salvando...' : isEditingMeeting ? 'Salvar edição' : 'Criar reunião'}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isSaving}
                      onClick={closeMeetingForm}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
                </CardContent>
              </Card>
            ) : null}

            {selectedMeeting ? (
              <section className="surface section-card meeting-doc-sheet">
                <header className="meeting-doc-head">
                  <div className="meeting-doc-head-text">
                    <p className="meeting-doc-eyebrow">Ata de reunião</p>
                    <h1 className="meeting-doc-title">{selectedMeeting.title}</h1>
                    <p className="meeting-doc-meta">
                      {selectedMeeting.clientName || 'Sem cliente vinculado'}
                      <span aria-hidden="true"> · </span>
                      {formatDateTime(selectedMeeting.meetingAt)}
                    </p>
                  </div>
                  <div className="meeting-doc-actions">
                    {selectedMeeting.documentLink ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={selectedMeeting.documentLink} target="_blank" rel="noreferrer">
                          Ver no Drive
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => openEditForm(selectedMeeting)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      type="button"
                      onClick={() => handleDeleteMeeting(selectedMeeting)}
                    >
                      Excluir
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      onClick={handleFinalizeMeeting}
                      disabled={isFinalizing}
                    >
                      {isFinalizing
                        ? 'Salvando...'
                        : selectedMeeting.documentLink
                          ? 'Atualizar documento'
                          : 'Finalizar reunião'}
                    </Button>
                  </div>
                </header>

                <AudioRecorder onUpload={handleUpload} />

                {activeRecording ? (
                  <div className="meeting-doc-processing">
                    <span className="capture-live-pulse" aria-hidden="true" />
                    <strong>Processando o áudio…</strong>
                    <span>Esta tela atualiza sozinha quando terminar.</span>
                    <RecordingPipeline status={activeRecording.status} />
                  </div>
                ) : null}

                {selectedMeeting.summary ? (
                  <MeetingSummary value={selectedMeeting.summary} />
                ) : !activeRecording ? (
                  <div className="meeting-doc-empty">
                    <strong>Ainda sem resumo.</strong>
                    <p>Grave a reunião ou envie um arquivo de áudio para gerar o documento.</p>
                  </div>
                ) : null}

                {selectedMeeting.transcript ? (
                  <details className="meeting-doc-fold">
                    <summary>Transcrição completa</summary>
                    <p className="meeting-transcript-text">{selectedMeeting.transcript}</p>
                  </details>
                ) : null}

                {recordings.length ? (
                  <details className="meeting-doc-fold">
                    <summary>Trechos gravados ({recordings.length})</summary>
                    <div className="recording-results">
                      {recordings.map((recording) => (
                        <RecordingResult
                          key={recording.id}
                          onDelete={handleDeleteRecording}
                          onSaveTranscript={handleSaveTranscript}
                          recording={recording}
                        />
                      ))}
                    </div>
                  </details>
                ) : null}
              </section>
            ) : !isMeetingFormOpen ? (
              <div className="meeting-doc-placeholder">
                <EmptyState
                  title="Selecione ou crie uma reunião."
                  copy="Use o botão Nova para iniciar um registro."
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
