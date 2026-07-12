import { useCallback, useEffect, useState } from 'react';

function storageKey(userId) {
  return `onboarding:${userId}`;
}

function readState(userId) {
  if (!userId) return { tourSeen: false, lastStep: 0 };
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { tourSeen: false, lastStep: 0 };
    const parsed = JSON.parse(raw);
    return {
      tourSeen: Boolean(parsed.tourSeen),
      lastStep: Number.isInteger(parsed.lastStep) ? parsed.lastStep : 0,
    };
  } catch {
    return { tourSeen: false, lastStep: 0 };
  }
}

function writeState(userId, next) {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export function useOnboardingProgress(userId) {
  const [state, setState] = useState(() => readState(userId));

  useEffect(() => {
    setState(readState(userId));
  }, [userId]);

  // Chamado quando o tour é fechado/concluído. `completed` = chegou ao
  // último passo (driver.js "Concluir"); caso contrário foi abandonado no
  // meio (X, clique fora, Escape) — guarda o passo pra "Rever tour" retomar
  // dali em vez de reiniciar do zero.
  const saveProgress = useCallback(
    (lastIndex, completed) => {
      const next = completed
        ? { tourSeen: true, lastStep: 0 }
        : { tourSeen: false, lastStep: lastIndex };
      setState(next);
      writeState(userId, next);
    },
    [userId],
  );

  const markTourSeen = useCallback(() => saveProgress(0, true), [saveProgress]);

  // Retoma de onde parou só se a tentativa anterior foi abandonada (não
  // concluída) e chegou a andar pelo menos um passo. Se já concluiu antes,
  // "Rever tour" é um reassistir deliberado — começa do zero.
  const resumeStep = !state.tourSeen && state.lastStep > 0 ? state.lastStep : 0;

  return { tourSeen: state.tourSeen, resumeStep, markTourSeen, saveProgress };
}
