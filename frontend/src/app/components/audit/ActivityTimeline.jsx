import { useMemo, useRef, useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { motion } from '../../motion';
import { formatDateTime } from '../../utils';
import { EmptyState } from '../../pages/common';

const MotionLi = motion.li;

const ALL_VALUE = '__all__';

const FIELD_LABELS = {
  numero_processo: 'Número',
  cliente_id: 'Cliente',
  cliente_nome: 'Cliente',
  descricao: 'Descrição',
  vara: 'Vara',
  area_juridica: 'Área',
  status: 'Status',
  advogado_responsavel: 'Responsável',
  titulo: 'Título',
  data_limite: 'Data limite',
  prioridade: 'Prioridade',
  responsavel: 'Responsável',
  concluido: 'Concluído',
  observacoes: 'Observações',
  processo_id: 'Processo',
  processo_numero: 'Processo',
  tipo: 'Tipo',
  adverso: 'Adverso',
  responsavel_acao: 'Responsável',
  link_drive: 'Link do Drive',
  drive_file_id: 'Documento',
  motivo_pendente: 'Motivo pendente',
  // Evento fields
  data_inicio: 'Início',
  data_fim: 'Fim',
  tipo_evento: 'Tipo',
  local: 'Local',
  responsavel_nome: 'Responsável',
  criado_por: 'Criado por',
  lembrete_em: 'Lembrete',
};

const ACTION_LABELS = {
  criado: 'criou',
  atualizado: 'atualizou',
  excluido: 'excluiu',
};

const ACTION_DOT = {
  criado: 'bg-success shadow-[0_0_0_4px_hsl(var(--tw-success)/0.1)]',
  atualizado: 'bg-primary shadow-[0_0_0_4px_hsl(var(--tw-primary)/0.1)]',
  excluido: 'bg-destructive shadow-[0_0_0_4px_hsl(var(--tw-destructive)/0.1)]',
};

const ENTITY_META = {
  prazo: { label: 'Prazos', singular: 'Prazo', order: 1 },
  peticao: { label: 'Petições', singular: 'Petição', order: 2 },
  processo: { label: 'Processos', singular: 'Processo', order: 3 },
  evento: { label: 'Compromissos', singular: 'Compromisso', order: 4 },
};

const ENTITY_OPTIONS = [
  { value: ALL_VALUE, label: 'Todos os tipos' },
  { value: 'processo', label: 'Processos' },
  { value: 'prazo', label: 'Prazos' },
  { value: 'peticao', label: 'Petições' },
  { value: 'evento', label: 'Compromissos' },
];

const ACTION_OPTIONS = [
  { value: ALL_VALUE, label: 'Qualquer ação' },
  { value: 'criado', label: 'Criação' },
  { value: 'atualizado', label: 'Edição' },
  { value: 'excluido', label: 'Exclusão' },
];

const FIELD_HIDE_WHEN_PRESENT = {
  cliente_id: 'cliente_nome',
  processo_id: 'processo_numero',
};

function fieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === true) return 'Sim';
  if (value === false) return 'Não';
  return String(value);
}

function changedFieldLabels(changes) {
  const keys = Object.keys(changes || {});
  return keys
    .filter((key) => !keys.includes(FIELD_HIDE_WHEN_PRESENT[key]))
    .map(fieldLabel);
}

function formatChangedFields(changes) {
  const labels = changedFieldLabels(changes);
  if (!labels.length) return '';
  if (labels.length <= 3) return labels.join(', ');
  return `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`;
}

function processKeyFor(entry) {
  if (entry.processId) return entry.processId;
  if (entry.entityType === 'processo') return entry.entityId;
  return 'sem-processo';
}

function processLabelFor(entry) {
  if (entry.processLabel) return entry.processLabel;
  if (entry.entityType === 'processo' && entry.entityLabel) return entry.entityLabel;
  return 'Sem processo vinculado';
}

