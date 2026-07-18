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
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className={`text-lg font-medium tabular-nums leading-tight ${TONE_TEXT[tone] || TONE_TEXT.gold}`}>
        {value}
      </strong>
      {hint ? <em className="text-[0.64rem] not-italic text-muted-foreground">{hint}</em> : null}
    </>
  );

  const classes = 'flex flex-col gap-0.5 rounded-lg border border-transparent bg-muted/40 p-3 no-underline transition-colors hover:border-primary/30 hover:bg-primary/10 active:scale-[.99]';

  if (to) {
    return <Link className={classes} to={to}>{content}</Link>;
  }
  return <div className={classes}>{content}</div>;
}
