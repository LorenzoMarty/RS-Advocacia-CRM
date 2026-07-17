import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { FINANCE_CATEGORIES, FINANCE_TABS } from '../data';
import { api } from '../api';
import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch, StatusBadge } from '../layout';
import { lancamentosFromResponse } from '../mappers';
import { motion as Motion, pop, staggerContainer, staggerItem } from '../motion';
import { useAppState } from '../store';
import { formatDate, getStatusTone } from '../utils';
import { Select } from '../components/select';
import { EmptyState } from './common';
import { CategoryDonut, MetricValue, SortArrow } from './finance-charts';
import {
  DASHBOARD_EMPTY,
  PAGE_SIZE,
  TAB_TO_PARAMS,
  dashboardFromApi,
  formatCurrency,
  sortToOrdenar,
  todayIso,
} from './financeiro-utils';

export function FinanceiroPage() {
  const { marcarLancamentoPago, cancelarLancamento, deleteLancamento, addFlash } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [tab, setTab] = useState('receber');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState({ field: 'dueDate', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState(DASHBOARD_EMPTY);
  const [dashboardError, setDashboardError] = useState(false);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
  const [rows, setRows] = useState([]);
  const [rowsMeta, setRowsMeta] = useState({ total: 0, numPages: 1 });
  const [rowsReloadKey, setRowsReloadKey] = useState(0);
  const tabRefs = useRef({});

  // Tabela agora busca do endpoint já paginado do backend (financeiro/views.py
  // listar_lancamentos, Django Paginator) em vez de filtrar/paginar client-side
  // sobre o array inteiro do store. Debounce só na busca por texto.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = {
        ...TAB_TO_PARAMS[tab],
        categoria: categoryFilter,
        q: search,
        ordenar: sortToOrdenar(sort),
        page,
        page_size: PAGE_SIZE,
      };
      api.listLancamentos(new URLSearchParams(
        Object.entries(params).filter(([, value]) => value != null && value !== ''),
      ).toString())
        .then((response) => {
          if (!active) return;
          const dados = response?.dados || response;
          setRows(lancamentosFromResponse(response));
          setRowsMeta({ total: dados.total ?? 0, numPages: dados.num_pages ?? 1 });
        })
        .catch((error) => {
          if (!active) return;
          addFlash(
            error instanceof Error ? error.message : 'Não foi possível carregar os lançamentos.',
            'error',
          );
        });
    }, search ? 300 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, categoryFilter, search, sort, page, rowsReloadKey, addFlash]);

  // Recarrega o dashboard e a tabela após qualquer mutação (pagar/cancelar/excluir/salvar).
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
  }, [dashboardReloadKey, addFlash]);

  const categoryOptions = useMemo(() => {
    if (tab === 'despesas') return FINANCE_CATEGORIES.despesa;
    if (tab === 'cancelados') return [...FINANCE_CATEGORIES.receita, ...FINANCE_CATEGORIES.despesa];
    return FINANCE_CATEGORIES.receita;
  }, [tab]);

  const totalPages = Math.max(1, rowsMeta.numPages);
  const safePage = Math.min(page, totalPages);
  const pageRows = rows;

  function reloadRows() {
    setRowsReloadKey((key) => key + 1);
    setDashboardReloadKey((key) => key + 1);
  }

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
      tone: 'default',
    });
    if (!ok) return;
    const saved = await marcarLancamentoPago(lancamento.id, todayIso());
    if (saved) reloadRows();
  }

  async function handleCancel(lancamento) {
    const ok = await confirm({
      title: 'Cancelar lançamento?',
      message: `"${lancamento.description}" será cancelado.`,
      confirmLabel: 'Sim, cancelar',
      cancelLabel: 'Voltar',
      tone: 'danger',
    });
    if (!ok) return;
    const saved = await cancelarLancamento(lancamento.id);
    if (saved) reloadRows();
  }

  async function handleDelete(lancamento) {
    const ok = await confirm({
      title: 'Tem certeza?',
      message: `"${lancamento.description}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });
    if (!ok) return;
    const wasDeleted = await deleteLancamento(lancamento.id);
    if (wasDeleted) reloadRows();
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Financeiro" />
      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Financeiro</p>
              <p className="mt-1 text-sm text-muted-foreground">Receitas, despesas e fluxo do escritório</p>
            </div>
            <Button asChild>
              <Link to="/financeiro/novo" data-tour="page-primary-action">
                <Plus className="size-4" />
                Novo lançamento
              </Link>
            </Button>
          </div>
        </section>

        <Card>
          <CardContent className="grid gap-4 py-5">
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
              <Motion.article className="metric" variants={pop} whileHover={{ y: -2 }}><span>Recebido no mês</span><MetricValue value={dashboard.recebidoMes} /></Motion.article>
              <Motion.article className="metric" variants={pop} whileHover={{ y: -2 }}><span>A receber</span><MetricValue value={dashboard.pendente} /></Motion.article>
              <Motion.article className={`metric${dashboard.atrasado > 0 ? ' metric-danger' : ''}`} variants={pop} whileHover={{ y: -2 }}><span>Atrasado</span><MetricValue value={dashboard.atrasado} /></Motion.article>
              <Motion.article className="metric" variants={pop} whileHover={{ y: -2 }}><span>Despesas no mês</span><MetricValue value={dashboard.despesasMes} /></Motion.article>
              <Motion.article className="metric" variants={pop} whileHover={{ y: -2 }}><span>Saldo estimado</span><MetricValue value={dashboard.saldo} /></Motion.article>
            </Motion.div>

            <div className="financeiro-charts">
              <CategoryDonut title="Receita por categoria" data={dashboard.receitaPorCategoria} onSelect={(category) => focusCategory('receita', category)} />
              <CategoryDonut title="Despesa por categoria" data={dashboard.despesaPorCategoria} onSelect={(category) => focusCategory('despesa', category)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3.5 py-5">
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
                  {tab === item.key ? (
                    <Motion.span className="financeiro-tab-indicator" layoutId="financeiro-tab-indicator" />
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[180px] flex-1">
                <PageSearch value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar lançamento" />
              </div>
              <div className="w-full sm:w-[220px]">
                <Select
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}
