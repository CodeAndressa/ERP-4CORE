import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, CheckCircle, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

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
  forecast_6_months?: { month: string; expected?: number; }[];
}

const RECEIVED_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'received', 'confirmed', 'received_in_cash']);

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export default function ReceitasPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Overview>('/financial/overview?days=90')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const received = (data?.payments ?? []).filter((p) => RECEIVED_STATUSES.has(p.status ?? ''));
  const totalReceived = received.reduce((s, p) => s + p.value, 0);
  const avgTicket = received.length > 0 ? totalReceived / received.length : 0;

  const chartData = (data?.forecast_6_months ?? []).map((f) => ({
    month: f.month?.slice(0, 7),
    previsto: f.expected ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro · ASAAS</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Receitas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Pagamentos confirmados nos últimos 90 dias</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Recebido"      value={loading ? '…' : money(totalReceived)} detail={`${received.length} pagamentos`}           tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="Ticket médio"  value={loading ? '…' : money(avgTicket)}    detail="por pagamento recebido"                    tone="violet"  icon={<DollarSign size={16} />}  />
        <MetricCard label="MRR"           value={loading ? '…' : money(data?.summary?.mrr ?? 0)} detail="receita mensal recorrente"      tone="amber"   icon={<TrendingUp size={16} />}  />
      </div>

      {chartData.length > 0 && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Previsão de receita — próximos 6 meses</p>
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
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }}
                formatter={(v: number) => [money(v), 'Previsto']} />
              <Area type="monotone" dataKey="previsto" stroke="#34d399" strokeWidth={2} fill="url(#gReceita)" name="Previsto" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card padding="sm">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--erp-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Pagamentos recebidos</p>
        </div>
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Cliente', 'Descrição', 'Valor', 'Data', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--erp-text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {received.map((p, i) => (
                  <tr key={p.id}
                    style={{ borderBottom: i < received.length - 1 ? '1px solid var(--erp-border)' : undefined }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--erp-surface-2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{p.customer ?? '—'}</td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--erp-text-muted)' }}>{p.description ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: '#34d399' }}>{money(p.value)}</td>
                    <td className="px-4 py-3">
                      {p.due_date ? (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--erp-text-muted)' }}>
                          <Calendar size={10} />
                          {new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                        {p.status === 'RECEIVED_IN_CASH' ? 'Em dinheiro' : 'Recebido'}
                      </span>
                    </td>
                  </tr>
                ))}
                {received.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: 'var(--erp-text-muted)' }}>
                    Nenhum pagamento recebido nos últimos 90 dias
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
