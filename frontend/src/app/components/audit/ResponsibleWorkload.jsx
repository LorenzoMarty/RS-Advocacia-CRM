import { progressPercent } from '../../lib/auditSelectors';

// Área C — ranking horizontal de responsáveis por nº de pendências.
export function ResponsibleWorkload({ workload, limit = 5 }) {
  const top = workload.slice(0, limit);
  const max = top[0]?.count || 0;

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Carga por responsável</h2>
          <p className="section-note">Prazos pendentes em aberto</p>
        </div>
      </div>
      {top.length ? (
        <div className="audit-bar-list">
          {top.map((item, i) => (
            <div key={item.name} className={`audit-bar-row${i === 0 && max >= 5 ? ' is-overloaded' : ''}`}>
              <strong>{item.name}</strong>
              <div className="productivity-bar">
                <span style={{ width: `${progressPercent(item.count, max)}%` }} />
              </div>
              <span>{item.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="note-box">Sem prazos pendentes.</div>
      )}
    </section>
  );
}
