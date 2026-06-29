import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { api } from '../../services/api';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { currency, monthLabel, type ManualFinancial } from './manualFinance';

export type AsaasData = {
  received_value: number;
  pending_value: number;
  overdue_value: number;
  overdue_count: number;
  pending_count: number;
  received_count: number;
  customers_total: number;
  recurring_value: number;
  recurring_count: number;
  billing_types: { type: string; value: number }[];
  daily_status: { date: string; received: number; confirmed: number; pending: number; overdue: number }[];
  payments: {
    id: string; customer: string; description: string;
    value: number; status: string; due_date: string;
  }[];
  subscriptions?: {
    id: string; customer: string; value: number;
    status: string; nextDueDate: string; description: string;
  }[];
  manual_financial?: ManualFinancial;
  summary?: {
    total_received?: number; total_pending?: number; total_overdue?: number; mrr?: number;
    expenses_total?: number; direct_sales_total?: number;
  };
};

export const money = (value: number) => currency(value);

const PERIODS = [
  { label: '90d', value: 90 },
  { label: '180d', value: 180 },
  { label: '365d', value: 365 },
];

let _sharedData: AsaasData | null = null;
let _sharedLoading = true;

export function useFinanceiroData() {
  return { data: _sharedData, loading: _sharedLoading };
}

export function FinanceiroLayout() {
  const { pathname } = useLocation();
  const isIndex = pathname === '/financeiro';

  return isIndex ? <FinanceiroCockpit /> : <Outlet />;
}

function chartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border-strong)', color: 'var(--erp-text)' }}>
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((item: any) => (
        <p key={item.name} style={{ color: item.color }} className="font-medium">{item.name}: {currency(Number(item.value), 2)}</p>
      ))}
    </div>
  );
}

