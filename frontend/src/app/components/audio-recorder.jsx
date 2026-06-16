import { useRef, useState } from 'react';

import { useAudioRecorder } from '../hooks/use-audio-recorder';
import {
  formatElapsed,
  isTabCaptureSupported,
  useMeetingRecorder,
} from '../hooks/use-meeting-recorder';

export function AudioRecorder({ onUpload }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [segmentsSent, setSegmentsSent] = useState(0);
  const segmentQueueRef = useRef([]);
  const drainingRef = useRef(false);
  const {
    clearRecording,
    error,
    previewUrl,
    recording,
    selectFile,
  } = useAudioRecorder();

  // Meeting segments upload one at a time: keeps Drive uploads ordered and the
  // server's incremental summary free of concurrent updates.
  async function drainSegmentQueue() {
    if (drainingRef.current) {
      return;
    }
    drainingRef.current = true;
    while (segmentQueueRef.current.length) {
      const segment = segmentQueueRef.current.shift();
      const ok = await onUpload(segment);
      if (ok) {
        setSegmentsSent((current) => current + 1);
      }
    }
    drainingRef.current = false;
  }

  const meetingRecorder = useMeetingRecorder({
    onSegment: (segment) => {
      if (segmentQueueRef.current.length === 0 && !drainingRef.current) {
        setSegmentsSent(0);
      }
      segmentQueueRef.current.push(segment);
      drainSegmentQueue();
    },
  });
  const tabCaptureSupported = isTabCaptureSupported();
  const isRecording = meetingRecorder.isRecording;

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
    <section className="capture-bar" aria-label="Captura de áudio">
      <div className="capture-actions">
        {isRecording ? (
          <button
            className="btn btn-danger capture-btn"
            type="button"
            onClick={meetingRecorder.stopMeetingRecording}
          >
            <span className="capture-rec-dot" aria-hidden="true" />
            Encerrar gravação · {formatElapsed(meetingRecorder.elapsedMs)}
          </button>
        ) : (
          <button
            className="btn capture-btn"
            type="button"
            disabled={!tabCaptureSupported}
            title={tabCaptureSupported
              ? 'Compartilhe a aba da reunião com áudio para gravar todos os participantes.'
              : 'Disponível no Chrome ou Edge (captura de áudio da aba).'}
            onClick={meetingRecorder.startMeetingRecording}
          >
            <span className="capture-ico" aria-hidden="true">●</span>
            Gravar reunião
          </button>
        )}

        <label className={`btn btn-secondary capture-btn upload-label${isRecording ? ' is-disabled' : ''}`}>
          <span className="capture-ico" aria-hidden="true">⤓</span>
          Enviar arquivo
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
            disabled={isRecording}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {!tabCaptureSupported && !isRecording ? (
        <p className="capture-hint">
          Para gravar a reunião inteira (todos os participantes) use o Chrome ou Edge. Você ainda
          pode enviar um arquivo de áudio.
        </p>
      ) : null}

      {error ? <p className="recording-error">{error}</p> : null}
      {meetingRecorder.error ? <p className="recording-error">{meetingRecorder.error}</p> : null}

      {isRecording ? (
        <div className="capture-live" role="status">
          <span className="capture-live-pulse" aria-hidden="true" />
          <div className="capture-live-text">
            <strong>Gravando reunião · {formatElapsed(meetingRecorder.elapsedMs)}</strong>
            <span>
              Aba + microfone. A cada 5 min vira um trecho transcrito automaticamente.
              {meetingRecorder.segmentCount > 0
                ? ` Trechos capturados: ${meetingRecorder.segmentCount}.`
                : ''}
            </span>
          </div>
        </div>
      ) : null}

      {!isRecording && segmentsSent > 0 ? (
        <p className="capture-hint capture-hint-ok">
          {segmentsSent} trecho(s) enviado(s) para transcrição.
        </p>
      ) : null}

      {recording ? (
        <div className="capture-preview">
          <audio controls src={previewUrl} />
          <div className="capture-preview-row">
            <span className="capture-preview-name">{recording.filename}</span>
            <button className="btn" type="button" disabled={isUploading} onClick={upload}>
              {isUploading
                ? `Enviando...${uploadProgress ? ` ${uploadProgress}%` : ''}`
                : 'Transcrever e resumir'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={isUploading}
              onClick={clearRecording}
            >
              Descartar
            </button>
          </div>
          {isUploading && uploadProgress ? (
            <div className="capture-progress" aria-hidden="true">
              <span style={{ width: `${uploadProgress}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
