import { useEffect, useMemo, useState } from 'react';

import { api } from '../../api';
import { timeEntryFromApi } from '../../mappers';
import { useAppState } from '../../store';
import { computeDeliverables, periodBounds } from './productivity-data';

// Maps backend por_tipo item to UI shape.
function byTypeFromApi(pt) {
  return {
    taskType: pt.task_type || '',
    seconds: pt.segundos || 0,
    count: pt.entradas || 0,
  };
}

// Maps backend por_tarefa item to UI shape.
function byTaskFromApi(pt) {
  return {
    taskId: String(pt.task_id || ''),
    taskType: pt.task_type || '',
    key: `${pt.task_type}:${pt.task_id}`,
    label: pt.task_name || '',
    processId: String(pt.process_id || ''),
    processNumber: pt.process_number || '',
    seconds: pt.segundos || 0,
    count: pt.entradas || 0,
  };
}

const RESUMO_EMPTY = {
  tempo_total_segundos: 0,
  tempo_periodo_anterior_segundos: 0,
  variacao_percentual: null,
  por_tipo: [],
  por_tarefa: [],
  por_processo: [],
  por_dia: [],
  timers_ativos: [],
};

export function useProductivityData({ period, customStart, customEnd }) {
  const { deadlines, petitions, events, currentUser } = useAppState();
  const [now, setNow] = useState(() => Date.now());
  const [resumo, setResumo] = useState(null);

  // Build query params matching the backend _period_bounds signature.
  const params = useMemo(() => {
    const p = { periodo: period };
    if (period === 'custom' && customStart && customEnd) {
      p.inicio = customStart;
      p.fim = customEnd;
    }
    return p;
  }, [period, customStart, customEnd]);

  // Fetch server-side aggregation whenever the period changes.
  useEffect(() => {
    let active = true;
    api
      .getProductivityResumo(params)
      .then((response) => {
        if (active) setResumo(response.dados ?? response ?? RESUMO_EMPTY);
      })
      .catch(() => {
        // Non-fatal: UI shows empty state.
        if (active) setResumo(RESUMO_EMPTY);
      });
    return () => {
      active = false;
    };
  }, [params]);

  // Live tick for running entries (display only, not persisted).
  const timersAtivos = resumo?.timers_ativos ?? [];
  const hasRunning = timersAtivos.some((e) => e.status === 'running');
  useEffect(() => {
    if (!hasRunning) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  // Period bounds: prefer backend dates for consistency; fall back locally.
  const bounds = useMemo(() => {
    if (resumo?.inicio && resumo?.fim) {
      return { start: new Date(resumo.inicio), end: new Date(resumo.fim) };
    }
    return periodBounds(period, customStart, customEnd);
  }, [resumo, period, customStart, customEnd]);

  // Deliverables derived from store collections (backend resumo does not cover them).
  const deliverables = useMemo(
    () => computeDeliverables(bounds, { deadlines, petitions, events, user: currentUser, now }),
    [bounds, deadlines, petitions, events, currentUser, now],
  );

  return useMemo(() => {
    const data = resumo ?? RESUMO_EMPTY;
    const byType = (data.por_tipo || []).map(byTypeFromApi);
    const byTask = (data.por_tarefa || []).map(byTaskFromApi);
    const totalSeconds = data.tempo_total_segundos || 0;
    const taskCount = byTask.length;
    const averageTaskSeconds = taskCount ? Math.round(totalSeconds / taskCount) : 0;
    const processCount = (data.por_processo || []).filter((p) => p.process_id).length;
    const activeEntries = (data.timers_ativos || []).map(timeEntryFromApi).filter(Boolean);

    return {
      bounds,
      totalSeconds,
      previousTotalSeconds: data.tempo_periodo_anterior_segundos || 0,
      variation: data.variacao_percentual != null ? Number(data.variacao_percentual) : NaN,
      byType,
      byProcess: data.por_processo || [],
      byTask,
      activeEntries,
      stoppedEntries: [],
      averageTaskSeconds,
      deliverables,
      processCount,
      runningCount: activeEntries.filter((e) => e.status === 'running').length,
      now,
    };
  }, [resumo, bounds, deliverables, now]);
}
