// Filtro de período (semana | mês | personalizado).
import { Select } from '../../components/select';

export function PeriodFilter({ period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd }) {
  return (
    <div className="productivity-filters">
      <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Filtrar período">
        <option value="week">Esta semana</option>
        <option value="month">Este mês</option>
        <option value="custom">Personalizado</option>
      </Select>
      {period === 'custom' ? (
        <>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Data inicial" />
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="Data final" />
        </>
      ) : null}
    </div>
  );
}
