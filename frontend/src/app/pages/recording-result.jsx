import { useEffect, useState } from 'react';
import { FileAudio, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { StatusBadge } from '../layout';
import { MeetingSummary, RecordingPipeline } from './meeting-summary';
import { formatBytes, friendlyProcessingError, statusTone } from './meetings-utils';

export function RecordingResult({ onDelete, onSaveTranscript, recording }) {
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(recording.transcript || '');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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

  const isProcessing = recording.status !== 'concluida' && recording.status !== 'falhou';
  const meta = [formatBytes(recording.size), recording.transcriptionModel || 'Aguardando processamento']
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="grid gap-3 rounded-md bg-surface-2 p-3.5">
      <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3">
        <span className="grid size-10 place-items-center rounded-sm bg-surface text-ink-2">
          <FileAudio className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <strong className="truncate text-[1rem] font-bold" title={recording.filename}>{recording.filename}</strong>
          <span className="text-[.86rem] font-medium text-muted-foreground">{meta}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone={statusTone(recording.status)}>
            {recording.statusLabel || recording.status}
          </StatusBadge>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={`Excluir trecho ${recording.filename}`}
            className="size-9 text-muted-foreground hover:bg-[var(--danger-soft)] hover:text-[var(--danger-ink)]"
            onClick={() => onDelete(recording)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {isProcessing ? <RecordingPipeline status={recording.status} /> : null}

      {recording.processingError ? (
        <div className="grid gap-2 rounded-sm bg-surface p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <strong className="text-[.93rem] font-bold text-[var(--danger-ink)]">Não foi possível transcrever</strong>
              <span className="text-[.93rem] font-medium text-ink-2">{friendlyProcessingError(recording.processingError)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-expanded={showErrorDetails}
              onClick={() => setShowErrorDetails((current) => !current)}
            >
              {showErrorDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
            </Button>
          </div>
          {showErrorDetails ? (
            <code className="block break-all rounded-sm bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-normal text-muted-foreground">
              {recording.processingError}
            </code>
          ) : null}
        </div>
      ) : null}

      {recording.summary ? (
        <div className="grid gap-2">
          <h3 className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-subtle">Resumo</h3>
          <MeetingSummary value={recording.summary} />
        </div>
      ) : null}

      <div className="grid gap-2.5">
        <div className="flex items-center justify-between gap-2.5">
          <h3 className="m-0 text-[11px] font-bold uppercase tracking-[.08em] text-subtle">Transcrição</h3>
          {!isEditingTranscript ? (
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsEditingTranscript(true)}>
              {recording.transcript ? 'Editar transcrição' : 'Adicionar transcrição'}
            </Button>
          ) : null}
        </div>

        {isEditingTranscript ? (
          <form className="grid gap-2.5" onSubmit={handleTranscriptSubmit}>
            <Textarea
              rows={10}
              value={transcriptDraft}
              onChange={(event) => setTranscriptDraft(event.target.value)}
            />
            <div className="flex flex-wrap gap-2.5">
              <Button type="submit" disabled={isSavingTranscript}>
                {isSavingTranscript ? 'Salvando…' : 'Salvar transcrição'}
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={isSavingTranscript}
                onClick={() => {
                  setTranscriptDraft(recording.transcript || '');
                  setIsEditingTranscript(false);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <p className="m-0 whitespace-pre-wrap text-[.93rem] leading-relaxed text-ink-2">
            {recording.transcript || 'Transcrição ainda não disponível.'}
          </p>
        )}
      </div>
    </article>
  );
}
