// Shared palette so recharts matches the dark/gold theme.
const CHART_COLORS = [
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
