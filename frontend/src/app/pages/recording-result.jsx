import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { StatusBadge } from '../layout';
import { MeetingSummary, RecordingPipeline } from './meeting-summary';
import { statusTone } from './meetings-utils';

export function RecordingResult({ onDelete, onSaveTranscript, recording }) {
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
    <article className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong>{recording.filename}</strong>
          <p className="m-0 mt-1 text-xs text-muted-foreground">
            {recording.transcriptionModel || 'Aguardando processamento'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusBadge tone={statusTone(recording.status)}>
            {recording.statusLabel || recording.status}
          </StatusBadge>
          <Button variant="destructive" size="sm" type="button" onClick={() => onDelete(recording)}>
            Excluir
          </Button>
        </div>
      </div>

      <RecordingPipeline status={recording.status} />

      {recording.processingError ? (
        <p className="m-0 text-sm text-destructive">{recording.processingError}</p>
      ) : null}

      {recording.summary ? (
        <div className="grid gap-2">
          <h3 className="m-0 text-sm uppercase tracking-wide text-primary">Resumo</h3>
          <MeetingSummary value={recording.summary} />
        </div>
      ) : null}

      <div className="grid gap-2.5 rounded-lg border border-border bg-white/[.028] p-3.5">
        <div className="flex items-center justify-between gap-2.5">
          <h3 className="m-0 text-xs font-bold uppercase tracking-wide text-primary">Transcrição</h3>
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
          <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {recording.transcript || 'Transcrição ainda não disponível.'}
          </p>
        )}
      </div>
    </article>
  );
}
