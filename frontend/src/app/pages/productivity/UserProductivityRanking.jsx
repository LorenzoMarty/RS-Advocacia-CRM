import { CHART_PALETTE, formatHoursCompact } from './productivity-data';

function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

// Ranking de produção por usuário (visão admin / escritório).
export function UserProductivityRanking({ byUser }) {
  const peak = byUser[0]?.seconds || 1;

  return (
    <section className="surface section-card pd-card">
      <div className="section-head">
        <div>
          <h2 className="section-title">Quem produziu mais</h2>
          <p className="section-note">Tempo registrado por pessoa</p>
        </div>
      </div>

      {byUser.length ? (
        <ol className="pd-ranking">
          {byUser.map((user, index) => (
            <li key={user.userId || index} className="pd-rank-row">
              <span className="pd-rank-pos">{index + 1}</span>
              <span className="pd-avatar" style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }}>
                {initials(user.userName)}
              </span>
              <div className="pd-rank-body">
                <div className="pd-rank-head">
                  <strong title={user.userName}>{user.userName || 'Sem nome'}</strong>
                  <span>{formatHoursCompact(user.seconds)}</span>
                </div>
                <div className="pd-hbar-track">
                  <span
                    className="pd-hbar-fill"
                    style={{ width: `${Math.max(3, Math.round((user.seconds / peak) * 100))}%`, background: CHART_PALETTE[index % CHART_PALETTE.length] }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="pd-note">Nenhum registro de tempo no período.</p>
      )}
    </section>
  );
}
