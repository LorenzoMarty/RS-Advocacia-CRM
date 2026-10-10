import { Button } from '@/components/ui/button';
import { useShowMore } from '../hooks/use-show-more';

// Botão "Mostrar mais" das listas com renderização progressiva (ver hooks/use-show-more).
export function ShowMoreButton({ remaining, pageSize, onClick, className = '' }) {
  if (!remaining) return null;
  const next = Math.min(pageSize, remaining);
  return (
    <Button type="button" variant="secondary" size="sm" className={`w-full ${className}`} onClick={onClick}>
      Mostrar mais {next} <span className="font-medium opacity-70">({remaining} restantes)</span>
    </Button>
  );
}

// Lista com renderização progressiva para usar onde o componente pai tem retornos antecipados
// (hooks não podem ficar depois deles): o estado fica aqui dentro.
export function ProgressiveList({ items, pageSize = 8, resetKey = '', render }) {
  const { visible, remaining, showMore } = useShowMore(items, pageSize, { resetKey });
  return (
    <>
      {visible.map(render)}
      <ShowMoreButton remaining={remaining} pageSize={pageSize} onClick={showMore} />
    </>
  );
}
