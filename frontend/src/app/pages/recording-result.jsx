import { useEffect, useState } from 'react';

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
                {isSavingTranscript ? 'Salvando…' : 'Salvar transcrição'}
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
