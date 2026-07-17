import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';

const STATUS_TONE = {
  'Pendente': 'gold',
  'Em andamento': 'warn',
  'Protocolar': 'info',
  'Protocolado': 'success',
};

export function PetitionFunnel({ petitionFunnel = [] }) {
  const total = petitionFunnel.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="audit-card">
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Petições</h2>
          <p className="section-note">Funil por etapa do workflow</p>
        </div>
        <Link to="/peticoes" className="section-action">Ver todas →</Link>
      </div>
      <div className="audit-funnel">
        {petitionFunnel.map(({ status, count }) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const tone = STATUS_TONE[status] || 'neutral';
          return (
            <div key={status} className={`audit-funnel-step is-${tone}`}>
              <div className="audit-funnel-bar-wrap">
                <div
                  className="audit-funnel-bar"
                  style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                />
              </div>
              <div className="audit-funnel-info">
                <span className="audit-funnel-status">{status}</span>
                <strong className="audit-funnel-count">{count}</strong>
              </div>
            </div>
          );
        })}
        {!total && (
          <p className="audit-empty-note">Nenhuma petição cadastrada.</p>
        )}
      </div>
    </CardContent>
    </Card>
  );
}
