import { useEffect, useState } from 'react';
import { ArrowRight, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { currency, monthLabel, type ManualFinancial } from './manualFinance';

interface Overview {
  received_value?: number;
  pending_value?: number;
  overdue_value?: number;
  summary?: { total_received?: number; total_pending?: number; total_overdue?: number; };
  forecast_6_months?: { month: string; value?: number; expected?: number; }[];
  manual_financial?: ManualFinancial;
}

export default function FluxoCaixaPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Overview>('/financial/overview?days=365')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const received = data?.summary?.total_received ?? data?.received_value ?? 0;
  const pending = data?.summary?.total_pending ?? data?.pending_value ?? 0;
  const manual = data?.manual_financial;
  const expensesTotal = manual?.summary.expenses_total ?? 0;
  const directUnmatched = manual?.summary.unmatched_direct_sales_total ?? 0;

  const months = new Map<string, { month: string; entradaAsaas: number; vendaDireta: number; saida: number }>();
  (data?.forecast_6_months ?? []).forEach((item) => {
    months.set(item.month, { month: item.month, entradaAsaas: item.value ?? item.expected ?? 0, vendaDireta: 0, saida: 0 });
  });
  (manual?.monthly ?? []).forEach((item) => {
    const row = months.get(item.month) ?? { month: item.month, entradaAsaas: 0, vendaDireta: 0, saida: 0 };
    row.vendaDireta = item.unmatched_direct_sales;
    row.saida = item.expenses;
    months.set(item.month, row);
  });

  const forecastData = Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
    ...row,
    label: monthLabel(row.month),
    entrada: row.entradaAsaas + row.vendaDireta,
    saldoMes: row.entradaAsaas + row.vendaDireta - row.saida,
  }));

  const balanceTrend = forecastData.map((row, index) => ({
    ...row,
    saldo: forecastData.slice(0, index + 1).reduce((sum, item) => sum + item.saldoMes, received),
  }));
  const projectedCash = balanceTrend.length ? balanceTrend[balanceTrend.length - 1].saldo : received + directUnmatched - expensesTotal;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro · ASAAS + manual</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Fluxo de Caixa</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Entradas confirmadas, reposição de caixa e custos mensais</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Entradas reais" value={loading ? '...' : currency(received)} detail="recebido · ASAAS" tone="emerald" icon={<TrendingUp size={16} />} />
        <MetricCard label="A receber" value={loading ? '...' : currency(pending)} detail="cobranças pendentes" tone="violet" icon={<ArrowRight size={16} />} />
        <MetricCard label="Saídas manuais" value={loading ? '...' : currency(expensesTotal, 2)} detail="custos mensais" tone="rose" icon={<TrendingDown size={16} />} />
        <MetricCard label="Saldo projetado" value={loading ? '...' : currency(projectedCash, 2)} detail="com venda direta sem match" tone="cyan" icon={<Wallet size={16} />} />
      </div>

      {forecastData.length > 0 && (
        <Card padding="lg">
          <CardHeader title="Entradas e saídas previstas" subtitle="ASAAS + reposição de caixa manual" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={forecastData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }} formatter={(v: number) => [currency(v, 2)]} />
              <Bar dataKey="entradaAsaas" name="ASAAS" stackId="entrada" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="vendaDireta" name="Venda direta" stackId="entrada" fill="#67e8f9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saida" name="Saídas" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {balanceTrend.length > 0 && (
        <Card padding="lg">
          <CardHeader title="Saldo projetado" subtitle="Acumulado por competência" />
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={balanceTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }} formatter={(v: number) => [currency(v, 2), 'Saldo']} />
              <Area type="monotone" dataKey="saldo" stroke="#7c3aed" strokeWidth={2} fill="url(#gSaldo)" name="Saldo" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card padding="lg">
        <CardHeader title="Detalhe por mês" subtitle="Entradas não duplicam parcelas conciliadas no ASAAS" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Mês', 'ASAAS', 'Venda direta', 'Saídas', 'Saldo mês'].map((h) => (
                  <th key={h} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
              {forecastData.map((row) => (
                <tr key={row.month}>
                  <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{row.label}</td>
                  <td className="py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{currency(row.entradaAsaas, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: '#67e8f9' }}>{currency(row.vendaDireta, 2)}</td>
                  <td className="py-3 tabular-nums" style={{ color: '#f87171' }}>{currency(row.saida, 2)}</td>
                  <td className="py-3 font-semibold tabular-nums" style={{ color: row.saldoMes >= 0 ? '#34d399' : '#f87171' }}>{currency(row.saldoMes, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}