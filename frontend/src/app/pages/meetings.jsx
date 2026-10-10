import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { AudioRecorder } from '../components/audio-recorder';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { useRecordingPolling } from '../hooks/use-recording-polling';
import { PageChrome } from '../layout';
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
import { normalizeText } from '../utils';
import { EmptyState } from './common';
import { MeetingProgress, MeetingSummary } from './meeting-summary';
import { RecordingResult } from './recording-result';
import {
  EMPTY_FORM,
  errorText,
  formatDateTime,
  formatShortDate,
  meetingListStatus,
  meetingToForm,
} from './meetings-utils';

const NO_CLIENT_VALUE = '__none__';

// Ponto de status na lista (tokens, sem pílula).
const STATUS_DOT = {
  warn: 'bg-[var(--warn)]',
  danger: 'bg-[var(--danger)]',
  success: 'bg-[var(--success)]',
  neutral: 'bg-[var(--subtle)]',
};

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
  const [query, setQuery] = useState('');
  const [docTab, setDocTab] = useState('summary');

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
  // Uma gravação ainda em processamento (não concluída nem falha) dirige a linha
  // de status abaixo da régua — "o que está sendo feito".
  const activeRecording = recordings.find(
    (recording) => recording.status !== 'concluida' && recording.status !== 'falhou',
  );
  const hasFailedRecording = recordings.some((recording) => recording.status === 'falhou');

  const normalizedQuery = normalizeText(query.trim());
  const visibleMeetings = normalizedQuery
    ? meetings.filter((meeting) => normalizeText(`${meeting.title} ${meeting.clientName}`).includes(normalizedQuery))
    : meetings;

  return (
    <>
      <PageChrome
        label="Reuniões"
        primaryAction={{ label: 'Nova reunião', onClick: openCreateForm, tour: 'page-primary-action' }}
      />
      {confirmPopup}
      <div className="grid items-start gap-[var(--gap-grid)] min-[1201px]:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="min-[1201px]:sticky min-[1201px]:top-[var(--sticky-top)]">
          <CardContent className="grid gap-3.5 py-[var(--pad-card)]">
            <div>
              <h1 className="m-0 text-[1.71rem] font-bold leading-tight tracking-[-0.02em] text-ink">Reuniões</h1>
              <p className="m-0 mt-1 text-[.93rem] font-medium text-muted-foreground">Gravação, transcrição e ata por IA</p>
            </div>

            <label className="flex h-10 items-center gap-2 rounded-pill bg-surface-2 px-3.5 text-subtle focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
              <Search className="size-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar reunião ou cliente"
                aria-label="Buscar reunião ou cliente"
                className="min-w-0 flex-1 border-0 bg-transparent text-[.93rem] font-medium text-ink outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
              />
            </label>

            {isLoading ? <p className="m-0 text-[.93rem] text-muted-foreground">Carregando...</p> : null}
            {!isLoading && !meetings.length ? (
              <EmptyState
                title="Nenhuma reunião."
                copy="Crie a primeira para habilitar a gravação."
              />
            ) : null}
            {!isLoading && meetings.length && !visibleMeetings.length ? (
              <p className="m-0 py-3 text-center text-[.93rem] font-semibold text-muted-foreground">Nenhuma reunião encontrada.</p>
            ) : null}

            <div className="grid gap-1 max-[1200px]:flex max-[1200px]:gap-2 max-[1200px]:overflow-x-auto max-[1200px]:pb-1">
              {visibleMeetings.map((meeting) => {
                const status = meetingListStatus(meeting);
                const isActive = meeting.id === selectedId;
                return (
                  <button
                    className={`grid w-full min-w-0 gap-1.5 rounded-md border-0 px-3.5 py-3 text-left transition-colors max-[1200px]:w-[240px] max-[1200px]:flex-none ${
                      isActive
                        ? 'bg-surface-2 shadow-[inset_0_0_0_1.5px_var(--accent-soft-2)]'
                        : 'bg-transparent hover:bg-surface-2'
                    }`}
                    type="button"
                    key={meeting.id}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => setSelectedId(meeting.id)}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <strong className="truncate text-[1rem] font-bold text-ink">{meeting.title}</strong>
                      <span className="flex-none text-[.86rem] font-semibold tabular-nums text-subtle">
                        {formatShortDate(meeting.meetingAt)}
                      </span>
                    </span>
                    <span className="truncate text-[.86rem] font-medium text-muted-foreground">
                      {meeting.clientName || 'Sem cliente vinculado'}
                    </span>
                    <span className="flex items-center gap-1.5 text-[.86rem] font-semibold text-ink-2">
                      <span className={`size-[7px] flex-none rounded-full ${STATUS_DOT[status.tone]}`} aria-hidden="true" />
                      {status.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <section className="grid min-w-0 gap-[var(--gap-grid)]">
          {isMeetingFormOpen ? (
            <Card>
              <CardContent className="py-[var(--pad-card)]">
                <div className="mb-4">
                  <p className="m-0 text-card-title-sm text-ink">
                    {isEditingMeeting ? 'Editar reunião' : 'Nova reunião'}
                  </p>
                  <p className="m-0 mt-1 text-[.93rem] text-muted-foreground">Contexto antes da gravação</p>
                </div>

                <form className="grid gap-3.5" onSubmit={handleMeetingSubmit}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="meeting-title">Título</Label>
                    <Input
                      id="meeting-title"
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2">
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
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Salvando…' : isEditingMeeting ? 'Salvar edição' : 'Criar reunião'}
                    </Button>
                    <Button
                      variant="secondary"
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
            <>
              <Card>
                <CardContent className="grid gap-5 py-[var(--pad-card)]">
                  <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="grid min-w-0 flex-[1_1_320px] gap-2">
                      <p className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-subtle">Ata de reunião</p>
                      <h2 className="m-0 text-[2.14rem] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
                        {selectedMeeting.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-[.93rem] font-semibold text-ink-2">
                        <span className="flex min-w-0 max-w-full items-center gap-2 rounded-pill bg-surface-2 py-[5px] pl-[5px] pr-3">
                          <Avatar name={selectedMeeting.clientName || '?'} size={22} className="rounded-[7px]" />
                          <span className="truncate">{selectedMeeting.clientName || 'Sem cliente vinculado'}</span>
                        </span>
                        <span className="rounded-pill bg-surface-2 px-3 py-[5px] tabular-nums">
                          {formatDateTime(selectedMeeting.meetingAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label="Excluir reunião"
                        title="Excluir reunião"
                        className="text-muted-foreground hover:bg-[var(--danger-soft)] hover:text-[var(--danger-ink)]"
                        onClick={() => handleDeleteMeeting(selectedMeeting)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      {selectedMeeting.documentLink ? (
                        <Button asChild variant="secondary">
                          <a href={selectedMeeting.documentLink} target="_blank" rel="noreferrer">
                            Ver no Drive
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => openEditForm(selectedMeeting)}
                      >
                        Editar
                      </Button>
                      <Button
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

                  <MeetingProgress meeting={selectedMeeting} />

                  {activeRecording ? (
                    <p className="m-0 text-[.93rem] font-medium text-muted-foreground" role="status">
                      Processando o áudio… esta tela atualiza sozinha.
                    </p>
                  ) : null}

                  <AudioRecorder onUpload={handleUpload} />
                </CardContent>
              </Card>

              {recordings.length ? (
                <Card>
                  <CardContent className="grid gap-3.5 py-[var(--pad-card)]">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="m-0 text-[1.29rem] font-bold text-ink">Trechos gravados</h3>
                      <span className="text-[.93rem] font-semibold text-muted-foreground">
                        {recordings.length} {recordings.length === 1 ? 'trecho' : 'trechos'}
                      </span>
                    </div>
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
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="grid gap-4 py-[var(--pad-card)]">
                  <Segmented
                    label="Ata ou transcrição"
                    options={[
                      { value: 'summary', label: 'Resumo' },
                      { value: 'transcript', label: 'Transcrição' },
                    ]}
                    value={docTab}
                    onChange={setDocTab}
                    className="justify-self-start"
                  />

                  {docTab === 'summary' ? (
                    selectedMeeting.summary ? (
                      <MeetingSummary value={selectedMeeting.summary} />
                    ) : (
                      <div className="grid gap-1 rounded-md bg-surface-2 px-4 py-9 text-center">
                        <strong className="text-[1.07rem] font-bold text-ink">Ainda sem ata</strong>
                        <p className="m-0 text-[.93rem] font-medium text-muted-foreground">
                          {hasFailedRecording
                            ? 'Corrija a falha no trecho acima para gerar a ata.'
                            : 'A ata é gerada automaticamente depois que a transcrição terminar.'}
                        </p>
                      </div>
                    )
                  ) : selectedMeeting.transcript ? (
                    <p className="m-0 max-h-[420px] overflow-auto whitespace-pre-wrap text-[1rem] leading-[1.6] text-ink-2">
                      {selectedMeeting.transcript}
                    </p>
                  ) : (
                    <div className="grid gap-1 rounded-md bg-surface-2 px-4 py-9 text-center">
                      <strong className="text-[1.07rem] font-bold text-ink">Transcrição indisponível</strong>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : !isMeetingFormOpen ? (
            <div className="grid place-items-center p-[clamp(30px,6vw,60px)]">
              <EmptyState
                title="Selecione ou crie uma reunião."
                copy="Use o botão Nova reunião para iniciar um registro."
              />
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
