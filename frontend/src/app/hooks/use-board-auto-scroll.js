import { useEffect } from 'react';

// -1 / 1 quando o ponteiro está a menos de `edge` px da borda esquerda / direita; 0 no meio. Pura.
export function edgeDirection(clientX, rect, edge) {
  if (clientX < rect.left + edge) return -1;
  if (clientX > rect.right - edge) return 1;
  return 0;
}

// Autoscroll horizontal de um board kanban enquanto um card é arrastado com o mouse: o drag HTML5 não
// rola o contêiner sozinho, então colunas fora da tela (carrossel < 860px) ficavam inalcançáveis.
// Liga só enquanto `active` (há um arraste em curso); o CSS desliga o snap nesse período.
export function useBoardAutoScroll(boardRef, active, { edge = 72, speed = 16 } = {}) {
  useEffect(() => {
    const board = boardRef.current;
    if (!active || !board) return undefined;

    let direction = 0;
    let frame = 0;

    function tick() {
      if (!direction) {
        frame = 0;
        return;
      }
      board.scrollLeft += direction * speed;
      frame = window.requestAnimationFrame(tick);
    }

    function onDragOver(event) {
      if (board.scrollWidth <= board.clientWidth) {
        direction = 0;
        return;
      }
      direction = edgeDirection(event.clientX, board.getBoundingClientRect(), edge);
      if (direction && !frame) frame = window.requestAnimationFrame(tick);
    }

    function onDragLeave(event) {
      if (!board.contains(event.relatedTarget)) direction = 0;
    }

    board.addEventListener('dragover', onDragOver);
    board.addEventListener('dragleave', onDragLeave);
    return () => {
      board.removeEventListener('dragover', onDragOver);
      board.removeEventListener('dragleave', onDragLeave);
      direction = 0;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [boardRef, active, edge, speed]);
}
