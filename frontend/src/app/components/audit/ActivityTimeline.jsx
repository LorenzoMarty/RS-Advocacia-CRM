import { useMemo, useState } from 'react';

import { motion } from '../../motion';
import { StatusBadge } from '../../layout';
import { formatDateTime } from '../../utils';
import { EmptyState } from '../../pages/common';

// motion.li como referência real (o lint do projeto não conta uso só em JSX).
const MotionItem = motion.li;

// Rótulos pt-BR para os campos que aparecem no diff (chaves = nomes de campo do backend).
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
};

const ACTION_LABELS = {
  criado: 'Criado',
  atualizado: 'Atualizado',
  excluido: 'Excluído',
};

const ACTION_TONE = {
  criado: 'success',
  atualizado: 'gold',
  excluido: 'danger',
};

const ENTITY_LABELS = {
  processo: 'Processo',
  prazo: 'Prazo',
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

function ChangeList({ changes }) {
  const entries = Object.entries(changes || {});
  if (!entries.length) return null;

  return (
    <ul className="audit-diff">
      {entries.map(([key, { de, para }]) => (
        <li key={key} className="audit-diff-row">
          <span className="audit-diff-field">{fieldLabel(key)}</span>
          <span className="audit-diff-from">{formatValue(de)}</span>
          <span className="audit-diff-arrow" aria-hidden="true">→</span>
          <span className="audit-diff-to">{formatValue(para)}</span>
        </li>
      ))}
    </ul>
  );
}

function TimelineItem({ entry, index }) {
  const [open, setOpen] = useState(false);
  const tone = ACTION_TONE[entry.action] || 'gold';
  const hasChanges = entry.action === 'atualizado' && Object.keys(entry.changes || {}).length > 0;

  return (
    <MotionItem
      className="audit-timeline-item"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.4) }}
    >
      <span className={`audit-action-badge is-${entry.action}`} aria-hidden="true" />
      <div className="audit-timeline-main">
        <div className="audit-timeline-head">
          <StatusBadge tone={tone}>{ACTION_LABELS[entry.action] || entry.action}</StatusBadge>
          <span className="audit-entity-chip">{ENTITY_LABELS[entry.entityType] || entry.entityType}</span>
          <strong className="audit-timeline-label">{entry.entityLabel || '—'}</strong>
        </div>
        <p className="audit-timeline-summary">{entry.summary}</p>
        <div className="audit-timeline-meta">
          <span>{entry.author || 'Sistema'}</span>
          <span aria-hidden="true">•</span>
          <span>{formatDateTime(entry.createdAt)}</span>
          {hasChanges ? (
            <button
              type="button"
              className="audit-diff-toggle"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Ocultar mudanças' : `Ver mudanças (${Object.keys(entry.changes).length})`}
            </button>
          ) : null}
        </div>
        {open && hasChanges ? <ChangeList changes={entry.changes} /> : null}
      </div>
    </MotionItem>
  );
}

const FILTERS = [
  { key: 'all', label: 'Tudo' },
  { key: 'processo', label: 'Processos' },
  { key: 'prazo', label: 'Tarefas' },
];

// Área de atividade — feed cronológico de "quem fez o quê, quando" em processos e prazos.
export function ActivityTimeline({ entries }) {
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((entry) => entry.entityType === filter);
  }, [entries, filter]);

  return (
    <section className="audit-card surface section-card audit-activity">
      <div className="section-head">
        <div>
          <h2 className="section-title">Atividade recente</h2>
          <p className="section-note">O que está acontecendo com processos e tarefas</p>
        </div>
        <div className="productivity-segmented" role="tablist">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={filter === option.key}
              className={filter === option.key ? 'is-active' : ''}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <ol className="audit-timeline">
          {visible.map((entry, index) => (
            <TimelineItem key={entry.id} entry={entry} index={index} />
          ))}
        </ol>
      ) : (
        <EmptyState
          title="Sem atividade registrada."
          copy="Criações, edições e exclusões de processos e tarefas aparecem aqui."
        />
      )}
    </section>
  );
}
