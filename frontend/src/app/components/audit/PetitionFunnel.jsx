import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const STATUS_TONE = {
  'Pendente': 'gold',
  'Em andamento': 'warn',
  'Protocolar': 'info',
  'Protocolado': 'success',
};

const TONE_BAR = {
  gold: 'bg-primary',
  warn: 'bg-warn',
  info: 'bg-primary',
  success: 'bg-success',
  neutral: 'bg-primary',
};

export function PetitionFunnel({ petitionFunnel = [] }) {
  const total = petitionFunnel.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Petições</h2>
          <p className="section-note">Funil por etapa do workflow</p>
        </div>
        <Link to="/peticoes" className="text-sm text-primary no-underline hover:underline whitespace-nowrap">Ver todas →</Link>
      </div>
      <div className="grid gap-2.5">
        {petitionFunnel.map(({ status, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const tone = STATUS_TONE[status] || 'neutral';
          return (
            <div key={status} className="grid gap-1">
              <Progress
                value={Math.max(pct, count > 0 ? 8 : 0)}
                className="h-2"
                indicatorClassName={TONE_BAR[tone]}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">{status}</span>
                <strong className="text-base tabular-nums">{count}</strong>
              </div>
            </div>
          );
        })}
        {!total && (
          <p className="text-sm text-muted-foreground">Nenhuma petição cadastrada.</p>
        )}
      </div>
    </CardContent>
    </Card>
  );
}
