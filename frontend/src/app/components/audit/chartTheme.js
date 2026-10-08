// Shared chart palette (CSS tokens, so charts follow the light/dark theme).
// Principal series = accent; secondary = saturated category hues.
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--success)',
  'var(--danger)',
  'var(--warn)',
];

export function colorAt(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}
