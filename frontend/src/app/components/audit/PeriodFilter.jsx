const PERIOD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 0, label: 'Tudo' },
];

// Segmented control: horizonte de vencimento usado nos prazos/heatmap/prioridades.
// Reusa o padrão .productivity-segmented (aria-pressed) do projeto.
export function PeriodFilter({ value, onChange }) {
  return (
    <div className="productivity-segmented" role="group" aria-label="Período">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
