import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { formatDateTime } from '../../utils';

const VISIBLE_LIMIT = 5;

function EventItem({ evento }) {
  return (
    <li className="grid gap-0.5 rounded-md bg-muted/40 p-2">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <strong className="min-w-0 truncate text-sm">{evento.titulo}</strong>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {evento.tipoEvento && <span>{evento.tipoEvento}</span>}
          {evento.responsavelNome && <span> · {evento.responsavelNome}</span>}
          {evento.processoNumero && <span> · {evento.processoNumero}</span>}
        </span>
        <span className="ml-auto flex-none whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(evento.dataInicio)}
        </span>
      </div>
    </li>
  );
}

export function EventsPanel({ eventos = {} }) {
  const { proximos = [], atrasados = [], totalPendentes = 0 } = eventos;

  if (!proximos.length && !atrasados.length) {
    return null;
  }

  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Compromissos</h2>
          <p className="section-note">
            {totalPendentes} pendente{totalPendentes !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/agenda" className="text-sm text-primary no-underline hover:underline whitespace-nowrap">Ver agenda →</Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {atrasados.length > 0 && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-destructive">
              Atrasados <Badge variant="destructive">{atrasados.length}</Badge>
            </h3>
            <ul className="grid list-none gap-1 p-0">
              {atrasados.slice(0, VISIBLE_LIMIT).map((e) => <EventItem key={e.id} evento={e} />)}
            </ul>
          </div>
        )}
        {proximos.length > 0 && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Próximos <Badge variant="secondary">{proximos.length}</Badge>
            </h3>
            <ul className="grid list-none gap-1 p-0">
              {proximos.slice(0, VISIBLE_LIMIT).map((e) => <EventItem key={e.id} evento={e} />)}
            </ul>
          </div>
        )}
      </div>
    </CardContent>
    </Card>
  );
}
