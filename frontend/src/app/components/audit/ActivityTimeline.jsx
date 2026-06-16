import { useMemo, useState } from 'react';

import { motion } from '../../motion';
import { StatusBadge } from '../../layout';
import { formatDateTime } from '../../utils';
import { EmptyState } from '../../pages/common';

const MotionItem = motion.li;

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

const ENTITY_META = {
  prazo: { label: 'Prazos', singular: 'Prazo', order: 1 },
  peticao: { label: 'Petições', singular: 'Petição', order: 2 },
  processo: { label: 'Processos', singular: 'Processo', order: 3 },
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

function ActivityItem({ entry, index, entityLabel }) {
  const [open, setOpen] = useState(false);
  const tone = ACTION_TONE[entry.action] || 'gold';
  const hasChanges = entry.action === 'atualizado' && Object.keys(entry.changes || {}).length > 0;

  return (
    <MotionItem
      className="audit-timeline-item"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.2) }}
    >
      <span className={`audit-action-badge is-${entry.action}`} aria-hidden="true" />
      <div className="audit-timeline-main">
        <div className="audit-timeline-head">
          <StatusBadge tone={tone}>{ACTION_LABELS[entry.action] || entry.action}</StatusBadge>
          <span className="audit-entity-chip">{entityLabel}</span>
          <strong className="audit-timeline-label">{entry.entityLabel || '—'}</strong>
        </div>
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
              {open ? 'Ocultar' : `${Object.keys(entry.changes).length} mudança(s)`}
            </button>
          ) : null}
        </div>
        {open && hasChanges ? <ChangeList changes={entry.changes} /> : null}
      </div>
    </MotionItem>
  );
}

export function ActivityTimeline({ entries }) {
  const groups = useMemo(() => groupEntries(entries), [entries]);

  return (
    <section className="audit-card surface section-card audit-activity">
      <div className="section-head">
        <div>
          <h2 className="section-title">Atividade recente</h2>
          <p className="section-note">Separada por tipo e agrupada por processo</p>
        </div>
      </div>
      {groups.length ? (
        <div className="audit-activity-grid">
          {groups.map((typeGroup) => (
            <article key={typeGroup.key} className="audit-type-card">
              <header className="audit-type-head">
                <div>
                  <h3>{typeGroup.label}</h3>
                  <span>{typeGroup.processes.length} processo(s)</span>
                </div>
                <strong>{typeGroup.count}</strong>
              </header>
              <div className="audit-process-list">
                {typeGroup.processes.map((processGroup) => (
                  <section key={processGroup.key} className="audit-process-group">
                    <header className="audit-process-head">
                      <span>{processGroup.label}</span>
                      <strong>{processGroup.entries.length}</strong>
                    </header>
                    <ol className="audit-timeline">
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
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sem atividade registrada."
          copy="Criações, edições e exclusões de processos, prazos e petições aparecem aqui."
        />
      )}
    </section>
  );
}
