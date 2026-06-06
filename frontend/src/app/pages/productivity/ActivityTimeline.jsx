import { formatHoursCompact, startOfDay } from './productivity-data';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function intensityLevel(seconds, max) {
  if (!seconds) return 0;
  const ratio = seconds / (max || 1);
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

// Constrói células diárias contínuas, alinhadas em colunas semanais (seg→dom).
function buildHeatmap(daySeries) {
  if (!daySeries.length) return { cells: [], max: 0 };
  const map = new Map(daySeries.map((d) => [d.date, d.seconds]));
  const last = new Date(`${daySeries[daySeries.length - 1].date}T12:00:00`);

  const start = startOfDay(new Date(`${daySeries[0].date}T12:00:00`));
  const offset = (start.getDay() || 7) - 1; // recua até a segunda-feira
  start.setDate(start.getDate() - offset);

  const max = daySeries.reduce((m, d) => Math.max(m, d.seconds), 0);
  const cells = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 400) {
    const key = cursor.toISOString().slice(0, 10);
    const seconds = map.get(key) || 0;
    cells.push({ date: key, seconds, level: intensityLevel(seconds, max) });
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return { cells, max };
}

// Timeline/heatmap de atividade por dia.
export function ActivityTimeline({ daySeries }) {
  const { cells } = buildHeatmap(daySeries);

  return (
    <section className="surface section-card productivity-block">
      <div className="section-head">
        <div>
          <h2 className="section-title">Quando o tempo foi gasto</h2>
          <p className="section-note">Intensidade diária no período</p>
        </div>
      </div>

      {cells.length ? (
        <>
          <div className="productivity-heatmap">
            <div className="productivity-heatmap-days" aria-hidden="true">
              {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="productivity-heatmap-grid">
              {cells.map((cell) => (
                <span
                  key={cell.date}
                  className={`productivity-heat productivity-heat-${cell.level}`}
                  title={`${cell.date} • ${formatHoursCompact(cell.seconds)}`}
                />
              ))}
            </div>
          </div>
          <div className="productivity-heatmap-legend">
            <span>menos</span>
            {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`productivity-heat productivity-heat-${level}`} />)}
            <span>mais</span>
          </div>
        </>
      ) : (
        <div className="note-box">Sem atividade registrada no período.</div>
      )}
    </section>
  );
}
