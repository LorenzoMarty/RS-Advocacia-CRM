// Shared palette + tooltip styling so recharts matches the dark/gold theme.
export const CHART_COLORS = [
  '#D4AF37', // gold
  '#73d3b1', // success
  '#6fa8dc', // blue
  '#e8b25c', // warn
  '#b59ad6', // purple
  '#ef7a7a', // danger
  '#5bd1c4', // teal
  '#c98fb0', // rose
];

export function colorAt(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export const TOOLTIP_STYLE = {
  background: 'rgba(20,24,33,.96)',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 12,
  fontSize: 12,
  color: '#f4f4f5',
};
