// Área C — ranking de responsáveis por nº de pendências, no padrão .pd-hbar.
export function ResponsibleWorkload({ workload, limit = 5 }) {
  const top = workload.slice(0, limit);
  const max = top[0]?.count || 1;

  return (
    <section className="surface section-card audit-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Carga por responsável</h2>
          <p className="section-note">Prazos pendentes em aberto</p>
        </div>
      </div>
      {top.length ? (
        <ul className="pd-hbars">
          {top.map((item, i) => {
            const overloaded = i === 0 && max >= 5;
            return (
              <li key={item.name} className="pd-hbar-row">
                <div className="pd-hbar-head">
                  <span className="pd-hbar-label" title={item.name}>{item.name}</span>
                  <span className="pd-hbar-value">{item.count}</span>
                </div>
                <div className="pd-hbar-track">
                  <span
                    className="pd-hbar-fill"
                    style={{
                      width: `${Math.max(2, Math.round((item.count / max) * 100))}%`,
                      background: overloaded ? 'var(--warn)' : 'var(--chart-1)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="note-box">Sem prazos pendentes.</div>
      )}
    </section>
  );
}
