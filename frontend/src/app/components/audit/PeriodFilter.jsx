import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 0, label: 'Tudo' },
];

// Segmented control de horizonte de vencimento — Tabs do shadcn usado como
// filtro (sem TabsContent, o conteúdo já reage via onPeriodChange; por isso
// aria-controls é removido: apontaria para um painel que não existe).
export function PeriodFilter({ value, onChange }) {
  return (
    <Tabs value={String(value)} onValueChange={(next) => onChange(Number(next))}>
      <TabsList tone="bg" aria-label="Período">
        {PERIOD_OPTIONS.map((opt) => (
          <TabsTrigger key={opt.value} value={String(opt.value)} aria-controls={undefined}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