function groupEntries(entries) {
  const types = new Map();

  entries.forEach((entry) => {
    const typeKey = entry.entityType || 'outro';
    if (!types.has(typeKey)) {
      const meta = ENTITY_META[typeKey] || {
        label: typeKey || 'Outros',
        singular: typeKey || 'Registro',
        order: 99,
      };
      types.set(typeKey, {
        key: typeKey,
        ...meta,
        count: 0,
        processes: new Map(),
      });
    }

    const typeGroup = types.get(typeKey);
    const processKey = processKeyFor(entry);
    if (!typeGroup.processes.has(processKey)) {
      typeGroup.processes.set(processKey, {
        key: processKey,
        label: processLabelFor(entry),
        entries: [],
      });
    }

    typeGroup.count += 1;
    typeGroup.processes.get(processKey).entries.push(entry);
  });

  return Array.from(types.values())
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'))
    .map((typeGroup) => ({
      ...typeGroup,
      processes: Array.from(typeGroup.processes.values()),
    }));
}

function ChangeList({ changes }) {
  const allEntries = Object.entries(changes || {});
  const keys = allEntries.map(([key]) => key);
  const entries = allEntries.filter(
    ([key]) => !keys.includes(FIELD_HIDE_WHEN_PRESENT[key]),
  );
  if (!entries.length) return null;

  return (
    <ul className="mt-1 mb-0.5 grid list-none gap-1 rounded-md bg-muted/60 p-2 pl-2">
      {entries.map(([key, { de, para }]) => (
        <li key={key} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="min-w-[78px] text-muted-foreground">{fieldLabel(key)}</span>
          <span className="text-muted-foreground/80 line-through">{formatValue(de)}</span>
          <span className="text-muted-foreground" aria-hidden="true">→</span>
          <span className="text-success">{formatValue(para)}</span>
        </li>
      ))}
    </ul>
  );
}

