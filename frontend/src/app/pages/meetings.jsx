import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

const NO_CLIENT_VALUE = '__none__';

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
      <div className="grid gap-4 pt-5">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(260px,.55fr)_minmax(0,1.6fr)]">
          <Card className="lg:sticky lg:top-[18px]">
            <CardContent className="grid gap-4 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-xl text-foreground">Reuniões</p>
                  <p className="mt-1 text-sm text-muted-foreground">Gravação, transcrição e resumo por IA</p>
                </div>
                <Button size="sm" onClick={openCreateForm}>
                  <Plus className="size-4" />
                  Nova
                </Button>
              </div>

              {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
              {!isLoading && !meetings.length ? (
                <EmptyState
                  title="Nenhuma reunião."
                  copy="Crie a primeira para habilitar a gravação."
                />
              ) : (
                <div className="grid gap-2.5">
                  {meetings.map((meeting) => {
                    const done = meeting.recordings?.some((rec) => rec.status === 'concluida');
                    const processing = meeting.recordings?.some(
                      (rec) => rec.status !== 'concluida' && rec.status !== 'falhou',
                    );
                    const isActive = meeting.id === selectedId;
                    return (
                      <button
                        className={`grid w-full min-w-0 gap-1.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                          isActive
                            ? 'border-primary/35 bg-primary/10'
                            : 'border-border bg-muted/40 hover:border-border/80 hover:bg-muted/60'
                        }`}
                        type="button"
                        key={meeting.id}
                        onClick={() => setSelectedId(meeting.id)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <strong className="truncate text-sm">{meeting.title}</strong>
                          {processing ? (
                            <StatusBadge tone="gold">Processando</StatusBadge>
                          ) : done ? (
                            <StatusBadge tone="success">Pronta</StatusBadge>
                          ) : null}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {formatDateTime(meeting.meetingAt)}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {meeting.clientName || 'Sem cliente vinculado'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <section className="grid min-w-0 gap-4">
            {isMeetingFormOpen ? (
              <Card>
                <CardContent className="py-5">
                <div className="mb-4">
                  <p className="font-serif text-xl text-foreground">
                    {isEditingMeeting ? 'Editar reunião' : 'Nova reunião'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Contexto antes da gravação</p>
                </div>

                <form className="grid gap-3" onSubmit={handleMeetingSubmit}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="meeting-title">Título</Label>
                    <Input
                      id="meeting-title"
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="meeting-at">Data e horário</Label>
                    <Input
                      id="meeting-at"
                      type="datetime-local"
                      value={form.meetingAt}
                      onChange={(event) => setForm((current) => ({ ...current, meetingAt: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="meeting-client">Cliente</Label>
                    <Select
                      value={form.clientId || NO_CLIENT_VALUE}
                      onValueChange={(value) => setForm((current) => ({
                        ...current,
                        clientId: value === NO_CLIENT_VALUE ? '' : value,
                      }))}
                    >
                      <SelectTrigger id="meeting-client">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CLIENT_VALUE}>Sem vínculo</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Salvando…' : isEditingMeeting ? 'Salvar edição' : 'Criar reunião'}
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
              <Card className="mx-auto w-full max-w-[860px]">
                <CardContent className="grid gap-4 py-5">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                  <div className="grid min-w-0 gap-1.5">
                    <p className="m-0 text-xs font-bold uppercase tracking-[.18em] text-primary">Ata de reunião</p>
                    <h1 className="m-0 font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-none tracking-tight text-foreground">
                      {selectedMeeting.title}
                    </h1>
                    <p className="m-0 text-sm text-muted-foreground">
                      {selectedMeeting.clientName || 'Sem cliente vinculado'}
                      <span aria-hidden="true"> · </span>
                      {formatDateTime(selectedMeeting.meetingAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                        ? 'Salvando…'
                        : selectedMeeting.documentLink
                          ? 'Atualizar documento'
                          : 'Finalizar reunião'}
                    </Button>
                  </div>
                </header>

                <AudioRecorder onUpload={handleUpload} />

                {activeRecording ? (
                  <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-primary/25 bg-primary/[.07] px-4 py-4">
                    <span className="h-3 w-3 flex-none animate-ping rounded-full bg-destructive" aria-hidden="true" />
                    <strong className="text-sm text-foreground">Processando o áudio…</strong>
                    <span className="text-sm text-muted-foreground">Esta tela atualiza sozinha quando terminar.</span>
                    <RecordingPipeline status={activeRecording.status} />
                  </div>
                ) : null}

                {selectedMeeting.summary ? (
                  <MeetingSummary value={selectedMeeting.summary} />
                ) : !activeRecording ? (
                  <div className="grid gap-1.5 rounded-2xl border border-dashed border-border p-6 text-center">
                    <strong className="text-foreground">Ainda sem resumo.</strong>
                    <p className="m-0 text-sm text-muted-foreground">
                      Grave a reunião ou envie um arquivo de áudio para gerar o documento.
                    </p>
                  </div>
                ) : null}

                {selectedMeeting.transcript || recordings.length ? (
                  <Accordion type="multiple" className="grid gap-1">
                    {selectedMeeting.transcript ? (
                      <AccordionItem value="transcript" className="rounded-lg border-b-0 bg-muted/30 px-3">
                        <AccordionTrigger className="py-2.5 text-xs font-bold uppercase tracking-wide text-primary hover:no-underline">
                          Transcrição completa
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="m-0 max-h-[360px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                            {selectedMeeting.transcript}
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}

                    {recordings.length ? (
                      <AccordionItem value="recordings" className="rounded-lg border-b-0 bg-muted/30 px-3">
                        <AccordionTrigger className="py-2.5 text-xs font-bold uppercase tracking-wide text-primary hover:no-underline">
                          Trechos gravados ({recordings.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid gap-2.5">
                            {recordings.map((recording) => (
                              <RecordingResult
                                key={recording.id}
                                onDelete={handleDeleteRecording}
                                onSaveTranscript={handleSaveTranscript}
                                recording={recording}
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}
                  </Accordion>
                ) : null}
                </CardContent>
              </Card>
            ) : !isMeetingFormOpen ? (
              <div className="grid place-items-center p-[clamp(30px,6vw,60px)]">
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
