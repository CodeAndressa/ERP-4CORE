import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Clock3, RefreshCw, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { currency, monthLabel, readDeletedDirectSaleIds, readLocalDirectSales, type DirectSale, type ManualFinancial } from './manualFinance';
import FinancePeriodFilter from './FinancePeriodFilter';
import { DEFAULT_PERIOD, buildOverviewUrl, isInFinancePeriod, type FinancePeriod } from './financePeriod';

export type AsaasData = {
  account_balance?: number | null;
  received_value: number;
  confirmed_value: number;
  pending_value: number;
  overdue_value: number;
  overdue_count: number;
  pending_count: number;
  received_count: number;
  confirmed_count: number;
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

const RECEIVED_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'received', 'confirmed', 'received_in_cash']);

export const money = (value: number) => currency(value);


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
  const [period, setPeriod] = useState<FinancePeriod>(DEFAULT_PERIOD);
  const [localDirectSales, setLocalDirectSales] = useState<DirectSale[]>([]);
  const [deletedDirectSaleIds, setDeletedDirectSaleIds] = useState<string[]>([]);

  const load = useCallback((forceRefresh = false) => {
    setLoading(true);
    setError(null);
    api.get<AsaasData>(buildOverviewUrl(period, forceRefresh))
      .then(({ data: response }) => {
        setData(response);
        _sharedData = response;
        _sharedLoading = false;
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Falha ao conectar dados financeiros'))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    setLocalDirectSales(readLocalDirectSales());
    setDeletedDirectSaleIds(readDeletedDirectSaleIds());
  }, []);

  const manual = data?.manual_financial;
  const periodPayments = (data?.payments ?? []).filter((payment) => isInFinancePeriod(payment.due_date, period));
  const backendDirectSales = (manual?.direct_sales ?? []).filter((item) => !deletedDirectSaleIds.includes(item.id) && isInFinancePeriod(item.date, period));
  const effectiveDirectSales = [...backendDirectSales, ...localDirectSales.filter((item) => isInFinancePeriod(item.date, period))];
  const periodFixedCosts = (manual?.fixed_costs ?? []).filter((item) => isInFinancePeriod(item.date, period));
  const periodRecurringCosts = (manual?.recurring_costs ?? []).filter((item) => isInFinancePeriod(item.date, period));

  const monthly = new Map<string, { month: string; asaas: number; direct: number; fixed: number; recurring: number }>();
  periodPayments.forEach((payment) => {
    const month = (payment.due_date ?? '').slice(0, 7);
    if (!month) return;
    const row = monthly.get(month) ?? { month, asaas: 0, direct: 0, fixed: 0, recurring: 0 };
    if (RECEIVED_STATUSES.has(payment.status ?? '')) {
      row.asaas += payment.value;
    }
    monthly.set(month, row);
  });
  periodFixedCosts.forEach((item) => {
    const row = monthly.get(item.month) ?? { month: item.month, asaas: 0, direct: 0, fixed: 0, recurring: 0 };
    row.fixed += item.value;
    monthly.set(item.month, row);
  });
  periodRecurringCosts.forEach((item) => {
    const row = monthly.get(item.month) ?? { month: item.month, asaas: 0, direct: 0, fixed: 0, recurring: 0 };
    row.recurring += item.value;
    monthly.set(item.month, row);
  });
  effectiveDirectSales.filter((item) => !item.matched).forEach((item) => {
    const row = monthly.get(item.month) ?? { month: item.month, asaas: 0, direct: 0, fixed: 0, recurring: 0 };
    row.direct += item.value;
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
      <div className="relative z-[900] flex flex-col gap-3 rounded-2xl border bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-end" style={{ borderColor: 'var(--erp-border)' }}>
        <FinancePeriodFilter value={period} onApply={setPeriod} />
        <button onClick={() => load(true)} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors" style={{ border: '1px solid var(--erp-border)', background: 'var(--erp-surface)', color: 'var(--erp-text)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(190,18,60,0.08)', border: '1px solid rgba(190,18,60,0.2)', color: 'var(--erp-rose)' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Saldo em conta" value={loading ? '...' : data?.account_balance != null ? currency(data.account_balance, 2) : '—'} detail="Disponível agora no ASAAS" tone="violet" icon={<Wallet size={16} />} />
        <Link to="/financeiro/cobrancas?status=received" className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: 'var(--erp-violet)' }}><MetricCard label="Recebidas" value={loading ? '...' : currency(data?.received_value ?? 0, 2)} detail={`${data?.received_count ?? 0} cobranças com saldo disponível`} tone="emerald" icon={<CheckCircle2 size={16} />} /></Link>
        <Link to="/financeiro/cobrancas?status=confirmed" className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: 'var(--erp-violet)' }}><MetricCard label="Confirmadas" value={loading ? '...' : currency(data?.confirmed_value ?? 0, 2)} detail={`${data?.confirmed_count ?? 0} aguardando crédito em conta`} tone="cyan" icon={<Check size={16} />} /></Link>
        <Link to="/financeiro/cobrancas?status=pending" className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: 'var(--erp-violet)' }}><MetricCard label="Aguardando pagamento" value={loading ? '...' : currency(data?.pending_value ?? 0, 2)} detail={`${data?.pending_count ?? 0} cobranças em aberto`} tone="amber" icon={<Clock3 size={16} />} /></Link>
        <Link to="/financeiro/cobrancas?status=overdue" className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: 'var(--erp-violet)' }}><MetricCard label="Vencidas" value={loading ? '...' : currency(data?.overdue_value ?? 0, 2)} detail={`${data?.overdue_count ?? 0} cobranças para agir`} tone="rose" icon={<AlertCircle size={16} />} /></Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <Card padding="lg">
          <CardHeader title="Receita x custos" subtitle="Visão mensal consolidada" />
          {loading ? (
            <div className="flex h-[250px] items-end gap-2 px-1">
              {[55, 70, 45, 85, 60, 75, 50, 90, 65, 80, 55, 70].map((h, i) => (
                <div key={i} className="flex-1 animate-pulse rounded-t-md" style={{ height: `${h}%`, background: 'var(--erp-surface-2)' }} />
              ))}
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `R$${(Number(value) / 1000).toFixed(0)}k`} />
              <Tooltip content={chartTooltip} />
              <Bar dataKey="asaas" name="ASAAS" stackId="receita" fill="var(--erp-emerald)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="direct" name="Venda direta" stackId="receita" fill="var(--erp-cyan)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="fixed" name="Fixos" stackId="custos" fill="var(--erp-rose)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="recurring" name="Recorrentes" stackId="custos" fill="var(--erp-amber)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
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
              {loading && (
                <tr><td colSpan={6}><div className="space-y-2 py-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}</div></td></tr>
              )}
              {!loading && rows.map((row) => (
                <tr key={row.month}>
                  <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{row.label}</td>
                  <td className="py-3 tabular-nums" style={{ color: 'var(--erp-emerald)' }}>{currency(row.asaas, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: 'var(--erp-cyan)' }}>{currency(row.direct, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: 'var(--erp-rose)' }}>{currency(row.fixed, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: 'var(--erp-amber)' }}>{currency(row.recurring, 2)}</td>
                  <td className="py-3 font-semibold tabular-nums" style={{ color: row.saldo >= 0 ? 'var(--erp-emerald)' : 'var(--erp-rose)' }}>{currency(row.saldo, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default FinanceiroLayout;
