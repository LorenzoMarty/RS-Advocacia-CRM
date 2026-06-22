import { useCallback, useEffect, useRef, useState } from 'react';

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

const EMPTY_FORM = {
  title: '',
  meetingAt: '',
  clientId: '',
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

// Etapas do processamento de uma gravação, na ordem do backend
// (meetings.models.Gravacao.Status). "falhou" é tratado à parte.
const PROCESSING_STEPS = [
  { key: 'enviada', label: 'Enviada' },
  { key: 'transcribindo', label: 'Transcrevendo' },
  { key: 'resumindo', label: 'Resumindo' },
  { key: 'concluida', label: 'Concluída' },
];

function RecordingPipeline({ status }) {
  if (status === 'falhou') {
    return null;
  }

  const currentIndex = PROCESSING_STEPS.findIndex((step) => step.key === status);
  const activeIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <ol className="recording-pipeline" aria-label="Progresso do processamento">
      {PROCESSING_STEPS.map((step, index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
        return (
          <li key={step.key} className={`recording-step recording-step-${state}`}>
            <span className="recording-step-dot" aria-hidden="true" />
            <span className="recording-step-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
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

function formatDateTimeInput(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function errorText(error) {
  return error instanceof Error ? error.message : 'Falha ao comunicar com a API.';
}

function meetingToForm(meeting) {
  if (!meeting) {
    return EMPTY_FORM;
  }

  return {
    title: meeting.title || '',
    meetingAt: formatDateTimeInput(meeting.meetingAt),
    clientId: meeting.clientId || '',
  };
}

const SUMMARY_SECTION_LABELS = {
  resumo_executivo: 'Resumo executivo',
  tipo_reuniao: 'Tipo de reunião',
  participantes: 'Participantes',
  pontos_discutidos: 'Pontos discutidos',
  analise_juridica: 'Análise jurídica',
  estrategias_decisoes: 'Estratégias e decisões',
  proximas_acoes: 'Próximas ações',
  responsabilidades_escritorio: 'Responsabilidades do escritório',
  responsabilidades_parceiros: 'Responsabilidades dos parceiros',
  responsabilidades_cliente: 'Responsabilidades do cliente',
  pendencias_operacionais: 'Pendências operacionais',
  prazos: 'Prazos',
  compromissos: 'Compromissos',
  provas_documentos: 'Provas e documentos',
  materiais_existentes: 'Materiais existentes',
  materiais_pendentes: 'Materiais pendentes',
  pendencias_riscos: 'Pendências e riscos',
  checklist_final: 'Checklist final',
};

function humanizeSummaryTag(tag) {
  return SUMMARY_SECTION_LABELS[tag] || tag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appendTextNode(node, value) {
  if (value.trim()) {
    node.children.push({ type: 'text', value });
  }
}

function parseTaggedSummary(value) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const tagPattern = /<\/?([a-zA-Z][\w-]*)>/g;
  let lastIndex = 0;
  let match = tagPattern.exec(value);

  while (match) {
    appendTextNode(stack[stack.length - 1], value.slice(lastIndex, match.index));

    const [, tagName] = match;
    const isClosingTag = match[0].startsWith('</');

    if (isClosingTag) {
      let openIndex = -1;
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tagName) {
          openIndex = index;
          break;
        }
      }

      if (openIndex > 0) {
        stack.length = openIndex;
      }
    } else {
      const nextNode = { type: 'section', tag: tagName, title: humanizeSummaryTag(tagName), children: [] };
      stack[stack.length - 1].children.push(nextNode);
      stack.push(nextNode);
    }

    lastIndex = tagPattern.lastIndex;
    match = tagPattern.exec(value);
  }

  appendTextNode(stack[stack.length - 1], value.slice(lastIndex));
  return root.children;
}

function parseMarkdownSummary(value) {
  const root = { type: 'root', level: 0, children: [] };
  const stack = [root];
  const lines = value.split(/\r?\n/);

  lines.forEach((line) => {
    const heading = /^(#{2,4})\s+(.+)$/.exec(line.trim());

    if (!heading) {
      appendTextNode(stack[stack.length - 1], `${line}\n`);
      return;
    }

    const level = heading[1].length - 1;
    const nextNode = {
      type: 'section',
      level,
      title: heading[2].trim(),
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(nextNode);
    stack.push(nextNode);
  });

  return root.children;
}

function cleanSummaryLine(line) {
  return line
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^\[\s?[xX]?\s?\]\s*/, '')
    .trim();
}

function renderTextBlock(value, keyPrefix) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks = [];
  let listItems = [];
  let checklistItems = [];

  function flushLists() {
    if (checklistItems.length) {
      blocks.push(
        <ul className="summary-checklist" key={`${keyPrefix}-check-${blocks.length}`}>
          {checklistItems.map((item, index) => (
            <li className="summary-checkitem" key={`${keyPrefix}-check-item-${index}`}>
              <span aria-hidden="true" />
              <p>{cleanSummaryLine(item)}</p>
            </li>
          ))}
        </ul>,
      );
      checklistItems = [];
    }

    if (listItems.length) {
      blocks.push(
        <ul className="summary-list" key={`${keyPrefix}-list-${blocks.length}`}>
          {listItems.map((item, index) => (
            <li key={`${keyPrefix}-list-item-${index}`}>{cleanSummaryLine(item)}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  }

  lines.forEach((line) => {
    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      if (listItems.length) {
        flushLists();
      }
      checklistItems.push(line);
      return;
    }

    if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
      if (checklistItems.length) {
        flushLists();
      }
      listItems.push(line);
      return;
    }

    flushLists();
    blocks.push(<p key={`${keyPrefix}-p-${blocks.length}`}>{line}</p>);
  });

  flushLists();
  return blocks;
}

function renderSummaryNodes(nodes, level = 0, keyPrefix = 'summary') {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === 'text') {
      return renderTextBlock(node.value, key);
    }

    const textChildren = node.children.filter((child) => child.type === 'text');
    const sectionChildren = node.children.filter((child) => child.type === 'section');

    return (
      <section
        className={`summary-section${level > 0 ? ' summary-section-nested' : ''}`}
        key={key}
      >
        <header className="summary-section-header">
          <h4>{node.title}</h4>
        </header>
        <div className="summary-section-body">
          {textChildren.flatMap((child, childIndex) => renderTextBlock(child.value, `${key}-text-${childIndex}`))}
          {sectionChildren.length ? (
            <div className="summary-subsections">
              {renderSummaryNodes(sectionChildren, level + 1, key)}
            </div>
          ) : null}
        </div>
      </section>
    );
  });
}

function MeetingSummary({ value }) {
  const normalizedValue = value.trim();
  const hasXmlLikeSections = /<([a-zA-Z][\w-]*)>/.test(normalizedValue);
  const nodes = hasXmlLikeSections
    ? parseTaggedSummary(normalizedValue)
    : parseMarkdownSummary(normalizedValue);

  return (
    <div className="summary-report">
      {nodes.length ? renderSummaryNodes(nodes) : renderTextBlock(normalizedValue, 'summary-plain')}
    </div>
  );
}

function RecordingResult({ onDelete, onSaveTranscript, recording }) {
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(recording.transcript || '');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

  useEffect(() => {
    if (!isEditingTranscript) {
      setTranscriptDraft(recording.transcript || '');
    }
  }, [isEditingTranscript, recording.transcript]);

  async function handleTranscriptSubmit(event) {
    event.preventDefault();
    setIsSavingTranscript(true);
    try {
      await onSaveTranscript(recording.id, transcriptDraft);
      setIsEditingTranscript(false);
    } finally {
      setIsSavingTranscript(false);
    }
  }

  return (
    <article className="recording-result">
      <div className="recording-result-head">
        <div>
          <strong>{recording.filename}</strong>
          <p>{recording.transcriptionModel || 'Aguardando processamento'}</p>
        </div>
        <div className="recording-result-actions">
          <StatusBadge tone={statusTone(recording.status)}>
            {recording.statusLabel || recording.status}
          </StatusBadge>
          <button
            className="btn btn-danger btn-compact"
            type="button"
            onClick={() => onDelete(recording)}
          >
            Excluir
          </button>
        </div>
      </div>

      <RecordingPipeline status={recording.status} />

      {recording.processingError ? (
        <p className="recording-failure">{recording.processingError}</p>
      ) : null}

      {recording.summary ? (
        <div className="ai-output">
          <h3>Resumo</h3>
          <MeetingSummary value={recording.summary} />
        </div>
      ) : null}

      <div className="transcript-panel">
        <div className="transcript-head">
          <h3>Transcrição</h3>
          {!isEditingTranscript ? (
            <button
              className="btn btn-secondary btn-compact"
              type="button"
              onClick={() => setIsEditingTranscript(true)}
            >
              {recording.transcript ? 'Editar transcrição' : 'Adicionar transcrição'}
            </button>
          ) : null}
        </div>

        {isEditingTranscript ? (
          <form className="transcript-editor" onSubmit={handleTranscriptSubmit}>
            <textarea
              rows="10"
              value={transcriptDraft}
              onChange={(event) => setTranscriptDraft(event.target.value)}
            />
            <div className="transcript-actions">
              <button className="btn" type="submit" disabled={isSavingTranscript}>
                {isSavingTranscript ? 'Salvando...' : 'Salvar transcrição'}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={isSavingTranscript}
                onClick={() => {
                  setTranscriptDraft(recording.transcript || '');
                  setIsEditingTranscript(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <p>{recording.transcript || 'Transcrição ainda não disponível.'}</p>
        )}
      </div>
    </article>
  );
}

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
            <div className="section-head">
              <div>
                <h2 className="section-title">Reuniões</h2>
                <p className="section-note">Gravação, transcrição e resumo por IA</p>
              </div>
              <button className="btn btn-compact" type="button" onClick={openCreateForm}>
                + Nova
              </button>
            </div>

            {isLoading ? <p className="section-note">Carregando...</p> : null}
            {!isLoading && !meetings.length ? (
              <div className="empty">
                <strong>Nenhuma reunião.</strong>
                <p>Crie a primeira para habilitar a gravação.</p>
              </div>
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
              <div className="surface section-card meeting-editor">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">
                      {isEditingMeeting ? 'Editar reunião' : 'Nova reunião'}
                    </h2>
                    <p className="section-note">Contexto antes da gravação</p>
                  </div>
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
                    <button className="btn" type="submit" disabled={isSaving}>
                      {isSaving ? 'Salvando...' : isEditingMeeting ? 'Salvar edição' : 'Criar reunião'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      disabled={isSaving}
                      onClick={closeMeetingForm}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
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
                      <a
                        className="btn btn-secondary btn-compact"
                        href={selectedMeeting.documentLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver no Drive
                      </a>
                    ) : null}
                    <button
                      className="btn btn-secondary btn-compact"
                      type="button"
                      onClick={() => openEditForm(selectedMeeting)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger btn-compact"
                      type="button"
                      onClick={() => handleDeleteMeeting(selectedMeeting)}
                    >
                      Excluir
                    </button>
                    <button
                      className="btn btn-compact"
                      type="button"
                      onClick={handleFinalizeMeeting}
                      disabled={isFinalizing}
                    >
                      {isFinalizing
                        ? 'Salvando...'
                        : selectedMeeting.documentLink
                          ? 'Atualizar documento'
                          : 'Finalizar reunião'}
                    </button>
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
              <div className="surface meeting-doc-placeholder">
                <div className="empty">
                  <strong>Selecione ou crie uma reunião.</strong>
                  <p>Use o botão Nova para iniciar um registro.</p>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
