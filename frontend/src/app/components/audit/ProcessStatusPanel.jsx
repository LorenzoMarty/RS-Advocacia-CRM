import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';

export function ProcessStatusPanel({ processStatus = [], staleProcesses = { count: 0, itens: [] } }) {
  return (
    <Card className="audit-card">
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Processos</h2>
          <p className="section-note">Distribuição por status e parados</p>
        </div>
        <Link to="/processos" className="section-action">Ver todos →</Link>
      </div>
      <div className="audit-process-status-grid">
        <div className="audit-status-bars">
          {processStatus.length ? (
            <ul className="audit-status-list">
              {processStatus.map(({ status, count }) => (
                <li key={status} className="audit-status-row">
                  <span className="audit-status-label">{status}</span>
                  <div className="audit-status-bar-wrap">
                    <div
                      className="audit-status-bar"
                      style={{
                        width: `${Math.round((count / Math.max(...processStatus.map((s) => s.count), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="audit-status-count">{count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="audit-empty-note">Nenhum processo cadastrado.</p>
          )}
        </div>

        {staleProcesses.count > 0 && (
          <div className="audit-stale-panel">
            <header className="audit-stale-header">
              <span className="audit-stale-badge">{staleProcesses.count}</span>
              <span>parados +30 dias</span>
            </header>
            <ul className="audit-stale-list">
              {staleProcesses.itens.slice(0, 5).map((p) => (
                <li key={p.id} className="audit-stale-item">
                  <Link to={`/processos/${p.id}`} className="audit-stale-link">
                    <strong>{p.numero || 'Processo'}</strong>
                    <span>{p.cliente_nome}</span>
                  </Link>
                  <span className="audit-stale-days">{p.dias_parado}d</span>
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
