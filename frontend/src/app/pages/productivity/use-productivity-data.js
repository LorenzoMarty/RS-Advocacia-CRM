import { useEffect, useMemo, useState } from 'react';

import { useAppState } from '../../store';
import {
  aggregateEntries,
  buildDaySeries,
  computeDeliverables,
  isEntryInRange,
  periodBounds,
  previousBounds,
  timeEntryElapsedSeconds,
  variationPercent,
} from './productivity-data';

// Deriva todos os agregados do dashboard a partir das coleções já carregadas
// no store (timeEntries, deadlines, petitions, events). Funciona igual em modo
// demo e com API, pois o store carrega as entradas no boot. O endpoint
// /api/produtividade/resumo/ existe para agregação server-side quando o volume
// justificar — aqui evitamos um round-trip redundante.
export function useProductivityData({ period, customStart, customEnd, selectedUserId, isAdmin }) {
  const { timeEntries, deadlines, petitions, events, users, currentUser } = useAppState();
  const [now, setNow] = useState(() => Date.now());

  const hasRunning = timeEntries.some((entry) => entry.status === 'running');
  useEffect(() => {
    if (!hasRunning) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  return useMemo(() => {
    // Escopo: admin vê tudo ou um usuário selecionado; demais veem o próprio.
    const scopedUser = isAdmin
      ? (selectedUserId ? users.find((u) => u.id === selectedUserId) || null : null)
      : currentUser;

    const scopedEntries = timeEntries.filter((entry) => {
      if (!isAdmin) return entry.userId === currentUser?.id;
      if (selectedUserId) return entry.userId === selectedUserId;
      return true;
    });

    const bounds = periodBounds(period, customStart, customEnd);
    const prev = previousBounds(bounds);

    const currentEntries = scopedEntries.filter((entry) => isEntryInRange(entry, bounds));
    const previousEntries = scopedEntries.filter((entry) => isEntryInRange(entry, prev));

    const agg = aggregateEntries(currentEntries, now);
    const previousTotal = previousEntries.reduce((sum, e) => sum + timeEntryElapsedSeconds(e, now), 0);

    const activeEntries = scopedEntries
      .filter((entry) => entry.status === 'running' || entry.status === 'paused')
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

    const stoppedEntries = scopedEntries
      .filter((entry) => entry.status === 'stopped' && isEntryInRange(entry, bounds))
      .sort((a, b) => new Date(b.endedAt || b.startedAt) - new Date(a.endedAt || a.startedAt));

    const deliverables = computeDeliverables(bounds, {
      deadlines, petitions, events, user: scopedUser, now,
    });

    const processIds = new Set([
      ...currentEntries.map((e) => e.processId),
      ...deliverables.doneDeadlines.map((d) => d.processId),
      ...deliverables.donePetitions.map((p) => p.processId),
      ...deliverables.attendedEvents.map((e) => e.processId),
    ].filter(Boolean));

    const taskCount = agg.byTask.length;
    const averageTaskSeconds = taskCount ? Math.round(agg.totalSeconds / taskCount) : 0;

    return {
      bounds,
      totalSeconds: agg.totalSeconds,
      previousTotalSeconds: previousTotal,
      variation: variationPercent(agg.totalSeconds, previousTotal),
      daySeries: buildDaySeries(bounds, agg.byDay),
      byUser: agg.byUser,
      byType: agg.byType,
      byProcess: agg.byProcess,
      byTask: agg.byTask,
      activeEntries,
      stoppedEntries,
      averageTaskSeconds,
      deliverables,
      processCount: processIds.size,
      runningCount: scopedEntries.filter((e) => e.status === 'running').length,
      now,
    };
  }, [
    timeEntries, deadlines, petitions, events, users, currentUser,
    period, customStart, customEnd, selectedUserId, isAdmin, now,
  ]);
}
