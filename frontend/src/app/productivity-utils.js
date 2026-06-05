export function formatTimerSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function petitionTaskType(petition) {
  return String(petition?.type || '').toLowerCase().includes('contest') ? 'contestacao' : 'peticao';
}

const DONE_STATUSES = ['protocolar', 'protocolado'];

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

export function belongsToUser(responsibleName, user) {
  const name = normalizeName(user?.name);
  return Boolean(name) && normalizeName(responsibleName) === name;
}

export function isDeadlineDone(deadline) {
  return Boolean(deadline?.completed) || DONE_STATUSES.includes(normalizeName(deadline?.status));
}

export function isPetitionDone(petition) {
  return DONE_STATUSES.includes(normalizeName(petition?.status));
}

export function isEventAttended(event, now = Date.now()) {
  if (event?.completed) {
    return true;
  }

  const start = new Date(event?.start).getTime();
  return !Number.isNaN(start) && start < now;
}
