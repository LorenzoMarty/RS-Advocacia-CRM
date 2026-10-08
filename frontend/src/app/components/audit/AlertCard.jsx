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
      <strong className={`text-card-title tabular-nums leading-tight ${TONE_TEXT[tone] || TONE_TEXT.gold}`}>
        {value}
      </strong>
      {hint ? <em className="text-[0.64rem] not-italic text-muted-foreground">{hint}</em> : null}
    </>
  );

  const classes = 'flex flex-col gap-0.5 rounded-lg bg-card p-4 no-underline transition-colors hover:bg-surface-2 active:scale-[.99]';

  if (to) {
    return <Link className={classes} to={to}>{content}</Link>;
  }
  return <div className={classes}>{content}</div>;
}
