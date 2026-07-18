import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const TONE_BAR = {
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-destructive',
};
const TONE_TEXT = {
  success: 'text-success',
  warn: 'text-warn',
  danger: 'text-destructive',
};

function horasFmt(horas) {
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function ProductivityPanel({ productivity = {} }) {
  const { semanaInicio, porUsuario = [], timersAtivos = 0 } = productivity;

  if (!porUsuario.length && !timersAtivos) {
    return null;
  }

  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Produtividade</h2>
          <p className="section-note">
            Semana atual{semanaInicio ? ` — a partir de ${semanaInicio}` : ''}
            {timersAtivos > 0 && (
              <span className="text-success"> · {timersAtivos} timer{timersAtivos !== 1 ? 's' : ''} ativos</span>
            )}
          </p>
        </div>
        <Link to="/produtividade" className="text-sm text-primary no-underline hover:underline whitespace-nowrap">Ver detalhe →</Link>
      </div>
      <ul className="grid list-none gap-2 p-0">
        {porUsuario.map((u) => {
          const tone = u.pct >= 100 ? 'success' : u.pct >= 60 ? 'warn' : 'danger';
          return (
            <li
              key={u.userId}
              className="grid grid-cols-2 grid-rows-2 items-center gap-x-2 gap-y-1 text-sm sm:grid-cols-[120px_1fr_70px_38px] sm:grid-rows-1"
            >
              <span className="col-start-1 row-start-1 truncate text-foreground sm:col-auto sm:row-auto">
                {u.userName}
              </span>
              <Progress
                value={Math.min(u.pct, 100)}
                className="col-start-1 row-start-2 h-1.5 sm:col-auto sm:row-auto"
                indicatorClassName={TONE_BAR[tone]}
              />
              <span className="col-start-2 row-start-2 justify-self-center whitespace-nowrap text-muted-foreground tabular-nums sm:col-auto sm:row-auto sm:justify-self-auto">
                {horasFmt(u.horas)} / {u.metaHoras}h
              </span>
              <span className={`col-start-2 row-start-1 justify-self-end whitespace-nowrap tabular-nums sm:col-auto sm:row-auto ${TONE_TEXT[tone]}`}>
                {u.pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </CardContent>
    </Card>
  );
}
