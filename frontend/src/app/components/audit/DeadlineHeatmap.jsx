import { DEADLINE_BUCKETS } from '../../lib/auditSelectors';

// Área C — heatmap prazos: linhas = responsável, colunas = janela de vencimento.
export function DeadlineHeatmap({ heatmap }) {
  const { rows, maxCell } = heatmap;

  return (
    <section className="audit-card surface section-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Matriz de prazos</h2>
          <p className="section-note">Responsável × urgência</p>
        </div>
      </div>
      {rows.length ? (
        <div className="audit-heatmap-scroll">
          <table className="audit-heatmap">
            <thead>
              <tr>
                <th aria-label="Responsável" />
                {DEADLINE_BUCKETS.map((b) => (
                  <th key={b.key} className={`is-${b.tone}`}>{b.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  {DEADLINE_BUCKETS.map((b) => {
                    const value = row[b.key];
                    const intensity = maxCell ? value / maxCell : 0;
                    return (
                      <td key={b.key} className={`audit-heat-cell is-${b.tone}`}>
                        <span
                          className="audit-heat-fill"
                          style={{ opacity: value ? 0.15 + intensity * 0.85 : 0 }}
                        />
                        <span className="audit-heat-num">{value || ''}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="note-box">Sem prazos pendentes para mapear.</div>
      )}
    </section>
  );
}
