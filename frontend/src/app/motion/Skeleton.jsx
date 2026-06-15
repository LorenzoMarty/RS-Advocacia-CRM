/**
 * Skeleton — placeholder de carregamento com shimmer (CSS em loading.css).
 *
 * Props:
 *   width / height: CSS length (default '100%' / '1em')
 *   radius:         border-radius CSS (default '10px')
 *   circle:         boolean — força um círculo (width = height)
 *   count:          número de linhas empilhadas (default 1)
 *   className:      classes extras
 *
 * O shimmer desliga sob prefers-reduced-motion (via loading.css).
 *
 * Exemplo:
 *   <Skeleton width={180} height={20} />
 *   <Skeleton circle width={40} />
 *   <Skeleton count={3} />
 */
function toCss(value) {
  return typeof value === 'number' ? `${value}px` : value;
}

export default function Skeleton({
  width = '100%',
  height = '1em',
  radius = '10px',
  circle = false,
  count = 1,
  className = '',
  style = {},
  ...rest
}) {
  const resolvedHeight = toCss(height);
  const resolvedWidth = circle ? resolvedHeight : toCss(width);
  const resolvedRadius = circle ? '999px' : toCss(radius);

  const items = Array.from({ length: Math.max(1, count) });

  return (
    <span
      className={`skeleton-stack${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      {...rest}
    >
      {items.map((_, index) => (
        <span
          key={index}
          className="skeleton"
          style={{
            width: resolvedWidth,
            height: resolvedHeight,
            borderRadius: resolvedRadius,
            ...style,
          }}
        />
      ))}
    </span>
  );
}
