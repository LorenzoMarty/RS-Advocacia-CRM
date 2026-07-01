import { useCallback, useEffect, useState } from 'react';

function storageKey(userId) {
  return `onboarding:${userId}`;
}

function readState(userId) {
  if (!userId) return { completed: [], dismissed: false, tourSeen: false };
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { completed: [], dismissed: false, tourSeen: false };
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      dismissed: Boolean(parsed.dismissed),
      tourSeen: Boolean(parsed.tourSeen),
    };
  } catch {
    return { completed: [], dismissed: false, tourSeen: false };
  }
}

export function useOnboardingProgress(userId) {
  const [state, setState] = useState(() => readState(userId));

  useEffect(() => {
    setState(readState(userId));
  }, [userId]);

  const persist = useCallback(
    (next) => {
      setState(next);
      if (userId) localStorage.setItem(storageKey(userId), JSON.stringify(next));
    },
    [userId],
  );

  const toggle = useCallback(
    (itemId) => {
      const completed = state.completed.includes(itemId)
        ? state.completed.filter((id) => id !== itemId)
        : [...state.completed, itemId];
      persist({ ...state, completed });
    },
    [state, persist],
  );

  const dismiss = useCallback(() => persist({ ...state, dismissed: true }), [state, persist]);

  const markTourSeen = useCallback(() => persist({ ...state, tourSeen: true }), [state, persist]);

  return { ...state, toggle, dismiss, markTourSeen };
}
