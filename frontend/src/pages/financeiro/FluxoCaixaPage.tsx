import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { api } from '../../services/api';
import { Card } from '../../shared/components/ui/Card';
import { MetricCard } from '../../shared/components/layout/MetricCard';

interface Overview {
  summary?: { total_received?: number; total_pending?: number; total_overdue?: number; };
  forecast_6_months?: { month: string; expected?: number; }[];
  payments?: { value: number; status?: string; due_date?: string; }[];
}

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function monthLabel(iso: string) {
  const [, m] = iso.split('-');
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return months[parseInt(m) - 1] ?? iso;
}

export default function FluxoCaixaPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Overview>('/financial/overview?days=180')
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const received   = data?.summary?.total_received  ?? 0;
  const pending    = data?.summary?.total_pending   ?? 0;
  const overdue    = data?.summary?.total_overdue   ?? 0;

  const forecastData = (data?.forecast_6_months ?? []).map((f) => ({
    month:    monthLabel(f.month ?? ''),
    entrada:  f.expected ?? 0,
    saida:    0,
  }));

  const balanceTrend = forecastData.map((d, i) => ({
    ...d,
    saldo: forecastData.slice(0, i + 1).reduce((s, x) => s + x.entrada - x.saida, received),
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--erp-violet-light)' }}>Financeiro · ASAAS</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--erp-text)' }}>Fluxo de Caixa</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--erp-text-muted)' }}>Entradas confirmadas e previsão para os próximos 6 meses</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Entradas reais"  value={loading ? '…' : money(received)} detail="recebido · ASAAS"       tone="emerald" icon={<TrendingUp size={16} />}   />
        <MetricCard label="A receber"       value={loading ? '…' : money(pending)}  detail="cobranças pendentes"     tone="violet"  icon={<ArrowRight size={16} />} />
        <MetricCard label="Em atraso"       value={loading ? '…' : money(overdue)}  detail="cobranças vencidas"      tone="amber"   icon={<TrendingDown size={16} />} />
      </div>

      {forecastData.length > 0 && (
        <Card padding="lg">
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--erp-text)' }}>Previsão de entradas — próximos 6 meses</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={forecastData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }}
                formatter={(v: number) => [money(v)]} />
              <Bar dataKey="entrada" name="Entrada prevista" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {balanceTrend.length > 0 && (
        <Card padding="lg">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--erp-text)' }}>Saldo projetado</p>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>
              Saídas aguardam mapeamento
            </span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={balanceTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--erp-border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--erp-text-dim)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--erp-surface-2)', border: '1px solid var(--erp-border)', borderRadius: 8, color: 'var(--erp-text)', fontSize: 12 }}
                formatter={(v: number) => [money(v), 'Saldo']} />
              <Area type="monotone" dataKey="saldo" stroke="#7c3aed" strokeWidth={2} fill="url(#gSaldo)" name="Saldo" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card padding="lg">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--erp-text)' }}>Saídas</p>
        <div className="flex flex-col items-center gap-3 py-8 rounded-xl"
          style={{ border: '1px dashed var(--erp-border)' }}>
          <TrendingDown size={24} style={{ color: 'var(--erp-text-dim)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--erp-text-muted)' }}>Lançamento de despesas não mapeado</p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--erp-text-dim)' }}>
            Ao conectar uma fonte de despesas, o saldo real será calculado automaticamente aqui.
          </p>
        </div>
      </Card>
    </div>
  );
}
