import { useCallback, useState } from 'react';

// Janela visível de `items`: os `limit` primeiros + `pinnedId` (se ficou de fora). Pura, para teste.
export function visibleWindow(items, limit, pinnedId = '') {
  if (items.length <= limit) return items;
  const visible = items.slice(0, limit);
  if (pinnedId && !visible.some((item) => item.id === pinnedId)) {
    const pinned = items.find((item) => item.id === pinnedId);
    if (pinned) visible.push(pinned);
  }
  return visible;
}

// Renderização progressiva: mostra `pageSize` itens e libera mais `pageSize` a cada `showMore()`.
// `resetKey` volta ao tamanho inicial quando muda (ex.: filtros). `pinnedId` mantém um item visível
// mesmo além da janela (ex.: o card que acabou de ser movido para outra coluna).
export function useShowMore(items, pageSize = 12, { resetKey = '', pinnedId = '' } = {}) {
  const [state, setState] = useState({ limit: pageSize, key: resetKey });
  const limit = state.key === resetKey ? state.limit : pageSize;

  const showMore = useCallback(
    () => setState({ key: resetKey, limit: limit + pageSize }),
    [limit, pageSize, resetKey],
  );

  const visible = visibleWindow(items, limit, pinnedId);

  return {
    visible,
    total: items.length,
    remaining: Math.max(0, items.length - visible.length),
    showMore,
  };
}
