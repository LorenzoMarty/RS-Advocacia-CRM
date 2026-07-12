import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts';

import { colorAt } from '../components/audit/chartTheme';
import {
  FINANCE_CATEGORIES,
  FINANCE_TABS,
  FINANCE_TYPE_OPTIONS,
} from '../data';
import { api } from '../api';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { AnimatePresence, motion as Motion, pop, prefersReducedMotion, staggerContainer, staggerItem } from '../motion';
import { useAppState } from '../store';
import { buildSearchText, formatDate, getStatusTone, normalizeText } from '../utils';
import { Select } from '../components/select';
import { ComboField, EmptyState, Field, NotFoundState } from './common';

const PAGE_SIZE = 10;

function SortArrow({ active, dir }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {active ? (
        <Motion.svg
          key={dir}
          className="financeiro-sort-arrow"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          initial={{ opacity: 0, y: dir === 'asc' ? 3 : -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: dir === 'asc' ? -3 : 3 }}
          transition={{ duration: 0.14 }}
        >
          {dir === 'asc' ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
        </Motion.svg>
      ) : null}
    </AnimatePresence>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

// Conta de um valor anterior até o alvo (easeOutCubic). Colapsa sob reduced-motion.
function useCountUp(target, duration = 0.7) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      fromRef.current = target;
      return undefined;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function MetricValue({ value }) {
  return <strong>{formatCurrency(useCountUp(value))}</strong>;
}

function todayIso() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function tabFilter(lancamento, tab) {
  if (tab === 'despesas') {
    return lancamento.type === 'despesa';
  }
  if (tab === 'pagas') {
    return lancamento.type === 'receita' && lancamento.status === 'Pago';
  }
  // receber: receitas não pagas (pendente/atrasado), exclui canceladas
  return lancamento.type === 'receita' && lancamento.status === 'Pendente';
}

// Setor destacado (cresce + halo) renderizado para a fatia em hover/foco.
function ActiveSlice(props) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 11}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.45}
      />
    </g>
  );
}

