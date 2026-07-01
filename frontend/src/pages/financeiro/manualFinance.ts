export type CostKind = 'fixed' | 'recurring';

export interface ManualExpense {
  id: string;
  month: string;
  date: string;
  category: string;
  description: string;
  value: number;
  vendor: string;
  kind: CostKind;
  recurrence: string;
  notes?: string | null;
}

export interface DirectSale {
  id: string;
  month: string;
  date: string;
  description: string;
  customer: string;
  value: number;
  contract_total: number;
  source: string;
  matched: boolean;
  asaas_match?: {
    payment_id?: string;
    status?: string;
    due_date?: string;
    payment_date?: string;
  } | null;
}

export interface ManualFinancial {
  expenses: ManualExpense[];
  fixed_costs: ManualExpense[];
  recurring_costs: ManualExpense[];
  direct_sales: DirectSale[];
  monthly: {
    month: string;
    expenses: number;
    fixed_costs: number;
    recurring_costs: number;
    manual_revenue: number;
    unmatched_direct_sales: number;
  }[];
  summary: {
    expenses_total: number;
    fixed_expenses_total: number;
    recurring_expenses_total: number;
    variable_expenses_total: number;
    direct_sales_total: number;
    unmatched_direct_sales_total: number;
    matched_direct_sales_count: number;
    direct_sales_count: number;
  };
}

export const currency = (value: number, digits = 0) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: digits,
  }).format(value);

export function monthLabel(month: string) {
  const [, m] = month.split('-');
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return labels[Number(m) - 1] ?? month;
}

export function formatDate(iso?: string) {
  if (!iso) return '-';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
}

export function localCostKey(kind: CostKind) {
  return `4core.finance.${kind}.manual_entries`;
}

export const LOCAL_DIRECT_SALES_KEY = '4core.finance.direct_sales.manual_entries';
export const DELETED_DIRECT_SALES_KEY = '4core.finance.direct_sales.deleted_ids';

export function readLocalDirectSales(): DirectSale[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DIRECT_SALES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function readDeletedDirectSaleIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DELETED_DIRECT_SALES_KEY) || '[]');
  } catch {
    return [];
  }
}