import { useEffect, useRef, useState } from 'react';

const AUDIO_FORMATS = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4', extension: 'mp4' },
];

function supportedFormat() {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }
  return AUDIO_FORMATS.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType)) || null;
}

export function useAudioRecorder() {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const previewUrlRef = useRef('');
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
  }, []);

  function storeRecording(nextRecording) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = URL.createObjectURL(nextRecording.blob);
    setPreviewUrl(previewUrlRef.current);
    setRecording(nextRecording);
  }

  async function startRecording() {
    const format = supportedFormat();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador não oferece gravação em webm ou mp4.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: format.mimeType });
        storeRecording({
          blob,
          filename: `reuniao-${Date.now()}.${format.extension}`,
        });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      clearRecording();
      setIsRecording(true);
    } catch {
      setError('Não foi possível acessar o microfone.');
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }

  function selectFile(file) {
    if (!file) {
      return;
    }
    setError('');
    storeRecording({ blob: file, filename: file.name });
  }

  function clearRecording() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setPreviewUrl('');
    setRecording(null);
    setError('');
  }

  return {
    clearRecording,
    error,
    isRecording,
    previewUrl,
    recording,
    selectFile,
    startRecording,
    stopRecording,
  };
}
