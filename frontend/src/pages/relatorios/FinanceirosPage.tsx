import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, DollarSign, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import { MetricCard } from '../../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { api } from '../../services/api';

interface AsaasData {
  received_value: number;
  pending_value: number;
  overdue_value: number;
  recurring_value: number;
  received_count: number;
  pending_count: number;
  overdue_count: number;
  forecast_6_months: { month: string; value: number }[];
}

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border-strong)', color: 'var(--erp-text)' }}>
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === 'number' ? money(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function FinanceirosPage() {
  const [data, setData] = useState<AsaasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    api.get<AsaasData>('/financial/overview?days=365')
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(e?.response?.data?.detail || 'Falha ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  const forecastData = (data?.forecast_6_months ?? []).map((d) => ({
    ...d,
    label: new Date(d.month + '-02').toLocaleString('pt-BR', { month: 'short' }),
  }));

  function handleExport() {
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Relatórios</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Relatório Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Consolidado 365 dias · ASAAS</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
          style={{
            background: exported ? 'rgba(52,211,153,0.12)' : 'var(--erp-surface)',
            color: exported ? '#34d399' : 'var(--erp-text-muted)',
            border: '1px solid var(--erp-border)',
          }}
        >
          <Download size={13} />
          {exported ? 'Exportado!' : 'Exportar PDF'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recebido (ano)"  value={loading ? '…' : data ? money(data.received_value) : '—'} detail={data ? `${data.received_count} cobranças` : undefined} tone="emerald" icon={<TrendingUp size={16} />} />
        <MetricCard label="A Receber"       value={loading ? '…' : data ? money(data.pending_value) : '—'}  detail={data ? `${data.pending_count} pendentes` : undefined}  tone="violet"  icon={<DollarSign size={16} />} />
        <MetricCard label="Em Atraso"       value={loading ? '…' : data ? money(data.overdue_value) : '—'}  detail={data ? `${data.overdue_count} vencidas` : undefined}   tone="rose"    icon={<AlertTriangle size={16} />} />
        <MetricCard label="MRR"             value={loading ? '…' : data ? money(data.recurring_value) : '—'} detail="recorrente mensal"                                   tone="amber"   icon={<RefreshCw size={16} />} />
      </div>

      <Card padding="lg">
        <CardHeader title="Previsão de Recebimento" subtitle="Próximos 6 meses por vencimento" />
        {forecastData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecastData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gFRel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c4dff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<Tip />} />
              <Area name="Previsto" type="monotone" dataKey="value" stroke="#7c4dff" strokeWidth={2} fill="url(#gFRel)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-44 items-center justify-center rounded-xl"
            style={{ border: '1px dashed var(--erp-border-strong)' }}>
            <p className="text-xs" style={{ color: 'var(--erp-text-muted)' }}>
              {loading ? 'Carregando…' : 'Sem dados de previsão'}
            </p>
          </div>
        )}
      </Card>

      {forecastData.length > 0 && (
        <Card padding="lg">
          <CardHeader title="Detalhamento por Mês" subtitle="Valor previsto por período" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                  {['Mês', 'Previsto', 'Variação'].map((h) => (
                    <th key={h} className="pb-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {forecastData.map((d, i) => {
                  const prev = forecastData[i - 1];
                  const change = prev ? ((d.value - prev.value) / prev.value) * 100 : null;
                  return (
                    <tr key={d.month} style={{ borderBottom: i < forecastData.length - 1 ? '1px solid var(--erp-border)' : undefined }}>
                      <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{d.label} {d.month.slice(0, 4)}</td>
                      <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(d.value)}</td>
                      <td className="py-3">
                        {change !== null && (
                          <span className="text-xs font-medium" style={{ color: change >= 0 ? '#34d399' : '#f87171' }}>
                            {change > 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