function CategoryDonut({ title, data, onSelect }) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const total = data.reduce((sum, item) => sum + Number(item.total || item.value || 0), 0);
  const animatedTotal = useCountUp(total);

  if (!data.length || total <= 0) {
    return (
      <div className="finance-chart">
        <h3>{title}</h3>
        <p className="section-note">Sem dados.</p>
      </div>
    );
  }

  const chartData = data.map((item) => ({ name: item.categoria || item.name, value: Number(item.total || item.value || 0) }));
  const active = activeIndex >= 0 ? chartData[activeIndex] : null;
  const centerValue = active ? active.value : animatedTotal;
  const centerLabel = active ? active.name : 'Total';
  const percent = active ? Math.round((active.value / total) * 100) : 100;

  return (
    <div className="finance-chart">
      <h3>{title}</h3>
      <div className="finance-donut">
        <div className="finance-donut-chart" onMouseLeave={() => setActiveIndex(-1)}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="90%"
                paddingAngle={chartData.length > 1 ? 2 : 0}
                stroke="none"
                activeIndex={activeIndex >= 0 ? activeIndex : undefined}
                activeShape={ActiveSlice}
                isAnimationActive={!prefersReducedMotion()}
                animationDuration={520}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onClick={(_, index) => onSelect?.(chartData[index].name)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={colorAt(index)}
                    style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="finance-donut-center">
            <span className="finance-donut-pct">{percent}%</span>
            <strong>{formatCurrency(centerValue)}</strong>
            <span className="finance-donut-label">{centerLabel}</span>
          </div>
        </div>
        <ul className="finance-legend">
          {chartData.map((entry, index) => (
            <li
              key={entry.name}
              className={`finance-legend-item${activeIndex === index ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <button
                type="button"
                className="finance-legend-btn"
                onClick={() => onSelect?.(entry.name)}
                title={onSelect ? `Filtrar por ${entry.name}` : undefined}
              >
                <span className="finance-dot" style={{ background: colorAt(index) }} />
                <span className="finance-legend-label">{entry.name}</span>
                <span className="finance-legend-value">{formatCurrency(entry.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const DASHBOARD_EMPTY = {
  recebidoMes: 0, despesasMes: 0, pendente: 0, atrasado: 0, saldo: 0,
  receitaPorCategoria: [], despesaPorCategoria: [],
};

function dashboardFromApi(data) {
  const toCategoryList = (list) =>
    (list || []).map(({ categoria, total }) => ({ name: categoria, value: Number(total) || 0 }));
  return {
    recebidoMes: Number(data.recebido_mes) || 0,
    despesasMes: Number(data.despesas_mes) || 0,
    pendente: Number(data.pendente) || 0,
    atrasado: Number(data.atrasado) || 0,
    saldo: Number(data.saldo_estimado) || 0,
    receitaPorCategoria: toCategoryList(data.receita_por_categoria),
    despesaPorCategoria: toCategoryList(data.despesa_por_categoria),
  };
}

export function FinanceiroPage() {
  const { lancamentos, marcarLancamentoPago, cancelarLancamento, deleteLancamento, addFlash } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [tab, setTab] = useState('receber');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState({ field: 'dueDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState(DASHBOARD_EMPTY);
  const [dashboardError, setDashboardError] = useState(false);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
  const tabRefs = useRef({});

  // Recarrega o dashboard do servidor após qualquer mutação (store atualiza lancamentos).
  useEffect(() => {
    let active = true;
    api
      .dashboardFinanceiro()
      .then((data) => {
        if (!active) return;
        setDashboard(dashboardFromApi(data.dados ?? data));
        setDashboardError(false);
      })
      .catch((error) => {
        if (!active) return;
        setDashboardError(true);
        addFlash(
          error instanceof Error ? error.message : 'Não foi possível carregar as métricas financeiras.',
          'error',
        );
      });
    return () => {
      active = false;
    };
  }, [lancamentos, dashboardReloadKey, addFlash]);

  const categoryOptions = useMemo(() => {
    const type = tab === 'despesas' ? 'despesa' : 'receita';
    const existing = lancamentos.filter((item) => item.type === type).map((item) => item.category);
    return [...new Set([...FINANCE_CATEGORIES[type], ...existing].filter(Boolean))];
  }, [tab, lancamentos]);

  const rows = useMemo(() => {
    let list = lancamentos.filter((item) => tabFilter(item, tab));
    if (categoryFilter) {
      list = list.filter((item) => item.category === categoryFilter);
    }
    if (search) {
      list = list.filter((item) =>
        buildSearchText([item.description, item.category, item.clientName, item.caseNumber]).includes(normalizeText(search)),
      );
    }
    list = [...list].sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.field === 'value') return (a.value - b.value) * dir;
      if (sort.field === 'description') return a.description.localeCompare(b.description, 'pt-BR') * dir;
      return String(a.dueDate).localeCompare(String(b.dueDate)) * dir;
    });
    return list;
  }, [lancamentos, tab, categoryFilter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeTab(nextTab) {
    setTab(nextTab);
    setCategoryFilter('');
    setPage(1);
  }

  function handleTabKeyDown(event) {
    const currentIndex = FINANCE_TABS.findIndex((item) => item.key === tab);
    let nextIndex = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % FINANCE_TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + FINANCE_TABS.length) % FINANCE_TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = FINANCE_TABS.length - 1;
    else return;

    event.preventDefault();
    const nextTab = FINANCE_TABS[nextIndex];
    changeTab(nextTab.key);
    tabRefs.current[nextTab.key]?.focus();
  }

  // Clique numa fatia/legenda do donut foca a tabela na categoria.
  function focusCategory(type, category) {
    setTab(type === 'despesa' ? 'despesas' : 'receber');
    setCategoryFilter(category);
    setPage(1);
  }

  function toggleSort(field) {
    setSort((current) => ({
      field,
      dir: current.field === field && current.dir === 'desc' ? 'asc' : 'desc',
    }));
  }

  async function handleMarkPaid(lancamento) {
    const ok = await confirm({
      title: 'Marcar como pago?',
      message: `"${lancamento.description}" será marcado como pago hoje.`,
      confirmLabel: 'Marcar pago',
    });
    if (!ok) return;
    await marcarLancamentoPago(lancamento.id, todayIso());
  }

  async function handleCancel(lancamento) {
    const ok = await confirm({
      title: 'Cancelar lançamento?',
      message: `"${lancamento.description}" será cancelado.`,
      confirmLabel: 'Cancelar lançamento',
      tone: 'danger',
    });
    if (!ok) return;
    await cancelarLancamento(lancamento.id);
  }

  async function handleDelete(lancamento) {
    const ok = await confirm({
      title: 'Tem certeza?',
      message: `"${lancamento.description}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteLancamento(lancamento.id);
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Financeiro" />
      <div className="financeiro-page">
        <section className="surface financeiro-shell">
          <div className="financeiro-intro">
            <div className="section-head">
              <div>
                <h1 className="intro-title">Financeiro</h1>
                <p className="section-note">Receitas, despesas e fluxo do escritório</p>
              </div>
              <Link className="btn" to="/financeiro/novo" data-tour="page-primary-action">Novo lançamento</Link>
            </div>

            {dashboardError ? (
              <div className="empty" role="alert">
                <strong>Não foi possível carregar as métricas.</strong>
                <p>
                  Os valores abaixo podem estar desatualizados.{' '}
                  <button type="button" className="action-link" onClick={() => setDashboardReloadKey((key) => key + 1)}>
                    Tentar novamente
                  </button>
                </p>
              </div>
            ) : null}

            <Motion.div
              className="financeiro-metrics"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <Motion.article className="metric" variants={pop} whileHover={{ y: -3 }}><span>Recebido no mês</span><MetricValue value={dashboard.recebidoMes} /></Motion.article>
              <Motion.article className="metric" variants={pop} whileHover={{ y: -3 }}><span>A receber</span><MetricValue value={dashboard.pendente} /></Motion.article>
              <Motion.article className="metric metric-danger" variants={pop} whileHover={{ y: -3 }}><span>Atrasado</span><MetricValue value={dashboard.atrasado} /></Motion.article>
              <Motion.article className="metric" variants={pop} whileHover={{ y: -3 }}><span>Despesas no mês</span><MetricValue value={dashboard.despesasMes} /></Motion.article>
              <Motion.article className="metric" variants={pop} whileHover={{ y: -3 }}><span>Saldo estimado</span><MetricValue value={dashboard.saldo} /></Motion.article>
            </Motion.div>

            <div className="financeiro-charts">
              <CategoryDonut title="Receita por categoria" data={dashboard.receitaPorCategoria} onSelect={(category) => focusCategory('receita', category)} />
              <CategoryDonut title="Despesa por categoria" data={dashboard.despesaPorCategoria} onSelect={(category) => focusCategory('despesa', category)} />
            </div>
          </div>

          <div className="financeiro-panel">
            <div className="financeiro-tabs" role="tablist" aria-label="Filtrar lançamentos por status">
              {FINANCE_TABS.map((item) => (
                <button
                  key={item.key}
                  ref={(node) => { tabRefs.current[item.key] = node; }}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  tabIndex={tab === item.key ? 0 : -1}
                  className={`financeiro-tab${tab === item.key ? ' is-active' : ''}`}
                  onClick={() => changeTab(item.key)}
                  onKeyDown={handleTabKeyDown}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="financeiro-toolbar">
              <PageSearch value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar lançamento" />
              <Select
                className="filter-select"
                aria-label="Filtrar por categoria"
                value={categoryFilter}
                onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}
              >
                <option value="">Categoria</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>

            {pageRows.length ? (
              <>
                <div className="financeiro-table" role="table">
                  <div className="financeiro-row financeiro-row-head" role="row">
                    <button type="button" className={`financeiro-th is-sortable${sort.field === 'description' ? ' is-sorted' : ''}`} onClick={() => toggleSort('description')}>
                      Descrição <SortArrow active={sort.field === 'description'} dir={sort.dir} />
                    </button>
                    <span className="financeiro-th">Categoria</span>
                    <button type="button" className={`financeiro-th is-sortable${sort.field === 'value' ? ' is-sorted' : ''}`} onClick={() => toggleSort('value')}>
                      Valor <SortArrow active={sort.field === 'value'} dir={sort.dir} />
                    </button>
                    <button type="button" className={`financeiro-th is-sortable${sort.field === 'dueDate' ? ' is-sorted' : ''}`} onClick={() => toggleSort('dueDate')}>
                      Vencimento <SortArrow active={sort.field === 'dueDate'} dir={sort.dir} />
                    </button>
                    <span className="financeiro-th">Status</span>
                    <span className="financeiro-th">Ações</span>
                  </div>
                  <Motion.div
                    key={`${tab}-${safePage}-${sort.field}-${sort.dir}`}
                    className="financeiro-rows"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                  {pageRows.map((item) => (
                    <Motion.div className="financeiro-row" role="row" key={item.id} variants={staggerItem}>
                      <span className="financeiro-cell" data-label="Descrição">
                        {item.description}
                        {item.clientName ? <small>{item.clientName}</small> : null}
                      </span>
                      <span className="financeiro-cell" data-label="Categoria">{item.category}</span>
                      <span className="financeiro-cell" data-label="Valor">{formatCurrency(item.value)}</span>
                      <span className="financeiro-cell" data-label="Vencimento">{item.dueDate ? formatDate(item.dueDate) : '-'}</span>
                      <span className="financeiro-cell" data-label="Status">
                        <StatusBadge tone={getStatusTone(item.displayStatus, item.status === 'Pago')}>{item.displayStatus}</StatusBadge>
                      </span>
                      <span className="financeiro-cell financeiro-actions" data-label="Ações">
                        <Link className="btn btn-mini btn-secondary" to={`/financeiro/${item.id}/editar`}>Editar</Link>
                        {item.status === 'Pendente' ? (
                          <button className="btn btn-mini" type="button" onClick={() => handleMarkPaid(item)}>Pagar</button>
                        ) : null}
                        {item.status !== 'Cancelado' ? (
                          <button className="btn btn-mini btn-secondary" type="button" onClick={() => handleCancel(item)}>Cancelar</button>
                        ) : null}
                        <button className="btn btn-mini btn-danger" type="button" onClick={() => handleDelete(item)}>Excluir</button>
                      </span>
                    </Motion.div>
                  ))}
                  </Motion.div>
                </div>

                {totalPages > 1 ? (
                  <div className="financeiro-pagination">
                    <button className="btn btn-secondary btn-mini" type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Anterior</button>
                    <span>Página {safePage} de {totalPages}</span>
                    <button className="btn btn-secondary btn-mini" type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>Próxima</button>
                  </div>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="Nenhum lançamento."
                copy="Ajuste os filtros ou cadastre um novo lançamento."
                actions={<Link className="btn" to="/financeiro/novo">Novo lançamento</Link>}
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export function LancamentoFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.lancamentoId);
  const { lancamentos, clients, processes, saveLancamento } = useAppState();
  const lancamento = lancamentos.find((item) => item.id === params.lancamentoId) || null;

  const [form, setForm] = useState(() => ({
    description: lancamento?.description || '',
    type: lancamento?.type || 'receita',
    category: lancamento?.category || '',
    value: lancamento?.value != null ? String(lancamento.value) : '',
    dueDate: lancamento?.dueDate || todayIso(),
    paymentDate: lancamento?.paymentDate || '',
    status: lancamento?.status || 'Pendente',
    clientId: lancamento?.clientId || '',
    caseId: lancamento?.caseId || '',
    notes: lancamento?.notes || '',
  }));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isEditing && !lancamento) {
    return <NotFoundState title="Lançamento não encontrado." />;
  }

  const categorySeed = form.type === 'despesa' ? FINANCE_CATEGORIES.despesa : FINANCE_CATEGORIES.receita;
  const categories = [...new Set([
    ...categorySeed,
    ...lancamentos.filter((item) => item.type === form.type).map((item) => item.category),
  ].filter(Boolean))];

  // Processos disponíveis dependem do cliente selecionado (sem cliente = todos).
  const availableCases = processes.filter(
    (process) => !form.clientId || process.clientId === form.clientId,
  );

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'type') {
        next.category = '';
      }
      if (field === 'status' && value !== 'Pago') {
        next.paymentDate = '';
      }
      // Troca de cliente invalida o processo que não pertence a ele.
      if (field === 'clientId') {
        const stillValid = processes.some(
          (process) => process.id === current.caseId && process.clientId === value,
        );
        if (!stillValid) {
          next.caseId = '';
        }
      }
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.description.trim()) nextErrors.description = 'Informe a descrição.';
    if (!form.category) nextErrors.category = 'Selecione a categoria.';
    if (form.value === '' || Number(form.value) < 0) nextErrors.value = 'Informe um valor maior ou igual a zero.';
    if (form.status === 'Pago' && !form.paymentDate) nextErrors.paymentDate = 'Informe a data de pagamento.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    const saved = await saveLancamento({
      id: lancamento?.id,
      ...form,
      description: form.description.trim(),
      value: Number(form.value),
      paymentDate: form.status === 'Pago' ? form.paymentDate : '',
    });
    setIsSubmitting(false);
    if (!saved) return;
    navigate('/financeiro', { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar lançamento' : 'Novo lançamento'} />
      <div className="lancamento-form-page">
        <section className="surface section-card">
          <div className="intro-grid">
            <Link className="intro-link" to="/financeiro">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              Voltar para financeiro
            </Link>
            <h1 className="intro-title">{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</h1>
          </div>

          <form className="lancamento-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <Field id="lanc-description" label="Descrição" className="span-2" error={errors.description}>
                <input id="lanc-description" value={form.description} onChange={(event) => update('description', event.target.value)} />
              </Field>
              <Field id="lanc-type" label="Tipo">
                <Select id="lanc-type" value={form.type} onChange={(event) => update('type', event.target.value)}>
                  {FINANCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              <Field id="lanc-category" label="Categoria" error={errors.category}>
                <ComboField
                  id="lanc-category"
                  value={form.category}
                  options={categories}
                  selectPlaceholder="Selecione"
                  customLabel="+ Digitar nova categoria..."
                  customPlaceholder="Nome da categoria"
                  onChange={(value) => update('category', value)}
                />
              </Field>
              <Field id="lanc-value" label="Valor (R$)" error={errors.value}>
                <input id="lanc-value" type="number" min="0" step="0.01" value={form.value} onChange={(event) => update('value', event.target.value)} />
              </Field>
              <Field id="lanc-due" label="Vencimento">
                <input id="lanc-due" type="date" value={form.dueDate} onChange={(event) => update('dueDate', event.target.value)} />
              </Field>
              {form.status === 'Pago' ? (
                <Field id="lanc-payment" label="Data de pagamento" error={errors.paymentDate}>
                  <input id="lanc-payment" type="date" value={form.paymentDate} onChange={(event) => update('paymentDate', event.target.value)} />
                </Field>
              ) : null}
              <Field id="lanc-client" label="Cliente (opcional)">
                <Select id="lanc-client" value={form.clientId} onChange={(event) => update('clientId', event.target.value)}>
                  <option value="">Nenhum</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </Select>
              </Field>
              <Field id="lanc-case" label="Processo (opcional)">
                <Select id="lanc-case" value={form.caseId} onChange={(event) => update('caseId', event.target.value)}>
                  <option value="">
                    {form.clientId && !availableCases.length ? 'Nenhum processo deste cliente' : 'Nenhum'}
                  </option>
                  {availableCases.map((process) => (
                    <option key={process.id} value={process.id}>{process.number}</option>
                  ))}
                </Select>
              </Field>
              <Field id="lanc-notes" label="Observações" className="span-2">
                <textarea id="lanc-notes" rows="3" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
              </Field>
            </div>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar'}
              </button>
              <Link className="btn btn-secondary" to="/financeiro">Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
