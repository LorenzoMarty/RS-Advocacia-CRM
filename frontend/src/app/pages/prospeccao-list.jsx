import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { INTERACTION_TYPE_OPTIONS, PROSPECT_STATUS_COLUMNS } from '../data';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { motion as Motion, pop, staggerContainer } from '../motion';
import { useAppState } from '../store';
import { buildSearchText, formatDate, normalizeText } from '../utils';
import { Select } from '../components/select';
import { EmptyState } from './common';
import {
  STALE_DAYS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  daysSince,
  deadlineAuditFor,
  idleLabel,
  isThisMonth,
  nextStatusOf,
  priorityLabel,
  priorityTone,
} from './prospeccao-utils';

function ProspectCard({ prospect, deadlines, onDragStart, onDragEnd, isDragging, onAdvance, onAddInteraction }) {
  const audit = deadlineAuditFor(prospect.responsibleName, deadlines);
  const [showInteraction, setShowInteraction] = useState(false);
  const [interactionType, setInteractionType] = useState('ligacao');
  const [interactionText, setInteractionText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isTerminal = TERMINAL_STATUSES.some(
    (status) => normalizeText(prospect.status) === normalizeText(status),
  );
  const idleDays = daysSince(prospect.lastContact || prospect.createdAt);
  const isStale = !isTerminal && idleDays != null && idleDays >= STALE_DAYS;
  const nextStatus = isTerminal ? null : nextStatusOf(prospect.status);

  function handleDragStart(event) {
    // Não inicia drag a partir dos controles de ação rápida.
    if (event.target.closest('.prospect-card-quick')) {
      event.preventDefault();
      return;
    }
    onDragStart(event, prospect.id);
  }

  async function submitInteraction(event) {
    event.preventDefault();
    if (!interactionText.trim()) return;
    setIsSaving(true);
    try {
      const saved = await onAddInteraction(prospect.id, {
        type: interactionType,
        description: interactionText.trim(),
      });
      if (saved) {
        setInteractionText('');
        setShowInteraction(false);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article
      className={`prospect-card${isDragging ? ' is-dragging' : ''}${audit.critical ? ' is-critical' : ''}${isStale ? ' is-stale' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="prospect-card-head">
        <Link to={`/prospeccao/${prospect.id}`} className="prospect-card-name">
          {prospect.name}
        </Link>
        <StatusBadge tone={priorityTone(prospect.priority)}>{priorityLabel(prospect.priority)}</StatusBadge>
      </div>
      <p className="prospect-card-demand">{prospect.demandType || 'Demanda não informada'}</p>
      <dl className="prospect-card-meta">
        <div>
          <dt>Responsável</dt>
          <dd>{prospect.responsibleName || '-'}</dd>
        </div>
        <div>
          <dt>Próximo passo</dt>
          <dd>{prospect.nextAction || '-'}</dd>
        </div>
        <div>
          <dt>Última interação</dt>
          <dd>{prospect.lastContact ? formatDate(prospect.lastContact) : '-'}</dd>
        </div>
      </dl>

      {isStale ? (
        <p className="prospect-card-stale">⏳ Parado {idleLabel(idleDays)}</p>
      ) : null}

      {audit.critical ? (
        <p className="prospect-card-alert">
          {audit.active} prazo(s) ativo(s) · {audit.critical} crítico(s)
        </p>
      ) : null}

      <div className="prospect-card-quick">
        {showInteraction ? (
          <form className="prospect-quick-form" onSubmit={submitInteraction}>
            <Select
              aria-label="Tipo de interação"
              value={interactionType}
              onChange={(event) => setInteractionType(event.target.value)}
            >
              {INTERACTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
            <input
              value={interactionText}
              placeholder="Descreva a interação"
              onChange={(event) => setInteractionText(event.target.value)}
            />
            <div className="prospect-quick-form-actions">
              <button className="btn btn-compact" type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Registrar'}
              </button>
              <button
                className="btn btn-secondary btn-compact"
                type="button"
                onClick={() => setShowInteraction(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="prospect-card-actions">
            <button
              className="btn btn-secondary btn-compact"
              type="button"
              onClick={() => setShowInteraction(true)}
            >
              + Interação
            </button>
            {nextStatus ? (
              <button
                className="btn btn-compact"
                type="button"
                onClick={() => onAdvance(prospect, nextStatus)}
              >
                Avançar → {nextStatus}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {!isTerminal && !showInteraction ? (
        <Select
          className="prospect-card-status-select"
          aria-label={`Mover "${prospect.name}" para outra etapa`}
          value={prospect.status}
          onChange={(event) => onAdvance(prospect, event.target.value)}
        >
          {STATUS_LABELS.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </Select>
      ) : null}
    </article>
  );
}

export function ProspectKanbanPage() {
  const { prospects, deadlines, saveProspect, addInteracao, addFlash } = useAppState();
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [dragOverKey, setDragOverKey] = useState('');

  const responsibleOptions = useMemo(
    () => [...new Set(prospects.map((item) => item.responsibleName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [prospects],
  );

  const filtered = useMemo(
    () =>
      prospects.filter((prospect) => {
        if (responsibleFilter && prospect.responsibleName !== responsibleFilter) {
          return false;
        }
        if (!search) return true;
        const haystack = buildSearchText([
          prospect.name,
          prospect.email,
          prospect.phone,
          prospect.demandType,
          prospect.responsibleName,
        ]);
        return haystack.includes(normalizeText(search));
      }),
    [prospects, responsibleFilter, search],
  );

  const metrics = useMemo(() => {
    const total = prospects.length;
    const novosMes = prospects.filter((item) => isThisMonth(item.createdAt)).length;
    const convertidos = prospects.filter((item) => item.status === 'Convertido').length;
    const perdidos = prospects.filter((item) => item.status === 'Perdido').length;
    const taxa = total ? Math.round((convertidos / total) * 100) : 0;
    return { total, novosMes, convertidos, perdidos, taxa };
  }, [prospects]);

  const byColumn = PROSPECT_STATUS_COLUMNS.reduce((acc, column) => {
    acc[column.label] = filtered.filter((item) => item.status === column.label);
    return acc;
  }, {});

  function handleDragStart(event, id) {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }

  function handleDragEnd() {
    setDraggingId('');
    setDragOverKey('');
  }

  function handleDragOver(event, key) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOverKey !== key) setDragOverKey(key);
  }

  async function handleDrop(event, label) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId('');
    setDragOverKey('');
    const prospect = prospects.find((item) => item.id === id);
    if (!prospect || prospect.status === label) return;
    const saved = await saveProspect({ ...prospect, status: label });
    if (saved) {
      addFlash(`Prospect movido para ${label}.`, 'info');
    }
  }

  async function advanceProspect(prospect, nextStatus) {
    const saved = await saveProspect({ ...prospect, status: nextStatus });
    if (saved) {
      addFlash(`Prospect movido para ${nextStatus}.`, 'info');
    }
  }

  return (
    <>
      <PageChrome label="Prospecção" />
      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Prospecção</p>
              <p className="mt-1 text-sm text-muted-foreground">Funil de captação de clientes</p>
            </div>
            <Button asChild>
              <Link to="/prospeccao/novo" data-tour="page-primary-action">
                <Plus className="size-4" />
                Novo prospect
              </Link>
            </Button>
          </div>
        </section>

        <Motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <Motion.div variants={pop}>
            <Card><CardContent className="py-4"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</span><strong className="mt-1 block text-2xl font-bold text-foreground">{metrics.total}</strong></CardContent></Card>
          </Motion.div>
          <Motion.div variants={pop}>
            <Card><CardContent className="py-4"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Novos no mês</span><strong className="mt-1 block text-2xl font-bold text-foreground">{metrics.novosMes}</strong></CardContent></Card>
          </Motion.div>
          <Motion.div variants={pop}>
            <Card><CardContent className="py-4"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Convertidos</span><strong className="mt-1 block text-2xl font-bold text-foreground">{metrics.convertidos}</strong></CardContent></Card>
          </Motion.div>
          <Motion.div variants={pop}>
            <Card><CardContent className="py-4"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Perdidos</span><strong className="mt-1 block text-2xl font-bold text-foreground">{metrics.perdidos}</strong></CardContent></Card>
          </Motion.div>
          <Motion.div variants={pop}>
            <Card><CardContent className="py-4"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Taxa conversão</span><strong className="mt-1 block text-2xl font-bold text-foreground">{metrics.taxa}%</strong></CardContent></Card>
          </Motion.div>
        </Motion.div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <div className="min-w-[180px] flex-1">
              <PageSearch
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, e-mail ou demanda"
              />
            </div>
            <div className="w-full sm:w-[220px]">
              <Select
                aria-label="Filtrar por responsável"
                value={responsibleFilter}
                onChange={(event) => setResponsibleFilter(event.target.value)}
              >
                <option value="">Responsável</option>
                {responsibleOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {prospects.length ? (
          <section className={`prospeccao-board${draggingId ? ' is-dragging' : ''}`} aria-label="Funil de prospecção">
            {PROSPECT_STATUS_COLUMNS.map((column) => (
              <section
                className={`prospect-column${dragOverKey === column.label ? ' is-drop-target' : ''}`}
                key={column.key}
                onDragEnter={(event) => handleDragOver(event, column.label)}
                onDragOver={(event) => handleDragOver(event, column.label)}
                onDrop={(event) => handleDrop(event, column.label)}
              >
                <div className="prospect-column-head">
                  <h2>{column.label}</h2>
                  <span className="prospect-column-count">{byColumn[column.label].length}</span>
                </div>
                <div className="prospect-column-list">
                  {byColumn[column.label].length ? (
                    byColumn[column.label].map((prospect) => (
                      <ProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        deadlines={deadlines}
                        isDragging={draggingId === prospect.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onAdvance={advanceProspect}
                        onAddInteraction={addInteracao}
                      />
                    ))
                  ) : (
                    <div className="prospect-column-empty">Nenhum prospect.</div>
                  )}
                </div>
              </section>
            ))}
          </section>
        ) : (
          <section className="surface section-card">
            <EmptyState
              title="Nenhum prospect cadastrado."
              copy="Cadastre um contato para iniciar o funil de prospecção."
              actions={<Link className="btn" to="/prospeccao/novo">Novo prospect</Link>}
            />
          </section>
        )}
      </div>
    </>
  );
}
