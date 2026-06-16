import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { colorAt } from '../components/audit/chartTheme';
import {
  FINANCE_CATEGORIES,
  FINANCE_TABS,
  FINANCE_TYPE_OPTIONS,
} from '../data';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { AnimatePresence, motion as Motion, pop, staggerContainer, staggerItem } from '../motion';
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

function CategoryDonut({ title, data }) {
  const total = data.reduce((sum, item) => sum + Number(item.total || item.value || 0), 0);
  if (!data.length || total <= 0) {
    return (
      <div className="finance-chart">
        <h3>{title}</h3>
        <p className="section-note">Sem dados.</p>
      </div>
    );
  }
  const chartData = data.map((item) => ({ name: item.categoria || item.name, value: Number(item.total || item.value || 0) }));
  return (
    <div className="finance-chart">
      <h3>{title}</h3>
      <div className="finance-donut">
        <div style={{ height: 160, width: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="92%" stroke="none" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.name} fill={colorAt(index)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="finance-legend">
          {chartData.map((entry, index) => (
            <li key={entry.name}>
              <span className="finance-dot" style={{ background: colorAt(index) }} />
              <span className="finance-legend-label">{entry.name}</span>
              <span className="finance-legend-value">{formatCurrency(entry.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FinanceiroPage() {
  const { lancamentos, marcarLancamentoPago, cancelarLancamento, deleteLancamento } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [tab, setTab] = useState('receber');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState({ field: 'dueDate', dir: 'desc' });
  const [page, setPage] = useState(1);

  const dashboard = useMemo(() => {
    const today = todayIso();
    const active = lancamentos.filter((item) => item.status !== 'Cancelado');
    const receitas = active.filter((item) => item.type === 'receita');
    const despesas = active.filter((item) => item.type === 'despesa');
    const isThisMonth = (value) => {
      if (!value) return false;
      const d = new Date(value);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const sum = (list) => list.reduce((acc, item) => acc + Number(item.value || 0), 0);

    const recebidoMes = sum(receitas.filter((item) => item.status === 'Pago' && isThisMonth(item.paymentDate)));
    const despesasMes = sum(despesas.filter((item) => item.status === 'Pago' && isThisMonth(item.paymentDate)));
    const pendente = sum(receitas.filter((item) => item.status === 'Pendente'));
    const atrasado = sum(receitas.filter((item) => item.status === 'Pendente' && item.dueDate && item.dueDate < today));
    const saldo = sum(receitas) - sum(despesas);

    const byCategory = (list) => {
      const map = new Map();
      list.forEach((item) => {
        map.set(item.category, (map.get(item.category) || 0) + Number(item.value || 0));
      });
      return [...map.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
    };

    return {
      recebidoMes, despesasMes, pendente, atrasado, saldo,
      receitaPorCategoria: byCategory(receitas),
      despesaPorCategoria: byCategory(despesas),
    };
  }, [lancamentos]);

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
              <Link className="btn" to="/financeiro/novo">Novo lançamento</Link>
            </div>

            <Motion.div
              className="financeiro-metrics"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <Motion.article className="metric" variants={pop}><span>Recebido no mês</span><strong>{formatCurrency(dashboard.recebidoMes)}</strong></Motion.article>
              <Motion.article className="metric" variants={pop}><span>A receber</span><strong>{formatCurrency(dashboard.pendente)}</strong></Motion.article>
              <Motion.article className="metric metric-danger" variants={pop}><span>Atrasado</span><strong>{formatCurrency(dashboard.atrasado)}</strong></Motion.article>
              <Motion.article className="metric" variants={pop}><span>Despesas no mês</span><strong>{formatCurrency(dashboard.despesasMes)}</strong></Motion.article>
              <Motion.article className="metric" variants={pop}><span>Saldo estimado</span><strong>{formatCurrency(dashboard.saldo)}</strong></Motion.article>
            </Motion.div>

            <div className="financeiro-charts">
              <CategoryDonut title="Receita por categoria" data={dashboard.receitaPorCategoria} />
              <CategoryDonut title="Despesa por categoria" data={dashboard.despesaPorCategoria} />
            </div>
          </div>

          <div className="financeiro-panel">
            <div className="financeiro-tabs" role="tablist">
              {FINANCE_TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  className={`financeiro-tab${tab === item.key ? ' is-active' : ''}`}
                  onClick={() => changeTab(item.key)}
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

    const saved = await saveLancamento({
      id: lancamento?.id,
      ...form,
      description: form.description.trim(),
      value: Number(form.value),
      paymentDate: form.status === 'Pago' ? form.paymentDate : '',
    });
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
              <button className="btn" type="submit">{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to="/financeiro">Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
