import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { AlertTriangle, ArrowRight, CheckCircle, Clock, DollarSign, RefreshCw, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { MetricCard } from '../shared/components/layout/MetricCard';
import { Card, CardHeader } from '../shared/components/ui/Card';

type AsaasData = {
  received_value: number;
  pending_value: number;
  overdue_value: number;
  overdue_count: number;
  pending_count: number;
  received_count: number;
  customers_total: number;
  recurring_value: number;
  recurring_count: number;
  payments: { id: string; customer: string; description: string; value: number; status: string; due_date: string }[];
};

type SiteData = {
  configured: boolean;
  summary?: { unique_visitors: number; pageviews: number; conversion_rate: number; bounce_rate: number; leads: number };
  daily?: { date: string; visitors: number; pageviews: number }[];
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
const fmt = new Intl.NumberFormat('pt-BR');

function PendingMark() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      <Clock size={9} />
      Aguarda mapeamento
    </span>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[18px] border border-violet-100 bg-white px-3 py-2 text-xs">
      <p className="mb-1 text-slate-500">{label}</p>
      {payload.map((item: any) => (
        <p key={item.name} className="font-medium" style={{ color: item.color }}>
          {item.name}: {typeof item.value === 'number' && item.value > 1000 ? money(item.value) : fmt.format(item.value)}
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-violet-200 bg-violet-50/40">
      <Clock size={16} className="text-slate-400" />
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [asaas, setAsaas] = useState<AsaasData | null>(null);
  const [asaasLoading, setAsaasLoading] = useState(true);
  const [asaasError, setAsaasError] = useState<string | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);

  const loadAsaas = (forceRefresh = false) => {
    setAsaasLoading(true);
    setAsaasError(null);
    api.get<AsaasData>(`/financial/overview${forceRefresh ? '?refresh=true' : ''}`)
      .then(({ data }) => setAsaas(data))
      .catch((error) => {
        const msg = error?.response?.data?.detail || error?.message || 'Falha ao conectar ao ASAAS';
        setAsaasError(msg);
        setAsaas(null);
      })
      .finally(() => setAsaasLoading(false));
  };

  useEffect(() => {
    loadAsaas(false);
    api.get<SiteData>('/site/dashboard?days=30')
      .then(({ data }) => setSite(data))
      .catch(() => setSite(null))
      .finally(() => setSiteLoading(false));
  }, []);

  const siteDaily = site?.daily?.slice(-14) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-violet-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">Visão executiva</p>
          <h1 className="shrink-0 text-xl font-bold tracking-tight text-slate-950">Dashboard</h1>
          <p className="min-w-0 truncate text-sm text-slate-600">Dados em tempo real com leitura operacional e financeira.</p>
        </div>
        <button onClick={() => loadAsaas(true)} className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3 py-2 text-xs text-slate-600 transition hover:border-violet-200 hover:text-violet-700">
          <RefreshCw size={12} className={asaasLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {asaasError && (
        <div className="flex items-center gap-3 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={14} />
          <span><strong>ASAAS:</strong> {asaasError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recebido" value={asaasLoading ? '...' : asaas ? money(asaas.received_value) : '-'} detail={asaas ? `${asaas.received_count} cobranças pagas` : 'Sem dados ASAAS'} tone="emerald" icon={<CheckCircle size={16} />} />
        <MetricCard label="A receber" value={asaasLoading ? '...' : asaas ? money(asaas.pending_value) : '-'} detail={asaas ? `${asaas.pending_count} cobranças pendentes` : 'Sem dados ASAAS'} tone="violet" icon={<DollarSign size={16} />} />
        <MetricCard label="Em atraso" value={asaasLoading ? '...' : asaas ? money(asaas.overdue_value) : '-'} detail={asaas ? `${asaas.overdue_count} cobranças vencidas` : 'Sem dados ASAAS'} tone="rose" icon={<AlertTriangle size={16} />} />
        <MetricCard label="Clientes ASAAS" value={asaasLoading ? '...' : asaas ? fmt.format(asaas.customers_total) : '-'} detail="Total de clientes cadastrados" tone="cyan" icon={<Users size={16} />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recorrente MRR" value={asaasLoading ? '...' : asaas && asaas.recurring_value > 0 ? money(asaas.recurring_value) : '-'} detail={asaas && asaas.recurring_value > 0 ? `${asaas.recurring_count} assinaturas ativas` : <PendingMark />} tone="violet" icon={<RefreshCw size={16} />} />
        <MetricCard label="Receita do mês" value="-" detail={<PendingMark />} tone="emerald" icon={<TrendingUp size={16} />} />
        <MetricCard label="Churn" value="-" detail={<PendingMark />} tone="amber" icon={<TrendingDown size={16} />} />
        <MetricCard label="Pipeline" value="-" detail={<PendingMark />} tone="cyan" icon={<Sparkles size={16} />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Últimas cobranças" subtitle="ASAAS, dados reais" action={<Link to="/financeiro/receita" className="flex items-center gap-1 text-xs font-medium text-violet-700">Ver receita <ArrowRight size={11} /></Link>} />
          {asaasLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded-full bg-violet-50" />)}</div>
          ) : asaas?.payments?.length ? (
            <div className="divide-y divide-violet-50">
              {asaas.payments.slice(0, 6).map((payment) => {
                const isPaid = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status);
                const isOverdue = payment.status === 'OVERDUE';
                return (
                  <div key={payment.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-950">{payment.customer}</p>
                      <p className="truncate text-xs text-slate-500">{payment.description} · vence {payment.due_date}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isPaid ? 'bg-emerald-50 text-emerald-700' : isOverdue ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente'}</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-950">{money(payment.value)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyChart label="Sem cobranças disponíveis" />
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Tráfego do site" subtitle={site?.configured ? 'Visitantes dos últimos 14 dias' : 'Aguarda integração Supabase'} />
          {siteLoading ? (
            <EmptyChart label="Carregando dados do site..." />
          ) : siteDaily.length ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={siteDaily} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barSize={6}>
                  <Bar dataKey="visitors" fill="#2b165c" opacity={0.75} radius={[3, 3, 0, 0]} name="Visitantes" />
                  <XAxis dataKey="date" tick={{ fill: '#746d91', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(date) => date.slice(8)} />
                  <Tooltip content={<ChartTooltip />} />
                </BarChart>
              </ResponsiveContainer>
              {site?.summary && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-[18px] bg-violet-50 p-2 text-center">
                    <p className="text-xs text-slate-600">Visitantes únicos</p>
                    <p className="text-sm font-semibold text-slate-950">{fmt.format(site.summary.unique_visitors)}</p>
                  </div>
                  <div className="rounded-[18px] bg-violet-50 p-2 text-center">
                    <p className="text-xs text-slate-600">Conversão</p>
                    <p className="text-sm font-semibold text-slate-950">{site.summary.conversion_rate}%</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyChart label="Integração Supabase não configurada" />
          )}
        </Card>
      </div>
    </div>
  );
}
