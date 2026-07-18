import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function ProcessStatusPanel({ processStatus = [], staleProcesses = { count: 0, itens: [] } }) {
  const maxCount = Math.max(...processStatus.map((s) => s.count), 1);

  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Processos</h2>
          <p className="section-note">Distribuição por status e parados</p>
        </div>
        <Link to="/processos" className="text-sm text-primary no-underline hover:underline whitespace-nowrap">Ver todos →</Link>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          {processStatus.length ? (
            <ul className="grid list-none gap-1.5 p-0">
              {processStatus.map(({ status, count }) => (
                <li key={status} className="grid grid-cols-[minmax(0,140px)_1fr_28px] items-center gap-2">
                  <span className="truncate text-sm text-muted-foreground">{status}</span>
                  <Progress value={Math.round((count / maxCount) * 100)} className="h-1.5" />
                  <span className="text-right text-sm tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum processo cadastrado.</p>
          )}
        </div>

        {staleProcesses.count > 0 && (
          <div className="min-w-[160px]">
            <header className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Badge variant="destructive">{staleProcesses.count}</Badge>
              <span>parados +30 dias</span>
            </header>
            <ul className="grid list-none gap-1 p-0">
              {staleProcesses.itens.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <Link to={`/processos/${p.id}`} className="grid min-w-0 gap-0 no-underline">
                    <strong className="truncate text-sm">{p.numero || 'Processo'}</strong>
                    <span className="truncate text-xs text-muted-foreground">{p.cliente_nome}</span>
                  </Link>
                  <span className="whitespace-nowrap text-xs tabular-nums text-destructive">{p.dias_parado}d</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardContent>
    </Card>
  );
}
