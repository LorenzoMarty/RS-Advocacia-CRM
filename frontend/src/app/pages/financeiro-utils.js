export const PAGE_SIZE = 10;

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

export function todayIso() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export const DASHBOARD_EMPTY = {
  recebidoMes: 0, despesasMes: 0, pendente: 0, atrasado: 0, saldo: 0,
  receitaPorCategoria: [], despesaPorCategoria: [],
};

export function dashboardFromApi(data) {
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

// tab (UI) -> {tipo, status} aceitos por GET /api/financeiro/ (financeiro/views.py:91-121).
export const TAB_TO_PARAMS = {
  despesas: { tipo: 'despesa' },
  pagas: { tipo: 'receita', status: 'Pago' },
  receber: { tipo: 'receita', status: 'Pendente' },
  cancelados: { status: 'Cancelado' },
};

// sort local (field/dir) -> `ordenar` aceito pelo backend (financeiro/views.py:31-38).
const SORT_FIELD_TO_ORDENAR = { value: 'valor', description: 'descricao', dueDate: 'data_vencimento' };

export function sortToOrdenar(sort) {
  const campo = SORT_FIELD_TO_ORDENAR[sort.field] || 'data_vencimento';
  return sort.dir === 'desc' ? `-${campo}` : campo;
}
