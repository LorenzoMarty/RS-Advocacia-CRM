// Filtro de período (semana | mês | personalizado).
import { Segmented } from '@/components/ui/segmented';

const OPTIONS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'custom', label: 'Personalizado' },
];

export function PeriodFilter({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) {
  return (
    <div className="productivity-filters">
      <Segmented tone="bg" label="Filtrar período" options={OPTIONS} value={period} onChange={setPeriod} />
      {period === 'custom' ? (
        <>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Data inicial" />
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="Data final" />
        </>
      ) : null}
    </div>
  );
}
