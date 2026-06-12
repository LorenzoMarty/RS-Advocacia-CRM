import { useEffect, useRef, useState } from 'react';

const AUDIO_FORMATS = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
];

// 20 minutes: product cap agreed for meeting recordings; at 64 kbps opus the
// blob stays around 10 MB, well under the 25 MB transcription limit.
export const MAX_MEETING_RECORDING_MS = 20 * 60 * 1000;
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;
const MEETING_AUDIO_BITS_PER_SECOND = 64000;

export function pickSupportedFormat() {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }
  return AUDIO_FORMATS.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType)) || null;
}

export function isTabCaptureSupported() {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export function validateRecordingSize(blob, maxBytes = MAX_RECORDING_BYTES) {
  if (!blob || !blob.size) {
    return 'A gravação ficou vazia. Tente novamente.';
  }
  if (blob.size > maxBytes) {
    const maxMb = Math.floor(maxBytes / (1024 * 1024));
    return `A gravação passou de ${maxMb} MB. Grave um trecho mais curto.`;
  }
  return '';
}

export function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Records a Google Meet (or any browser tab) mixed with the microphone.
 *
 * Flow: getDisplayMedia (tab + "share tab audio") + getUserMedia (mic), both
 * piped through an AudioContext into a single stream for MediaRecorder.
 * Auto-stops at MAX_MEETING_RECORDING_MS or when the user ends the share.
 * The finished blob is handed to `onRecording({ blob, filename })`.
 */
export function useMeetingRecorder({ onRecording }) {
  const recorderRef = useRef(null);
  const streamsRef = useRef([]);
  const audioContextRef = useRef(null);
  const chunksRef = useRef([]);
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const onRecordingRef = useRef(onRecording);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [remainingMs, setRemainingMs] = useState(MAX_MEETING_RECORDING_MS);

  useEffect(() => {
    onRecordingRef.current = onRecording;
  });

  function cleanup() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    streamsRef.current = [];
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    recorderRef.current = null;
  }

  useEffect(() => () => cleanup(), []);

  async function startMeetingRecording() {
    const format = pickSupportedFormat();
    if (!format || !isTabCaptureSupported()) {
      setError('Este navegador não suporta capturar o áudio de uma aba. Use Chrome ou Edge.');
      return;
    }

    setError('');
    let displayStream = null;
    let micStream = null;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } catch {
      setError('Captura cancelada. Escolha a aba do Meet e marque "Compartilhar áudio da guia".');
      return;
    }

    if (!displayStream.getAudioTracks().length) {
      displayStream.getTracks().forEach((track) => track.stop());
      setError('A aba foi compartilhada sem áudio. Marque "Compartilhar áudio da guia" ao escolher a aba do Meet.');
      return;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      displayStream.getTracks().forEach((track) => track.stop());
      setError('Não foi possível acessar o microfone.');
      return;
    }

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(displayStream).connect(destination);
    audioContext.createMediaStreamSource(micStream).connect(destination);

    const recorder = new MediaRecorder(destination.stream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: MEETING_AUDIO_BITS_PER_SECOND,
    });

    streamsRef.current = [displayStream, micStream];
    audioContextRef.current = audioContext;
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: format.mimeType });
      cleanup();
      setIsRecording(false);

      const sizeError = validateRecordingSize(blob);
      if (sizeError) {
        setError(sizeError);
        return;
      }
      onRecordingRef.current?.({
        blob,
        filename: `reuniao-meet-${Date.now()}.${format.extension}`,
      });
    };

    // User clicked the browser's "stop sharing" → finish gracefully.
    displayStream.getAudioTracks()[0].onended = () => stopMeetingRecording();

    setRemainingMs(MAX_MEETING_RECORDING_MS);
    timeoutRef.current = setTimeout(() => stopMeetingRecording(), MAX_MEETING_RECORDING_MS);
    intervalRef.current = setInterval(() => {
      setRemainingMs((current) => Math.max(0, current - 1000));
    }, 1000);

    recorder.start();
    setIsRecording(true);
  }

  function stopMeetingRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    cleanup();
    setIsRecording(false);
  }

  return {
    error,
    isRecording,
    remainingMs,
    startMeetingRecording,
    stopMeetingRecording,
  };
}
