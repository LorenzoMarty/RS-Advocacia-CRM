import { Sparkline } from './charts/Sparkline';
import { formatHoursCompact } from './productivity-data';

function VariationBadge({ variation }) {
  if (variation == null) {
    return <span className="pd-delta pd-delta-flat">sem base anterior</span>;
  }
  const up = variation >= 0;
  return (
    <span className={`pd-delta ${up ? 'pd-delta-up' : 'pd-delta-down'}`}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {up ? '+' : ''}{variation}% vs período anterior
    </span>
  );
}

// Hero KPI: tempo total do período em destaque + variação + sparkline.
export function HeroMetrics({ totalSeconds, variation, daySeries }) {
  return (
    <section className="pd-hero">
      <div className="pd-hero-main">
        <span className="pd-eyebrow">Tempo trabalhado no período</span>
        <strong className="pd-hero-value">{formatHoursCompact(totalSeconds)}</strong>
        <VariationBadge variation={variation} />
      </div>
      <div className="pd-hero-spark">
        <Sparkline data={daySeries} />
      </div>
    </section>
  );
}