function ActivityItem({ entry, index, entityLabel }) {
  const [open, setOpen] = useState(false);
  const hasChanges = entry.action === 'atualizado' && Object.keys(entry.changes || {}).length > 0;
  const actionLabel = ACTION_LABELS[entry.action] || entry.action;
  const changedFields = formatChangedFields(entry.changes);
  const entityName = entityLabel.toLowerCase();

  return (
    <MotionLi
      className="grid grid-cols-[auto_1fr] gap-1.5 border-b border-border/60 py-1.5 last:border-b-0"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.2) }}
    >
      <span
        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${ACTION_DOT[entry.action] || ACTION_DOT.atualizado}`}
        aria-hidden="true"
      />
      <div className="grid min-w-0 gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className="truncate text-sm">
            {entry.author || 'Sistema'} {actionLabel} {entityName}
          </strong>
          <span className="min-w-0 truncate text-sm text-muted-foreground">{entry.entityLabel || '—'}</span>
        </div>
        {hasChanges ? (
          <p className="m-0 text-xs text-muted-foreground">Alterou: {changedFields}</p>
        ) : entry.summary ? (
          <p className="m-0 text-xs text-muted-foreground">{entry.summary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{formatDateTime(entry.createdAt)}</span>
          {hasChanges ? (
            <button
              type="button"
              className="bg-transparent p-0 text-xs text-primary underline"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>
          ) : null}
        </div>
        {open && hasChanges ? <ChangeList changes={entry.changes} /> : null}
      </div>
    </MotionLi>
  );
}

function ActivityFilters({ filters, onChange, autores }) {
  const debounceRef = useRef(null);

  function handleChange(key, value) {
    const next = { ...filters, [key]: value };
    onChange(next);
  }

  function handleQ(e) {
    const value = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleChange('q', value), 350);
  }

  return (
    <div className="mb-3 grid gap-2">
      <Input
        type="text"
        placeholder="Buscar por resumo, responsável, processo…"
        defaultValue={filters.q || ''}
        onChange={handleQ}
        aria-label="Buscar no log"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.entidade_tipo || ALL_VALUE}
          onValueChange={(value) => handleChange('entidade_tipo', value === ALL_VALUE ? '' : value)}
        >
          <SelectTrigger className="w-auto min-w-[150px] max-w-[220px]" aria-label="Tipo de entidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.acao || ALL_VALUE}
          onValueChange={(value) => handleChange('acao', value === ALL_VALUE ? '' : value)}
        >
          <SelectTrigger className="w-auto min-w-[150px] max-w-[220px]" aria-label="Tipo de ação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.autor_nome || ALL_VALUE}
          onValueChange={(value) => handleChange('autor_nome', value === ALL_VALUE ? '' : value)}
        >
          <SelectTrigger className="w-auto min-w-[150px] max-w-[220px]" aria-label="Filtrar por responsável">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos os responsáveis</SelectItem>
            {autores.map((nome) => (
              <SelectItem key={nome} value={nome}>{nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-auto min-w-[110px] max-w-[180px]"
          value={filters.desde || ''}
          onChange={(e) => handleChange('desde', e.target.value)}
          aria-label="A partir de"
          title="A partir de"
        />
        <Input
          type="date"
          className="w-auto min-w-[110px] max-w-[180px]"
          value={filters.ate || ''}
          onChange={(e) => handleChange('ate', e.target.value)}
          aria-label="Até"
          title="Até"
        />
        {Object.values(filters).some(Boolean) && (
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange({})}>
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}

export function ActivityTimeline({ entries, filters, pagination, autores = [], onFilterChange, onLoadMore }) {
  const groups = useMemo(() => groupEntries(entries), [entries]);

  return (
    <Card>
    <CardContent className="py-5">
      <div className="section-head">
        <div>
          <h2 className="section-title">Atividade recente</h2>
          <p className="section-note">
            Por tipo, agrupada pelo processo
            {pagination?.total > 0 ? ` — ${pagination.total} registros` : ''}
          </p>
        </div>
      </div>
      {onFilterChange && (
        <ActivityFilters filters={filters || {}} onChange={onFilterChange} autores={autores} />
      )}
      {groups.length ? (
        <>
          {/* Grupos por tipo colapsados por padrão — reduz densidade do log,
              cada tipo mostra a contagem sem expor todas as entradas de cara. */}
          <Accordion type="multiple" className="grid gap-1">
            {groups.map((typeGroup) => (
              <AccordionItem key={typeGroup.key} value={typeGroup.key} className="rounded-lg border-b-0 bg-muted/30 px-3">
                <AccordionTrigger className="py-2.5 hover:no-underline">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                    <div className="text-left">
                      <h3 className="text-xs font-medium uppercase tracking-wide text-foreground">{typeGroup.label}</h3>
                      <span className="text-xs text-muted-foreground">{typeGroup.processes.length} processo(s)</span>
                    </div>
                    <Badge variant="default">{typeGroup.count}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0">
                  <div className="grid gap-1">
                    {typeGroup.processes.map((processGroup) => (
                      <section key={processGroup.key} className="border-b border-border/60 py-1.5 pl-2 last:border-b-0">
                        <header className="mb-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{processGroup.label}</span>
                          <strong className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-muted text-[0.68rem] tabular-nums text-muted-foreground">
                            {processGroup.entries.length}
                          </strong>
                        </header>
                        <ol className="grid list-none gap-0 p-0">
                          {processGroup.entries.map((entry, index) => (
                            <ActivityItem
                              key={entry.id}
                              entry={entry}
                              index={index}
                              entityLabel={typeGroup.singular}
                            />
                          ))}
                        </ol>
                      </section>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {pagination?.temMais && onLoadMore && (
            <div className="flex justify-center py-3">
              <Button type="button" variant="outline" size="sm" onClick={onLoadMore}>
                Carregar mais
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Sem atividade registrada."
          copy="Criações, edições e exclusões de processos, prazos, petições e compromissos aparecem aqui."
        />
      )}
    </CardContent>
    </Card>
  );
}
