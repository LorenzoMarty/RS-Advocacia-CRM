import { useMemo, useRef, useState } from 'react';

import { motion } from '../../motion';
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

const ENTITY_META = {
  prazo: { label: 'Prazos', singular: 'Prazo', order: 1 },
  peticao: { label: 'Petições', singular: 'Petição', order: 2 },
  processo: { label: 'Processos', singular: 'Processo', order: 3 },
  evento: { label: 'Compromissos', singular: 'Compromisso', order: 4 },
};

const ENTITY_OPTIONS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'processo', label: 'Processos' },
  { value: 'prazo', label: 'Prazos' },
  { value: 'peticao', label: 'Petições' },
  { value: 'evento', label: 'Compromissos' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'Qualquer ação' },
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
  const hasChanges = entry.action === 'atualizado' && Object.keys(entry.changes || {}).length > 0;
  const actionLabel = ACTION_LABELS[entry.action] || entry.action;
  const changedFields = formatChangedFields(entry.changes);
  const entityName = entityLabel.toLowerCase();

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
          <strong className="audit-timeline-label">
            {entry.author || 'Sistema'} {actionLabel} {entityName}
          </strong>
          <span className="audit-entity-name">{entry.entityLabel || '—'}</span>
        </div>
        {hasChanges ? (
          <p className="audit-timeline-summary">Alterou: {changedFields}</p>
        ) : entry.summary ? (
          <p className="audit-timeline-summary">{entry.summary}</p>
        ) : null}
        <div className="audit-timeline-meta">
          <span>{formatDateTime(entry.createdAt)}</span>
          {hasChanges ? (
            <button
              type="button"
              className="audit-diff-toggle"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>
          ) : null}
        </div>
        {open && hasChanges ? <ChangeList changes={entry.changes} /> : null}
      </div>
    </MotionItem>
  );
}

function ActivityFilters({ filters, onChange }) {
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
    <div className="audit-filters">
      <input
        type="text"
        className="audit-filter-search"
        placeholder="Buscar por resumo, responsável, processo…"
        defaultValue={filters.q || ''}
        onChange={handleQ}
        aria-label="Buscar no log"
      />
      <div className="audit-filter-row">
        <select
          className="audit-filter-select"
          value={filters.entidade_tipo || ''}
          onChange={(e) => handleChange('entidade_tipo', e.target.value)}
          aria-label="Tipo de entidade"
        >
          {ENTITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          className="audit-filter-select"
          value={filters.acao || ''}
          onChange={(e) => handleChange('acao', e.target.value)}
          aria-label="Tipo de ação"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          className="audit-filter-select"
          placeholder="Responsável"
          value={filters.autor_nome || ''}
          onChange={(e) => handleChange('autor_nome', e.target.value)}
          aria-label="Filtrar por responsável"
        />
        <input
          type="date"
          className="audit-filter-select"
          value={filters.desde || ''}
          onChange={(e) => handleChange('desde', e.target.value)}
          aria-label="A partir de"
          title="A partir de"
        />
        <input
          type="date"
          className="audit-filter-select"
          value={filters.ate || ''}
          onChange={(e) => handleChange('ate', e.target.value)}
          aria-label="Até"
          title="Até"
        />
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            className="audit-filter-clear"
            onClick={() => onChange({})}
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

export function ActivityTimeline({ entries, filters, pagination, onFilterChange, onLoadMore }) {
  const groups = useMemo(() => groupEntries(entries), [entries]);

  return (
    <section className="audit-card surface section-card audit-activity">
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
        <ActivityFilters filters={filters || {}} onChange={onFilterChange} />
      )}
      {groups.length ? (
        <>
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
          {pagination?.temMais && onLoadMore && (
            <div className="audit-load-more">
              <button type="button" className="audit-load-more-btn" onClick={onLoadMore}>
                Carregar mais
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Sem atividade registrada."
          copy="Criações, edições e exclusões de processos, prazos, petições e compromissos aparecem aqui."
        />
      )}
    </section>
  );
}
