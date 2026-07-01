import { useCallback, useEffect, useState } from 'react';

function storageKey(userId) {
  return `onboarding:${userId}`;
}

function readTourSeen(userId) {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? Boolean(JSON.parse(raw).tourSeen) : false;
  } catch {
    return false;
  }
}

export function useOnboardingProgress(userId) {
  const [tourSeen, setTourSeen] = useState(() => readTourSeen(userId));

  useEffect(() => {
    setTourSeen(readTourSeen(userId));
  }, [userId]);

  const markTourSeen = useCallback(() => {
    setTourSeen(true);
    if (userId) localStorage.setItem(storageKey(userId), JSON.stringify({ tourSeen: true }));
  }, [userId]);

  return { tourSeen, markTourSeen };
}
