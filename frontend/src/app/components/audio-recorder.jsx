import { useRef, useState } from 'react';
import { Download, Radio } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  return (
    <Card className="border-dashed bg-muted/40" aria-label="Captura de áudio">
      <CardContent className="grid gap-3 py-4">
        <div className="flex flex-wrap gap-2.5">
          {isRecording ? (
            <Button variant="destructive" type="button" onClick={meetingRecorder.stopMeetingRecording}>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
              Encerrar gravação · {formatElapsed(meetingRecorder.elapsedMs)}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!tabCaptureSupported}
              title={tabCaptureSupported
                ? 'Compartilhe a aba da reunião com áudio para gravar todos os participantes.'
                : 'Disponível no Chrome ou Edge (captura de áudio da aba).'}
              onClick={meetingRecorder.startMeetingRecording}
            >
              <Radio className="size-4" />
              Gravar reunião
            </Button>
          )}

          <Button asChild variant="secondary" disabled={isRecording} className={isRecording ? 'pointer-events-none opacity-50' : ''}>
            <label className="cursor-pointer">
              <Download className="size-4" />
              Enviar arquivo
              <input
                ref={inputRef}
                type="file"
                className="absolute h-px w-px overflow-hidden opacity-0"
                accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,audio/*"
                disabled={isRecording}
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
            </label>
          </Button>
        </div>

        {!tabCaptureSupported && !isRecording ? (
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">
            Para gravar a reunião inteira (todos os participantes) use o Chrome ou Edge. Você ainda
            pode enviar um arquivo de áudio.
          </p>
        ) : null}

        {error ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
        {meetingRecorder.error ? <p className="m-0 text-sm text-destructive">{meetingRecorder.error}</p> : null}

        {isRecording ? (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3" role="status">
            <span className="h-3 w-3 flex-none animate-ping rounded-full bg-destructive" aria-hidden="true" />
            <div className="grid gap-0.5">
              <strong className="text-sm text-foreground">Gravando reunião · {formatElapsed(meetingRecorder.elapsedMs)}</strong>
              <span className="text-sm leading-snug text-muted-foreground">
                Aba + microfone. A cada 5 min vira um trecho transcrito automaticamente.
                {meetingRecorder.segmentCount > 0
                  ? ` Trechos capturados: ${meetingRecorder.segmentCount}.`
                  : ''}
              </span>
            </div>
          </div>
        ) : null}

        {!isRecording && segmentsSent > 0 ? (
          <p className="m-0 text-sm text-success">
            {segmentsSent} trecho(s) enviado(s) para transcrição.
          </p>
        ) : null}

        {recording ? (
          <div className="grid gap-2.5 rounded-xl border border-border bg-muted/60 p-3.5">
            <audio className="w-full" controls src={previewUrl} />
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="min-w-[140px] flex-1 truncate text-sm text-muted-foreground">{recording.filename}</span>
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
      </CardContent>
    </Card>
  );
}
