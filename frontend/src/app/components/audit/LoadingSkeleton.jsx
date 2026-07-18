import { Skeleton } from '@/components/ui/skeleton';

// Skeleton exibido enquanto o store carrega as coleções.
export function LoadingSkeleton() {
  return (
    <div className="grid gap-4 pt-5" aria-busy="true" aria-label="Carregando auditoria">
      <Skeleton className="h-[190px] rounded-xl" />
      <Skeleton className="h-[220px] rounded-xl" />
      <Skeleton className="h-[220px] rounded-xl" />
    </div>
  );
}
