import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';

import { StatusBadge } from '../../layout';
import { formatDate } from '../../utils';
import { EmptyState } from '../../pages/common';

const TONE_RAIL = {
  danger: 'before:bg-destructive',
  warn: 'before:bg-warn',
  gold: 'before:bg-primary',
};

// Área B — "Precisa de atenção agora": top itens ordenados por severidade.
export function PriorityActions({ actions }) {
  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Precisa de atenção agora</h2>
          <p className="section-note">Itens mais urgentes, por severidade</p>
        </div>
      </div>
      {actions.length ? (
        <ol className="grid list-none gap-1.5 p-0">
          {actions.map((item) => (
            <li key={item.id}>
              <Link
                className={`relative flex items-center gap-2.5 overflow-hidden rounded-lg bg-muted/40 px-2.5 py-2 text-foreground no-underline transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] hover:bg-muted/70 ${TONE_RAIL[item.tone] || 'before:bg-primary'}`}
                to={item.to}
              >
                <div className="grid min-w-0 flex-1 gap-0.5 pl-2">
                  <strong className="truncate text-sm">{item.title}</strong>
                  <span className="text-xs text-muted-foreground">
                    {item.responsible}
                    {item.date ? ` • ${formatDate(item.date)}` : ''}
                  </span>
                </div>
                <StatusBadge tone={item.tone}>{item.action}</StatusBadge>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Nada urgente no momento."
          copy="Sem prazos críticos ou processos parados. Bom trabalho."
        />
      )}
    </CardContent>
    </Card>
  );
}
