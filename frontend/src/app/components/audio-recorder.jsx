import { useRef, useState } from 'react';

import { useAudioRecorder } from '../hooks/use-audio-recorder';
import {
  formatRemaining,
  isTabCaptureSupported,
  useMeetingRecorder,
} from '../hooks/use-meeting-recorder';

export function AudioRecorder({ onUpload }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const meetingRecorder = useMeetingRecorder({
    onRecording: ({ blob, filename }) => {
      selectFile(new File([blob], filename, { type: blob.type }));
    },
  });
  const tabCaptureSupported = isTabCaptureSupported();
  const isBusy = isRecording || meetingRecorder.isRecording;

  async function upload() {
    if (!recording) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const wasUploaded = await onUpload(recording, { onProgress: setUploadProgress });
    setIsUploading(false);
    setUploadProgress(0);
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
          <button className="btn" type="button" disabled={meetingRecorder.isRecording} onClick={startRecording}>
            Gravar microfone
          </button>
        )}
        {meetingRecorder.isRecording ? (
          <button className="btn btn-danger" type="button" onClick={meetingRecorder.stopMeetingRecording}>
            Encerrar reunião ({formatRemaining(meetingRecorder.remainingMs)})
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            disabled={isRecording || !tabCaptureSupported}
            title={tabCaptureSupported
              ? 'Compartilhe a aba do Meet com áudio para gravar todos os participantes.'
              : 'Disponível no Chrome ou Edge (captura de áudio da aba).'}
            onClick={meetingRecorder.startMeetingRecording}
          >
            Gravar reunião (Meet)
          </button>
        )}
        <label className="btn btn-secondary upload-label">
          Enviar arquivo
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
            disabled={isBusy}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {error ? <p className="recording-error">{error}</p> : null}
      {meetingRecorder.error ? <p className="recording-error">{meetingRecorder.error}</p> : null}
      {isRecording ? <p className="recording-live">Gravando. Fale normalmente e encerre ao finalizar.</p> : null}
      {meetingRecorder.isRecording ? (
        <p className="recording-live">
          Gravando a reunião (aba + microfone). Encerra sozinha em {formatRemaining(meetingRecorder.remainingMs)}.
        </p>
      ) : null}

      {recording ? (
        <div className="recording-preview">
          <audio controls src={previewUrl} />
          <div className="recording-ready">
            <span>{recording.filename}</span>
            <button className="btn" type="button" disabled={isUploading} onClick={upload}>
              {isUploading
                ? `Enviando...${uploadProgress ? ` ${uploadProgress}%` : ''}`
                : 'Transcrever e resumir'}
            </button>
            <button className="btn btn-secondary" type="button" disabled={isUploading} onClick={clearRecording}>
              Descartar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
