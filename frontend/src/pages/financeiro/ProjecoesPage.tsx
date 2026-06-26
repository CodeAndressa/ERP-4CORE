import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { Card, CardHeader } from '../../shared/components/ui/Card';
import { money, type AsaasData } from './FinanceiroPage';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border-strong)', color: 'var(--erp-text)' }}>
      <p className="mb-1" style={{ color: 'var(--erp-text-muted)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {money(p.value)}</p>
      ))}
    </div>
  );
};

export default function ProjecoesPage() {
  const [data, setData] = useState<AsaasData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AsaasData>('/financial/overview?days=365')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const forecast = (data?.forecast_6_months ?? []).map((d) => ({
    month: d.month,
    label: new Date(d.month + '-02').toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
    value: d.value,
  }));

  const totalForecast = forecast.reduce((s, d) => s + d.value, 0);
  const maxMonth = forecast.reduce((m, d) => d.value > m.value ? d : m, { label: '—', value: 0 });
  const minMonth = forecast.reduce((m, d) => d.value < m.value ? d : m, { label: '—', value: Infinity });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>Projeções</h1>
        <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Previsão de recebimento por vencimento · ASAAS</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Previsto (6 meses)', value: totalForecast, icon: TrendingUp, color: 'var(--erp-violet-light)' },
          { label: 'Maior Mês', value: maxMonth.value, sub: maxMonth.label, icon: TrendingUp, color: '#34d399' },
          { label: 'Menor Mês', value: minMonth.value === Infinity ? 0 : minMonth.value, sub: minMonth.label, icon: RefreshCw, color: '#fbbf24' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--erp-surface)', border: '1px solid var(--erp-border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} style={{ color }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--erp-text-muted)' }}>{label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--erp-text)' }}>{loading ? '…' : money(value)}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--erp-text-dim)' }}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* Area chart */}
      <Card padding="lg">
        <CardHeader title="Projeção de Recebimento" subtitle="Por mês de vencimento · ASAAS" />
        {loading ? (
          <div className="h-56 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
        ) : forecast.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={forecast} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c4dff" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="#7c4dff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Area name="Previsto" type="monotone" dataKey="value" stroke="#7c4dff" strokeWidth={2.5} fill="url(#gProj)" dot={{ fill: '#7c4dff', r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-xl"
            style={{ border: '1px dashed var(--erp-border-strong)' }}>
            <p className="text-sm" style={{ color: 'var(--erp-text-muted)' }}>Sem dados de projeção</p>
          </div>
        )}
      </Card>

      {/* Bar breakdown */}
      <Card padding="lg">
        <CardHeader title="Comparativo por Mês" subtitle="Volume por período" />
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl" style={{ background: 'var(--erp-surface-2)' }} />
        ) : forecast.length ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={forecast} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={28}>
              <Bar dataKey="value" fill="#7c4dff" radius={[6, 6, 0, 0]} opacity={0.85} name="Previsto" />
              <XAxis dataKey="label" tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={36} />
              <Tooltip content={<CustomTooltip />} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
      </Card>

      {/* Monthly table */}
      {forecast.length > 0 && (
        <Card padding="lg">
          <CardHeader title="Detalhe Mensal" subtitle="Todos os meses previstos" />
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--erp-border)' }}>
                {['Mês', 'Valor Previsto', '% do Total'].map((h) => (
                  <th key={h} className="pb-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--erp-text-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--erp-border)' }}>
              {forecast.map((f) => (
                <tr key={f.month}>
                  <td className="py-3 font-medium" style={{ color: 'var(--erp-text)' }}>{f.label}</td>
                  <td className="py-3 font-semibold tabular-nums" style={{ color: 'var(--erp-text)' }}>{money(f.value)}</td>
                  <td className="py-3 tabular-nums" style={{ color: 'var(--erp-text-muted)' }}>
                    {totalForecast > 0 ? ((f.value / totalForecast) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
