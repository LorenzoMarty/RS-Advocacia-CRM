import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';

const TONE_TEXT = {
  danger: 'text-destructive',
  warn: 'text-warn',
  gold: 'text-primary',
  success: 'text-success',
  neutral: 'text-muted-foreground',
};

function KpiTile({ label, value, tone }) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted/40 p-2.5 text-center">
      <strong className={`text-2xl leading-none tracking-tight tabular-nums ${TONE_TEXT[tone] || TONE_TEXT.neutral}`}>
        {value}
      </strong>
      <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export function DeadlinesPanel({ prazos = {} }) {
  const { overdue = 0, today = 0, dueSoon = 0, done = 0 } = prazos;
  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Prazos</h2>
          <p className="section-note">Visão geral de vencimentos</p>
        </div>
        <Link to="/prazos" className="text-sm text-primary no-underline hover:underline whitespace-nowrap">Ver todos →</Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile label="Vencidos" value={overdue} tone={overdue ? 'danger' : 'neutral'} />
        <KpiTile label="Vencem hoje" value={today} tone={today ? 'warn' : 'neutral'} />
        <KpiTile label="Vencendo em breve" value={dueSoon} tone={dueSoon ? 'gold' : 'neutral'} />
        <KpiTile label="Concluídos" value={done} tone="success" />
      </div>
    </CardContent>
    </Card>
  );
}
