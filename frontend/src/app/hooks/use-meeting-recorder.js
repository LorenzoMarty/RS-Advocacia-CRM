import { useEffect, useRef, useState } from 'react';

const AUDIO_FORMATS = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
];

// The meeting is recorded in 5-minute segments. Each segment is a self-contained
// file, uploaded and transcribed on its own, so the whole meeting never travels
// through a single request. Meeting length is effectively unlimited;
// SAFETY_MAX just stops a forgotten recording.
const SEGMENT_DURATION_MS = 5 * 60 * 1000;
const SAFETY_MAX_RECORDING_MS = 4 * 60 * 60 * 1000;
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;
const MEETING_AUDIO_BITS_PER_SECOND = 64000;

function pickSupportedFormat() {
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

export function formatElapsed(ms) {
  return formatRemaining(ms);
}

/**
 * Records a Google Meet (or any browser tab) mixed with the microphone, cutting
 * the audio into SEGMENT_DURATION_MS chunks.
 *
 * The capture streams (tab + mic) and the AudioContext stay alive for the whole
 * meeting; only the MediaRecorder is recreated per segment so each chunk is an
 * independently decodable file. Every finished segment is handed to
 * `onSegment({ blob, filename, ordem })` while recording continues, so the page
 * can upload + transcribe each chunk in parallel with the meeting.
 */
export function useMeetingRecorder({ onSegment }) {
  const recorderRef = useRef(null);
  const streamsRef = useRef([]);
  const audioContextRef = useRef(null);
  const destinationRef = useRef(null);
  const chunksRef = useRef([]);
  const formatRef = useRef(null);
  const segmentIndexRef = useRef(0);
  const stoppingRef = useRef(false);
  const segmentTimerRef = useRef(null);
  const elapsedTimerRef = useRef(null);
  const onSegmentRef = useRef(onSegment);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);

  useEffect(() => {
    onSegmentRef.current = onSegment;
  });

  function cleanup() {
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    streamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    streamsRef.current = [];
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    destinationRef.current = null;
    recorderRef.current = null;
  }

  useEffect(() => () => cleanup(), []);

  function emitSegment(blob) {
    if (!blob.size) {
      return;
    }
    const ordem = segmentIndexRef.current;
    segmentIndexRef.current += 1;
    setSegmentCount(segmentIndexRef.current);
    const { extension } = formatRef.current;
    onSegmentRef.current?.({
      blob,
      filename: `reuniao-meet-${Date.now()}-parte-${ordem + 1}.${extension}`,
      ordem,
    });
  }

  function startSegmentRecorder() {
    const destination = destinationRef.current;
    if (!destination) {
      return;
    }
    const recorder = new MediaRecorder(destination.stream, {
      mimeType: formatRef.current.mimeType,
      audioBitsPerSecond: MEETING_AUDIO_BITS_PER_SECOND,
    });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: formatRef.current.mimeType });
      emitSegment(blob);
      if (stoppingRef.current) {
        cleanup();
        setIsRecording(false);
        return;
      }
      // Timed rollover: keep recording the next segment seamlessly.
      startSegmentRecorder();
      segmentTimerRef.current = setTimeout(rolloverSegment, SEGMENT_DURATION_MS);
    };

    recorder.start();
  }

  function rolloverSegment() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }

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

    streamsRef.current = [displayStream, micStream];
    audioContextRef.current = audioContext;
    destinationRef.current = destination;
    formatRef.current = format;
    segmentIndexRef.current = 0;
    stoppingRef.current = false;
    setSegmentCount(0);
    setElapsedMs(0);

    // User clicked the browser's "stop sharing" → finish gracefully.
    displayStream.getAudioTracks()[0].onended = () => stopMeetingRecording();

    startSegmentRecorder();
    segmentTimerRef.current = setTimeout(rolloverSegment, SEGMENT_DURATION_MS);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs((current) => {
        const next = current + 1000;
        if (next >= SAFETY_MAX_RECORDING_MS) {
          stopMeetingRecording();
        }
        return next;
      });
    }, 1000);

    setIsRecording(true);
  }

  function stopMeetingRecording() {
    stoppingRef.current = true;
    if (segmentTimerRef.current) {
      clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
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
    elapsedMs,
    segmentCount,
    startMeetingRecording,
    stopMeetingRecording,
  };
}
