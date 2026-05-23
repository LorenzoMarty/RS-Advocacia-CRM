import { useRef, useState } from 'react';

import { useAudioRecorder } from '../hooks/use-audio-recorder';

export function AudioRecorder({ onUpload }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const {
    clearRecording,
    error,
    isRecording,
    previewUrl,
    recording,
    selectFile,
    startRecording,
    stopRecording,
  } = useAudioRecorder();

  async function upload() {
    if (!recording) {
      return;
    }

    setIsUploading(true);
    const wasUploaded = await onUpload(recording);
    setIsUploading(false);
    if (wasUploaded) {
      clearRecording();
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  return (
    <section className="audio-recorder" aria-label="Nova gravação">
      <div className="recording-actions">
        {isRecording ? (
          <button className="btn btn-danger" type="button" onClick={stopRecording}>
            Encerrar gravação
          </button>
        ) : (
          <button className="btn" type="button" onClick={startRecording}>
            Gravar áudio
          </button>
        )}
        <label className="btn btn-secondary upload-label">
          Enviar arquivo
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {error ? <p className="recording-error">{error}</p> : null}
      {isRecording ? <p className="recording-live">Gravando. Fale normalmente e encerre ao finalizar.</p> : null}

      {recording ? (
        <div className="recording-preview">
          <audio controls src={previewUrl} />
          <div className="recording-ready">
            <span>{recording.filename}</span>
            <button className="btn" type="button" disabled={isUploading} onClick={upload}>
              {isUploading ? 'Enviando...' : 'Transcrever e resumir'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={clearRecording}>
              Descartar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
