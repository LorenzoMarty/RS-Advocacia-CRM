import { useCallback, useState } from 'react';

function storageKey(userId) {
  return `onboarding:${userId}`;
}

const EMPTY_STATE = { completed: false, dismissed: false, lastStep: 0 };

function readState(userId) {
  if (!userId) return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    const completed = Boolean(parsed.completed ?? parsed.tourSeen);
    return {
      completed,
      // Dado antigo (antes de `dismissed` existir) não guardava se o tour já
      // tinha sido fechado alguma vez — só dá pra inferir isso quando havia
      // progresso salvo ou quando já tinha concluído. Sem essa info o pior
      // caso é relançar 1x a mais pra quem abandonou exatamente no passo 0.
      dismissed: Boolean(parsed.dismissed ?? (completed || parsed.lastStep > 0)),
      lastStep: Number.isInteger(parsed.lastStep) ? parsed.lastStep : 0,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(userId, next) {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export function useOnboardingProgress(userId) {
  const [loadedUserId, setLoadedUserId] = useState(userId);
  const [state, setState] = useState(() => readState(userId));

  // Ajuste durante o render (não em useEffect): se fosse efeito, o
  // onboarding-launcher rodaria seu próprio effect no mesmo commit ainda com
  // o state antigo (tourSeen: false) e disparava o tour de novo para quem já
  // tinha concluído — a troca de userId (login/refresh) tem que refletir
  // antes de qualquer outro effect ler `tourSeen`.
  if (userId !== loadedUserId) {
    setLoadedUserId(userId);
    setState(readState(userId));
  }

  // Chamado quando o tour é fechado, de qualquer jeito — concluído
  // (driver.js "Concluir") ou abandonado no meio (X, clique fora, Escape).
  // `dismissed` vira true nos dois casos: uma vez que o usuário fechou o
  // tour, o auto-launch na página inicial não deve mais incomodar (isso
  // disparava toda vez que ele voltava pra '/' depois de fechar sem concluir).
  // "Rever tour" continua disponível manualmente e retoma do passo salvo.
  const saveProgress = useCallback(
    (lastIndex, completed) => {
      const next = { completed, dismissed: true, lastStep: completed ? 0 : lastIndex };
      setState(next);
      writeState(userId, next);
    },
    [userId],
  );

  const markTourSeen = useCallback(() => saveProgress(0, true), [saveProgress]);

  // Retoma de onde parou só se a tentativa anterior foi abandonada (não
  // concluída) e chegou a andar pelo menos um passo. Se já concluiu antes,
  // "Rever tour" é um reassistir deliberado — começa do zero.
  const resumeStep = !state.completed && state.lastStep > 0 ? state.lastStep : 0;

  return { tourSeen: state.dismissed, resumeStep, markTourSeen, saveProgress };
}
