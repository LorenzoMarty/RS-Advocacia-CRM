import { Link } from 'react-router-dom';

const TONE_TEXT = {
  danger: 'text-destructive',
  warn: 'text-warn',
  success: 'text-success',
  gold: 'text-primary',
};

// Métrica de alerta em grid — `tone` colore só o valor: danger | warn | success | gold.
export function AlertCard({ label, value, hint, tone = 'gold', to }) {
  const content = (
    <>
      <span className="text-meta-sm font-semibold text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <strong className={`text-[1.86rem] font-extrabold tracking-[-0.02em] tabular-nums leading-tight ${TONE_TEXT[tone] || TONE_TEXT.gold}`}>
          {value}
        </strong>
        {hint ? <em className="text-[.86rem] font-semibold not-italic text-muted-foreground">{hint}</em> : null}
      </span>
    </>
  );

  const classes = 'flex flex-col justify-center gap-1.5 rounded-md px-3.5 py-3 no-underline transition-colors hover:bg-surface-2 active:scale-[.99]';

  if (to) {
    return <Link className={classes} to={to}>{content}</Link>;
  }
  return <div className={classes}>{content}</div>;
}
