import { useEffect } from 'react';

const PROCESSING_STATUSES = new Set(['enviada', 'transcribindo', 'resumindo']);

export function useRecordingPolling(recordings, refresh) {
  const pendingIds = recordings
    .filter((recording) => PROCESSING_STATUSES.has(recording.status))
    .map((recording) => recording.id)
    .join(',');

  useEffect(() => {
    if (!pendingIds) {
      return undefined;
    }

    const ids = pendingIds.split(',');
    const intervalId = window.setInterval(() => {
      Promise.all(ids.map((recordingId) => refresh(recordingId))).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [pendingIds, refresh]);
}
