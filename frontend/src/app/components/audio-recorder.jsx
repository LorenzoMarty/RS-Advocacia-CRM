import { useRef, useState } from 'react';
import { Mic, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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

  function handleDrop(event) {
    event.preventDefault();
    if (isRecording) {
      return;
    }
    selectFile(event.dataTransfer.files?.[0]);
  }

  const blockClass = 'flex min-w-0 items-center gap-3.5 rounded-md p-4 text-left';

  return (
    <section className="grid gap-3" aria-label="Captura de áudio">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {isRecording ? (
          <button
            type="button"
            role="status"
            className={`${blockClass} cursor-pointer border-0 bg-[var(--danger-soft)] text-[var(--danger-ink)]`}
            onClick={meetingRecorder.stopMeetingRecording}
          >
            <span className="grid size-11 flex-none place-items-center rounded-full bg-[var(--danger)] text-white">
              <Mic className="size-5 motion-safe:animate-pulse" aria-hidden="true" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="text-[1.07rem] font-bold">Gravando… toque para encerrar</strong>
              <span className="text-[.86rem] font-medium tabular-nums">
                {formatElapsed(meetingRecorder.elapsedMs)}
                {meetingRecorder.segmentCount > 0 ? ` · ${meetingRecorder.segmentCount} trechos` : ''}
              </span>
            </span>
          </button>
        ) : tabCaptureSupported ? (
          <button
            type="button"
            className={`${blockClass} cursor-pointer border-0 bg-[var(--accent)] text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]`}
            title="Compartilhe a aba da reunião com áudio para gravar todos os participantes."
            onClick={meetingRecorder.startMeetingRecording}
          >
            <span className="grid size-11 flex-none place-items-center rounded-full bg-white/[.18]">
              <Mic className="size-5" aria-hidden="true" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="text-[1.07rem] font-bold">Gravar reunião</strong>
              <span className="text-[.86rem] font-medium opacity-80">Aba + microfone · um trecho a cada 5 min</span>
            </span>
          </button>
        ) : (
          <div className={`${blockClass} bg-surface-2 text-muted-foreground`} aria-disabled="true">
            <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-3">
              <Mic className="size-5" aria-hidden="true" />
            </span>
            <span className="grid min-w-0 gap-0.5">
              <strong className="text-[1.07rem] font-bold text-ink-2">Gravar reunião</strong>
              <span className="text-[.86rem] font-medium">Disponível no Chrome ou Edge</span>
            </span>
          </div>
        )}

        <label
          className={`relative ${blockClass} cursor-pointer border-[1.5px] border-dashed border-line-strong transition-colors hover:bg-surface-2 ${
            isRecording ? 'pointer-events-none opacity-50' : ''
          }`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <span className="grid size-11 flex-none place-items-center rounded-full bg-surface-2">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <span className="grid min-w-0 gap-0.5">
            <strong className="text-[1.07rem] font-bold text-ink">Enviar arquivo de áudio</strong>
            <span className="text-[.86rem] font-medium text-muted-foreground">Arraste aqui · MP3, WAV, M4A, WEBM</span>
          </span>
          <input
            ref={inputRef}
            type="file"
            className="absolute h-px w-px overflow-hidden opacity-0"
            accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
            disabled={isRecording}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {error ? <p className="m-0 text-[.93rem] font-medium text-[var(--danger-ink)]">{error}</p> : null}
      {meetingRecorder.error ? (
        <p className="m-0 text-[.93rem] font-medium text-[var(--danger-ink)]">{meetingRecorder.error}</p>
      ) : null}

      {!isRecording && segmentsSent > 0 ? (
        <p className="m-0 text-[.93rem] font-medium text-[var(--success-ink)]">
          {segmentsSent} trecho(s) enviado(s) para transcrição.
        </p>
      ) : null}

      {recording ? (
        <div className="grid gap-2.5 rounded-md bg-surface-2 p-3.5">
          <audio className="w-full" controls src={previewUrl} />
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="min-w-[140px] flex-1 truncate text-[.93rem] text-muted-foreground">{recording.filename}</span>
            <Button type="button" disabled={isUploading} onClick={upload}>
              {isUploading
                ? `Enviando...${uploadProgress ? ` ${uploadProgress}%` : ''}`
                : 'Transcrever e resumir'}
            </Button>
            <Button variant="secondary" type="button" disabled={isUploading} onClick={clearRecording}>
              Descartar
            </Button>
          </div>
          {isUploading && uploadProgress ? (
            <Progress value={uploadProgress} className="h-1.5" aria-hidden="true" />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
