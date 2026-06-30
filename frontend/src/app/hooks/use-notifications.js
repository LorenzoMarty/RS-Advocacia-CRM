import { useCallback, useEffect, useRef, useState } from 'react';

import { api, isApiEnabled } from '../api';

const POLL_INTERVAL_MS = 30_000;
const NOTIFICATIONS_ENABLED = false;

export function useNotifications() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    async function poll() {
      if (!isApiEnabled || !NOTIFICATIONS_ENABLED) return;
      try {
        const data = await api.listNotificacoes();
        if (activeRef.current) {
          setNotificacoes(data.itens ?? []);
          setTotalNaoLidas(data.total_nao_lidas ?? 0);
        }
      } catch {
        // Non-fatal — polling retries automatically
      }
    }

    poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  const marcarLida = useCallback(async (id) => {
    try {
      await api.marcarNotificacaoLida(id);
      setNotificacoes((prev) => prev.filter((n) => n.id !== id));
      setTotalNaoLidas((prev) => Math.max(0, prev - 1));
    } catch {
      // Non-fatal
    }
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    try {
      await api.marcarTodasLidas();
      setNotificacoes([]);
      setTotalNaoLidas(0);
    } catch {
      // Non-fatal
    }
  }, []);

  return { notificacoes, totalNaoLidas, marcarLida, marcarTodasLidas };
}