function FinanceiroCockpit() {
  const [data, setData] = useState<AsaasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(180);

  const load = useCallback((forceRefresh = false) => {
    setLoading(true);
    setError(null);
    api.get<AsaasData>(`/financial/overview?days=${days}${forceRefresh ? '&refresh=true' : ''}`)
      .then(({ data: response }) => {
        setData(response);
        _sharedData = response;
        _sharedLoading = false;
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Falha ao conectar dados financeiros'))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(false); }, [load]);

  const manual = data?.manual_financial;
  const received = data?.received_value ?? 0;
  const pending = data?.pending_value ?? 0;
  const directSales = manual?.summary.unmatched_direct_sales_total ?? 0;
  const fixedCosts = manual?.summary.fixed_expenses_total ?? 0;
  const recurringCosts = manual?.summary.recurring_expenses_total ?? 0;
  const totalCosts = fixedCosts + recurringCosts;
  const net = received + directSales - totalCosts;
  const margin = received + directSales > 0 ? (net / (received + directSales)) * 100 : 0;

  const monthly = new Map<string, { month: string; asaas: number; direct: number; fixed: number; recurring: number }>();
  (data?.payments ?? []).forEach((payment) => {
    const month = (payment.due_date ?? '').slice(0, 7);
    if (!month) return;
    const row = monthly.get(month) ?? { month, asaas: 0, direct: 0, fixed: 0, recurring: 0 };
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)) {
      row.asaas += payment.value;
    }
    monthly.set(month, row);
  });
  (manual?.monthly ?? []).forEach((item) => {
    const row = monthly.get(item.month) ?? { month: item.month, asaas: 0, direct: 0, fixed: 0, recurring: 0 };
    row.direct = item.unmatched_direct_sales;
    row.fixed = item.fixed_costs;
    row.recurring = item.recurring_costs;
    monthly.set(item.month, row);
  });

  const rows = Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
    ...row,
    label: monthLabel(row.month),
    receita: row.asaas + row.direct,
    custos: row.fixed + row.recurring,
    saldo: row.asaas + row.direct - row.fixed - row.recurring,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--erp-violet-light)' }}>Cockpit financeiro</p>
          <h1 className="shrink-0 text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Controle Premium</h1>
          <p className="min-w-0 truncate text-sm" style={{ color: 'var(--erp-text-muted)' }}>Receita ASAAS, venda direta e custos manuais em uma leitura executiva</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl" style={{ border: '1px solid var(--erp-border)' }}>
            {PERIODS.map((period) => (
              <button
                key={period.value}
                onClick={() => setDays(period.value)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ background: days === period.value ? 'var(--erp-violet)' : 'var(--erp-surface)', color: days === period.value ? '#fff' : 'var(--erp-text-muted)' }}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(true)} className="flex h-8 w-8 items-center justify-center rounded-full" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface)', color: 'var(--erp-text-muted)' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receita realizada" value={loading ? '...' : currency(received + directSales, 2)} detail={`${currency(received, 2)} ASAAS + ${currency(directSales, 2)} venda direta`} tone="emerald" icon={<ArrowUpRight size={16} />} />
        <MetricCard label="Custos controlados" value={loading ? '...' : currency(totalCosts, 2)} detail={`${currency(fixedCosts, 2)} fixos + ${currency(recurringCosts, 2)} recorrentes`} tone="rose" icon={<ArrowDownRight size={16} />} />
        <MetricCard label="Resultado líquido" value={loading ? '...' : currency(net, 2)} detail={`${margin.toFixed(1)}% margem operacional`} tone={net >= 0 ? 'cyan' : 'amber'} icon={<Banknote size={16} />} />
        <MetricCard label="A receber" value={loading ? '...' : currency(pending, 2)} detail={`${data?.pending_count ?? 0} cobranças pendentes`} tone="violet" icon={<WalletCards size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <Card padding="lg">
          <CardHeader title="Receita x custos" subtitle="Visão mensal consolidada" />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `R$${(Number(value) / 1000).toFixed(0)}k`} />
              <Tooltip content={chartTooltip} />
              <Bar dataKey="asaas" name="ASAAS" stackId="receita" fill="#34d399" radius={[5, 5, 0, 0]} />
              <Bar dataKey="direct" name="Venda direta" stackId="receita" fill="#67e8f9" radius={[5, 5, 0, 0]} />
              <Bar dataKey="fixed" name="Fixos" stackId="custos" fill="#f87171" radius={[5, 5, 0, 0]} />
              <Bar dataKey="recurring" name="Recorrentes" stackId="custos" fill="#fbbf24" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card padding="lg">
        <CardHeader title="Mapa mensal" subtitle="Tudo que importa para decidir rápido" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Mês', 'Receita ASAAS', 'Venda direta', 'Custos fixos', 'Custos recorrentes', 'Saldo'].map((heading) => (
                  <th key={heading} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-text-dim)' }}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
              {rows.map((row) => (
                <tr key={row.month}>
                  <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{row.label}</td>
                  <td className="py-3 tabular-nums" style={{ color: '#34d399' }}>{currency(row.asaas, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: '#67e8f9' }}>{currency(row.direct, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: '#f87171' }}>{currency(row.fixed, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: '#fbbf24' }}>{currency(row.recurring, 2)}</td>
                  <td className="py-3 font-semibold tabular-nums" style={{ color: row.saldo >= 0 ? '#34d399' : '#f87171' }}>{currency(row.saldo, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="lg">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}><ShieldCheck size={18} /></div>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Receita centralizada</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>ASAAS, pendências, recebidos e venda direta conciliada ficam em Receita.</p>
        </Card>
        <Card padding="lg">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}><ArrowDownRight size={18} /></div>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Custos fixos manuais</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>Impostos, logística e obrigações previsíveis com cadastro rápido.</p>
        </Card>
        <Card padding="lg">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}><RefreshCw size={18} /></div>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Recorrências sob controle</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>Software, contabilidade, empréstimos e contratos mensais sem poluir a navegação.</p>
        </Card>
      </div>
    </div>
  );
}

export default FinanceiroLayout;
