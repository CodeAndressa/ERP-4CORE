import { useEffect, useState } from 'react';
import { Calendar, CheckCircle, DollarSign, Link2, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { currency, formatDate, type ManualFinancial } from './manualFinance';

interface Payment {
  id: string;
  customer?: string;
  description?: string;
  value: number;
  due_date?: string;
  status?: string;
}
interface Overview {
  summary?: { total_received?: number; total_pending?: number; mrr?: number };
  payments?: Payment[];
  forecast_6_months?: { month: string; value?: number; expected?: number }[];
  manual_financial?: ManualFinancial;
}

const RECEIVED_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'received', 'confirmed', 'received_in_cash']);

export default function ReceitasPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Overview>('/financial/overview?days=180')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const received = (data?.payments ?? []).filter((p) => RECEIVED_STATUSES.has(p.status ?? ''));
  const directSales = data?.manual_financial?.direct_sales ?? [];
  const totalReceived = received.reduce((sum, item) => sum + item.value, 0);
  const totalDirectSales = directSales.reduce((sum, item) => sum + item.value, 0);
  const unmatchedDirectSales = directSales.filter((item) => !item.matched).reduce((sum, item) => sum + item.value, 0);
  const avgTicket = received.length > 0 ? totalReceived / received.length : 0;

  const chartData = (data?.forecast_6_months ?? []).map((f) => ({
    month: f.month?.slice(0, 7),
    previsto: f.value ?? f.expected ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro · ASAAS</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Receitas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Pagamentos confirmados e vendas diretas para reposição de caixa</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Recebido ASAAS" value={loading ? '...' : currency(totalReceived)} detail={`${received.length} pagamentos`} tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Ticket médio" value={loading ? '...' : currency(avgTicket)} detail="por pagamento recebido" tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="MRR" value={loading ? '...' : currency(data?.summary?.mrr ?? 0)} detail="receita mensal recorrente" tone="amber" icon={<TrendingUp size={16} />} />
        <MetricCard label="Venda direta" value={loading ? '...' : currency(totalDirectSales, 2)} detail={`${unmatchedDirectSales ? currency(unmatchedDirectSales, 2) : 'R$ 0'} sem match`} tone="cyan" icon={<Link2 size={16} />} />
      </div>

      {chartData.length > 0 && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Previsão de receita - próximos meses</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }} formatter={(v: number) => [currency(v), 'Previsto']} />
              <Area type="monotone" dataKey="previsto" stroke="#34d399" strokeWidth={2} fill="url(#gReceita)" name="Previsto" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card padding="sm">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Vendas diretas · reposição de caixa</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Competência', 'Cliente', 'Descrição', 'Parcela', 'Total contrato', 'ASAAS'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {directSales.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < directSales.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{item.month}</td>
                  <td className="px-4 py-3 font-medium max-w-xs" style={{ color: 'var(--erp-text)' }}>{item.customer}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--erp-text-muted)' }}>{item.description}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: '#34d399' }}>{currency(item.value, 2)}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>{currency(item.contract_total, 2)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: item.matched ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)', color: item.matched ? '#34d399' : '#fbbf24' }}>
                      {item.matched ? 'Conciliado' : 'Reposição caixa'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding="sm">
        <CardHeader title="Pagamentos recebidos" subtitle="ASAAS" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Cliente', 'Descrição', 'Valor', 'Data', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {received.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: i < received.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer ?? '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{p.description ?? '-'}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: '#34d399' }}>{currency(p.value)}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}><Calendar size={10} />{formatDate(p.due_date)}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>Recebido</span></td>
                </tr>
              ))}
              {!loading && received.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>Nenhum pagamento recebido no período</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}